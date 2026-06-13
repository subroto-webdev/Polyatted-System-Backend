const User = require('../models/User');
const QRCode = require('qrcode');

// @GET /api/users - Admin: get all users
exports.getUsers = async (req, res) => {
  try {
    const { role, departmentId, semester, section, shift, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (departmentId) filter.departmentId = departmentId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (shift) filter.shift = shift;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } }
    ];

    // Teachers কেবল নিজের shift-এর student দেখতে পাবে
    if (req.user.role === 'teacher' && role === 'student') {
      filter.shift = req.user.shift;
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name code');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, departmentId, semester, section, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, departmentId, semester, section, isActive },
      { new: true, runValidators: true }
    ).select('-password').populate('departmentId', 'name code');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/users/students/section - Get students by dept/sem/section (with shift)
exports.getStudentsBySection = async (req, res) => {
  try {
    const { departmentId, semester, section, shift } = req.query;
    const filter = {
      role: 'student',
      departmentId,
      semester: parseInt(semester),
      section,
      isActive: true
    };
    // shift থাকলে filter করো, না থাকলে সব দেখাও
    if (shift) filter.shift = shift;

    const students = await User.find(filter)
      .select('-password')
      .populate('departmentId', 'name code');
    res.json({ success: true, count: students.length, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/users/qr/:studentId - Get student QR code
exports.getStudentQR = async (req, res) => {
  try {
    const user = await User.findOne({ studentId: req.params.studentId, role: 'student' });
    if (!user) return res.status(404).json({ success: false, message: 'Student not found' });

    if (!user.qrCode) {
      const qrData = JSON.stringify({ studentId: user._id.toString(), sid: user.studentId });
      user.qrCode = await QRCode.toDataURL(qrData);
      await user.save();
    }
    res.json({ success: true, qrCode: user.qrCode, studentId: user.studentId, name: user.name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
