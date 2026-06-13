const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

router.post('/scan', protect, authorize('teacher', 'admin'), ctrl.scanQR);
router.post('/manual', protect, authorize('teacher', 'admin'), ctrl.takeManualAttendance);
router.get('/session/:sessionId', protect, ctrl.getSessionAttendance);
router.get('/subject/:subjectId', protect, ctrl.getSubjectAttendance);
router.get('/student/:studentId', protect, ctrl.getStudentAttendance);
router.put('/:id', protect, authorize('teacher', 'admin'), ctrl.updateAttendance);

module.exports = router;
