const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { protect, authorize } = require('../middleware/auth');

// Public - for registration
router.get('/public', async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).select('name code description').sort('name');
    res.json({ success: true, departments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Protected routes
router.get('/', protect, async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).sort('name');
    res.json({ success: true, departments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, department: dept });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, department: dept });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Department.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
