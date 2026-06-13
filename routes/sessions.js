const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/sessionController');

router.post('/', protect, authorize('teacher', 'admin'), ctrl.createSession);
router.get('/', protect, ctrl.getSessions);
router.get('/:id', protect, ctrl.getSession);
router.put('/:id/end', protect, authorize('teacher', 'admin'), ctrl.endSession);
router.put('/:id/attendance', protect, authorize('teacher', 'admin'), ctrl.updateSessionAttendance);

module.exports = router;
