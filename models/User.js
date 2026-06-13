const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  shift: { type: String, enum: ['1st', '2nd'] },

  // Student fields
  studentId: { type: String, unique: true, sparse: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  semester: { type: Number, min: 1, max: 8 },
  section: { type: String, enum: ['A', 'B', 'C', 'D'] },
  qrCode: { type: String }, // base64 or URL

  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationOTP: { type: String, default: null },
  verificationExpire: { type: Date, default: null },
  resetPasswordOTP: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
