const express = require('express');
const router = express.Router();
const TeacherAssignment = require('../models/TeacherAssignment');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  const filter = { isActive: true };
  if (req.user.role === 'teacher') filter.teacherId = req.user._id;
  const assignments = await TeacherAssignment.find(filter)
    .populate('teacherId', 'name email')
    .populate('departmentId', 'name code')
    .populate('subjectId', 'name code');
  res.json({ success: true, assignments });
});
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const a = await TeacherAssignment.create(req.body);
    const populated = await TeacherAssignment.findById(a._id)
      .populate('teacherId', 'name').populate('departmentId', 'name code').populate('subjectId', 'name code');
    res.status(201).json({ success: true, assignment: populated });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  await TeacherAssignment.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Assignment removed' });
});
module.exports = router;
