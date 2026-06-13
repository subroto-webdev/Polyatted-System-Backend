const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.get('/generate/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'student') return res.status(404).json({ success: false, message: 'Student not found' });
    const qrData = JSON.stringify({ studentId: user._id.toString(), sid: user.studentId });
    const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    if (!user.qrCode) { user.qrCode = qrCode; await user.save(); }
    res.json({ success: true, qrCode, studentId: user.studentId, name: user.name });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
module.exports = router;
