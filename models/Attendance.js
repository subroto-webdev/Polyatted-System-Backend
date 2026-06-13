const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  className: {
    type: String,
    trim: true,
    required: true,
    default: function () {
      if (this.semester != null && this.section != null && this.section !== '') {
        return `Class ${this.semester}-${this.section}`;
      }
      return 'Class unknown';
    },
  },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent'], default: 'present' },
  scannedAt: { type: Date },
}, { timestamps: true });

// Prevent duplicate attendance per session per student
attendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
