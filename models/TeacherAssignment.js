const mongoose = require('mongoose');

// One teacher can have MANY assignments across dept/semester/section/subject
const teacherAssignmentSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  section: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Prevent duplicate assignments
teacherAssignmentSchema.index(
  { teacherId: 1, departmentId: 1, semester: 1, section: 1, subjectId: 1 },
  { unique: true }
);

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
