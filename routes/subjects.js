const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/auth');

// GET all subjects (filtered)
router.get('/', protect, async (req, res) => {
  try {
    const { departmentId, semester, section, teacherId } = req.query;
    const filter = { isActive: true };
    if (departmentId) filter.departmentId = departmentId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (teacherId) filter.teacherId = teacherId;

    // Students only see subjects for their class
    if (req.user.role === 'student') {
      filter.departmentId = req.user.departmentId;
      filter.semester = req.user.semester;
      filter.section = req.user.section;
      filter.shift = req.user.shift;
    }
    // Teachers only see their own subjects
    if (req.user.role === 'teacher') {
      filter.teacherId = req.user._id;
      filter.shift = req.user.shift;
    }

    const subjects = await Subject.find(filter)
      .populate('departmentId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ semester: 1, name: 1 });
    res.json({ success: true, subjects });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST create subject (teacher or admin)
router.post('/', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { name, code, departmentId, semester, section } = req.body;
    if (!name || !code || !departmentId || !semester || !section) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const teacherId = req.user.role === 'teacher' ? req.user._id : req.body.teacherId;
    const shift = req.user.role === 'teacher' ? req.user.shift : req.body.shift;

    if (!shift) return res.status(400).json({ success: false, message: 'Shift required' });

    const existing = await Subject.findOne({ code, departmentId, semester: parseInt(semester), section, shift });
    if (existing) return res.status(400).json({ success: false, message: 'Subject code already exists for this class' });

    const subject = await Subject.create({ name, code, departmentId, semester: parseInt(semester), section, shift, teacherId });
    const populated = await Subject.findById(subject._id).populate('departmentId', 'name code').populate('teacherId', 'name email');
    res.status(201).json({ success: true, subject: populated });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// PUT update subject
router.put('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (req.user.role === 'teacher' && subject.teacherId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your subject' });
    }
    const updated = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('departmentId', 'name code').populate('teacherId', 'name email');
    res.json({ success: true, subject: updated });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// DELETE subject
router.delete('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'teacher' && subject.teacherId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your subject' });
    }
    await Subject.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Subject deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
