const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Subject = require('../models/Subject');

function classNameFromSession(session) {
  if (!session || session.semester == null || session.section == null || session.section === '') {
    return 'Class unknown';
  }
  return `Class ${session.semester}-${session.section}`;
}

// @POST /api/sessions - Teacher starts a session
exports.createSession = async (req, res) => {
  try {
    const { departmentId, subjectId, semester, section } = req.body;

    // Verify subject belongs to teacher (unless admin)
    let subjectShift;
    if (req.user.role === 'teacher') {
      const subject = await Subject.findOne({ _id: subjectId, teacherId: req.user._id, isActive: true });
      if (!subject) return res.status(403).json({ success: false, message: 'You are not assigned to this subject' });
      subjectShift = subject.shift; // subject থেকে shift নাও
    } else {
      // Admin-এর ক্ষেত্রে subject থেকে shift নাও
      const subject = await Subject.findById(subjectId);
      subjectShift = subject?.shift;
    }

    // Check no active session already for this subject/section
    const existing = await Session.findOne({ subjectId, semester, section, status: 'active' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An active session already exists for this class', session: existing });
    }

    // শুধু এই shift-এর students count করো
    const shiftFilter = { role: 'student', departmentId, semester: parseInt(semester), section, isActive: true };
    if (subjectShift) shiftFilter.shift = subjectShift;

    const totalStudents = await User.countDocuments(shiftFilter);

    const session = await Session.create({
      teacherId: req.user._id,
      departmentId,
      subjectId,
      semester: parseInt(semester),
      section,
      shift: subjectShift, // session-এ shift সংরক্ষণ
      totalStudents
    });

    const populated = await Session.findById(session._id)
      .populate('teacherId', 'name')
      .populate('departmentId', 'name code')
      .populate('subjectId', 'name code');

    res.status(201).json({ success: true, session: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/sessions/:id/end - Teacher ends a session
exports.endSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.teacherId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (session.status === 'ended') {
      return res.status(400).json({ success: false, message: 'Session already ended' });
    }

    // Shift-filtered student query
    const studentFilter = {
      role: 'student',
      departmentId: session.departmentId,
      semester: session.semester,
      section: session.section,
      isActive: true
    };
    if (session.shift) studentFilter.shift = session.shift;

    const students = await User.find(studentFilter);

    const scanned = await Attendance.find({ sessionId: session._id }).select('studentId');
    const scannedIds = scanned.map(a => a.studentId.toString());

    const className = classNameFromSession(session);
    const absentOps = students
      .filter(s => !scannedIds.includes(s._id.toString()))
      .map(s => ({
        insertOne: {
          document: {
            sessionId: session._id, studentId: s._id, subjectId: session.subjectId,
            departmentId: session.departmentId, semester: session.semester,
            section: session.section, className, date: session.date, status: 'absent'
          }
        }
      }));

    if (absentOps.length > 0) await Attendance.bulkWrite(absentOps, { ordered: false });

    session.status = 'ended';
    session.endTime = new Date();
    session.presentCount = scannedIds.length;
    await session.save();

    res.json({ success: true, message: 'Session ended', session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/sessions - Get sessions (role-based)
exports.getSessions = async (req, res) => {
  try {
    const { departmentId, subjectId, semester, section, status } = req.query;
    const filter = {};

    if (req.user.role === 'teacher') filter.teacherId = req.user._id;
    if (departmentId) filter.departmentId = departmentId;
    if (subjectId) filter.subjectId = subjectId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (status) filter.status = status;

    const sessions = await Session.find(filter)
      .populate('teacherId', 'name')
      .populate('departmentId', 'name code')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, count: sessions.length, sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/sessions/:id
exports.getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('teacherId', 'name')
      .populate('departmentId', 'name code')
      .populate('subjectId', 'name code');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const attendance = await Attendance.find({ sessionId: session._id })
      .populate('studentId', 'name studentId section');

    res.json({ success: true, session, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/sessions/:id/attendance - Manual attendance update
exports.updateSessionAttendance = async (req, res) => {
  try {
    const { attendanceUpdates } = req.body; // [{attendanceId, status}]
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.teacherId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    for (const update of attendanceUpdates) {
      await Attendance.findByIdAndUpdate(update.attendanceId, { status: update.status });
    }

    // Recalculate present count
    const presentCount = await Attendance.countDocuments({ sessionId: session._id, status: 'present' });
    await Session.findByIdAndUpdate(session._id, { presentCount });

    res.json({ success: true, message: 'Attendance updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
