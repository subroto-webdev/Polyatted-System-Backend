const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const User = require('../models/User');
const Subject = require('../models/Subject');

function classNameFromSession(session) {
  if (!session || session.semester == null || session.section == null || session.section === '') {
    return 'Class unknown';
  }
  return `Class ${session.semester}-${session.section}`;
}

// @POST /api/attendance/scan - QR code scan
exports.scanQR = async (req, res) => {
  try {
    const { sessionId, qrData } = req.body;
    let parsed;
    try {
      parsed = typeof qrData === 'object' ? qrData : JSON.parse(qrData.trim());
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid QR format' });
    }

    const session = await Session.findById(sessionId).populate('subjectId', 'shift');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Session is not active' });
    if (session.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your session' });
    }

    const student = await User.findById(parsed.studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // ✅ Shift validation — session-এর subject shift আর student-এর shift মিলতে হবে
    const sessionShift = session.shift || session.subjectId?.shift;
    if (sessionShift && student.shift !== sessionShift) {
      return res.status(400).json({
        success: false,
        message: `${student.name} এই shift-এর student নয় (Student: ${student.shift} Shift, Class: ${sessionShift} Shift)`
      });
    }

    // Class mismatch check (semester + section + department)
    const classMismatch =
      student.semester !== session.semester ||
      student.section !== session.section ||
      student.departmentId.toString() !== session.departmentId.toString();

    if (classMismatch) {
      return res.status(400).json({
        success: false,
        message: `${student.name} এই class-এর student নয় (${session.semester}-${session.section} section)`
      });
    }

    const existing = await Attendance.findOne({ sessionId, studentId: student._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `${student.name} ইতিমধ্যে present marked`,
        student: { name: student.name, studentId: student.studentId }
      });
    }

    const attendance = await Attendance.create({
      sessionId, studentId: student._id, subjectId: session.subjectId,
      departmentId: session.departmentId, semester: session.semester,
      section: session.section, className: classNameFromSession(session),
      date: new Date(), status: 'present', scannedAt: new Date()
    });

    await Session.findByIdAndUpdate(sessionId, { $inc: { presentCount: 1 } });

    res.json({
      success: true,
      message: `✅ ${student.name} present marked`,
      student: { name: student.name, studentId: student.studentId, section: student.section, shift: student.shift },
      attendance
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @POST /api/attendance/manual - Teacher takes manual attendance for full class
exports.takeManualAttendance = async (req, res) => {
  try {
    const { sessionId, attendanceList } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Session not active' });
    if (session.teacherId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const className = classNameFromSession(session);
    const ops = attendanceList.map(item => ({
      updateOne: {
        filter: { sessionId, studentId: item.studentId },
        update: {
          $set: {
            sessionId, studentId: item.studentId, subjectId: session.subjectId,
            departmentId: session.departmentId, semester: session.semester,
            section: session.section, className, date: session.date, status: item.status
          }
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(ops);
    const presentCount = attendanceList.filter(a => a.status === 'present').length;
    await Session.findByIdAndUpdate(sessionId, { presentCount });

    res.json({ success: true, message: 'Attendance saved', presentCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @GET /api/attendance/session/:sessionId
exports.getSessionAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ sessionId: req.params.sessionId })
      .populate('studentId', 'name studentId section shift')
      .sort({ 'studentId.name': 1 });
    res.json({ success: true, count: attendance.length, attendance });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @GET /api/attendance/subject/:subjectId
exports.getSubjectAttendance = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (req.user.role === 'teacher' && subject.teacherId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your subject' });
    }

    const sessions = await Session.find({ subjectId, status: 'ended' }).sort({ date: -1 });

    const studentFilter = {
      role: 'student', departmentId: subject.departmentId,
      semester: subject.semester, section: subject.section, isActive: true
    };
    if (subject.shift) studentFilter.shift = subject.shift;

    const students = await User.find(studentFilter).sort({ name: 1 });
    const allAttendance = await Attendance.find({ subjectId });

    const attMap = {};
    allAttendance.forEach(a => {
      const sid = a.studentId.toString();
      const sessid = a.sessionId.toString();
      if (!attMap[sid]) attMap[sid] = {};
      attMap[sid][sessid] = a.status;
    });

    const report = students.map(s => {
      const sid = s._id.toString();
      const records = attMap[sid] || {};
      const total = sessions.length;
      const present = sessions.filter(sess => records[sess._id.toString()] === 'present').length;
      return {
        student: { _id: s._id, name: s.name, studentId: s.studentId },
        total, present, absent: total - present,
        percentage: total ? Math.round((present / total) * 100) : 0,
        sessions: sessions.map(sess => ({
          sessionId: sess._id, date: sess.date,
          status: records[sess._id.toString()] || 'absent'
        }))
      };
    });

    res.json({ success: true, subject, sessions, report });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @GET /api/attendance/student/:studentId
exports.getStudentAttendance = async (req, res) => {
  try {
    const student = await User.findById(req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (req.user.role === 'student' && req.user._id.toString() !== req.params.studentId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { subjectId, startDate, endDate } = req.query;
    const filter = { studentId: req.params.studentId };
    if (subjectId) filter.subjectId = subjectId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await Attendance.find(filter)
      .populate('subjectId', 'name code')
      .populate('sessionId', 'date startTime')
      .sort({ date: -1 });

    const bySubject = {};
    records.forEach(r => {
      const sid = r.subjectId?._id?.toString();
      if (!sid) return;
      if (!bySubject[sid]) {
        bySubject[sid] = { subject: r.subjectId, total: 0, present: 0, absent: 0, records: [] };
      }
      bySubject[sid].total++;
      bySubject[sid][r.status]++;
      bySubject[sid].records.push(r);
    });

    const summary = Object.values(bySubject).map(s => ({
      ...s,
      percentage: s.total ? Math.round((s.present / s.total) * 100) : 0
    }));

    const overallTotal = records.length;
    const overallPresent = records.filter(r => r.status === 'present').length;

    res.json({
      success: true,
      student: { name: student.name, studentId: student.studentId },
      summary,
      overall: {
        total: overallTotal, present: overallPresent,
        absent: overallTotal - overallPresent,
        percentage: overallTotal ? Math.round((overallPresent / overallTotal) * 100) : 0
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @PUT /api/attendance/:id
exports.updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const attendance = await Attendance.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('studentId', 'name studentId');
    if (!attendance) return res.status(404).json({ success: false, message: 'Record not found' });

    const presentCount = await Attendance.countDocuments({ sessionId: attendance.sessionId, status: 'present' });
    await Session.findByIdAndUpdate(attendance.sessionId, { presentCount });

    res.json({ success: true, attendance });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};