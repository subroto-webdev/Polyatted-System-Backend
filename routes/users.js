const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.get('/', protect, authorize('admin', 'teacher'), ctrl.getUsers);
router.get('/section', protect, ctrl.getStudentsBySection);
router.get('/qr/:studentId', protect, ctrl.getStudentQR);
router.get('/:id', protect, ctrl.getUser);
router.put('/:id', protect, authorize('admin'), ctrl.updateUser);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteUser);

module.exports = router;
