const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  section: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  shift: { type: String, enum: ['1st', '2nd'], required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
