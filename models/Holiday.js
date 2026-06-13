const mongoose = require('mongoose');
const holidaySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['friday', 'eid', 'puja', 'national', 'semester_break', 'other'], default: 'other' },
  recurring: { type: Boolean, default: false },
  description: { type: String },
}, { timestamps: true });
module.exports = mongoose.model('Holiday', holidaySchema);
