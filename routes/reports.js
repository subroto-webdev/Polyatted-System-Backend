const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.get('/subject/:subjectId', protect, ctrl.subjectReport);
router.get('/student/:studentId', protect, ctrl.studentReport);
router.get('/class/:sessionId', protect, ctrl.classReport);

module.exports = router;
