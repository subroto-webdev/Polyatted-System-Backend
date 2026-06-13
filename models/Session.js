const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  shift: { type: String, enum: ['1st', '2nd'] }, // কোন shift-এর class
  date: { type: Date, default: Date.now },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  totalStudents: { type: Number, default: 0 },
  presentCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
