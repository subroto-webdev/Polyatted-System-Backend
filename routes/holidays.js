const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ startDate: 1 });
    res.json({ success: true, holidays });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/check', protect, async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = new Date(date);
    if (checkDate.getDay() === 5) return res.json({ success: true, isHoliday: true, reason: 'Friday' });
    const holiday = await Holiday.findOne({ startDate: { $lte: checkDate }, endDate: { $gte: checkDate } });
    res.json({ success: true, isHoliday: !!holiday, holiday: holiday || null });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.create(req.body);
    res.status(201).json({ success: true, holiday });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, holiday });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
