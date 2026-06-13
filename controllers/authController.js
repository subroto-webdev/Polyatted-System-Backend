const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');
const QRCode = require('qrcode');
const sendEmail = require('../utils/sendEmail');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });

    const user = await User.findOne({ email }).populate('departmentId', 'name code');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });



    if (!(await user.matchPassword(password))) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(user._id);
    res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role, shift: user.shift, studentId: user.studentId, departmentId: user.departmentId, semester: user.semester, section: user.section, qrCode: user.qrCode } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('departmentId', 'name code');
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Public registration — student & teacher only
exports.registerPublic = async (req, res) => {
  try {
    const { name, email, password, role, studentId, departmentId, semester, section, shift } = req.body;
    if (!['student', 'teacher'].includes(role)) return res.status(400).json({ success: false, message: 'Only student or teacher can register.' });
    if (!name || !email || !password || !role) return res.status(400).json({ success: false, message: 'Name, email, password ও role দিন' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password কমপক্ষে ৬ অক্ষরের হতে হবে' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'এই email দিয়ে আগেই account আছে' });

    if (role === 'teacher') {
      if (!shift) return res.status(400).json({ success: false, message: 'Shift দিন' });
    }
    if (role === 'teacher') {
      if (!req.body.secretKey) return res.status(403).json({ success: false, message: 'Teacher Secret Key দিন' });
      if (req.body.secretKey !== process.env.TEACHER_SECRET_KEY) return res.status(403).json({ success: false, message: 'Secret Key সঠিক নয়!' });
      if (!shift) return res.status(400).json({ success: false, message: 'Shift দিন' });
    }

    if (role === 'student') {
      if (!studentId || !departmentId || !semester || !section || !shift) return res.status(400).json({ success: false, message: 'Student ID, Department, Semester, Section ও Shift দিন' });
      const existingStudent = await User.findOne({ studentId });
      if (existingStudent) return res.status(400).json({ success: false, message: 'এই Student ID আগেই registered' });
    }

    // Generate 6-digit verification OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({
      name,
      email,
      password,
      role,
      studentId: role === 'student' ? studentId : undefined,
      departmentId: role === 'student' ? departmentId : undefined,
      semester: role === 'student' ? parseInt(semester) : undefined,
      section: role === 'student' ? section : undefined,
      shift: shift,
      isVerified: false,
      verificationOTP: otp,
      verificationExpire: otpExpire
    });

    if (role === 'student' && studentId) {
      const qrData = JSON.stringify({ studentId: user._id.toString(), sid: studentId });
      user.qrCode = await QRCode.toDataURL(qrData);
      await user.save();
    }

    // Send verification OTP email
    const subject = 'PolyAttend Email Verification Code';
    const message = `Hello ${name},\n\nWelcome to PolyAttend. Please use the following One-Time Password (OTP) to verify your email address:\n\nVerification Code: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not register for this account, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1a6b4a; text-align: center;">Welcome to PolyAttend</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering at PolyAttend. To complete your registration, please verify your email address using the following code:</p>
        <div style="background-color: #f0fdf4; border: 2px dashed #1a6b4a; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #1a6b4a; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code is valid for 10 minutes. If you did not create this account, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">PolyAttend Management System</p>
      </div>
    `;

    await sendEmail({ email: user.email, subject, message, html });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for the verification code.',
      email: user.email,
      requiresVerification: true
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Admin registration — auto verify
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, studentId, departmentId, semester, section, shift } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, role, studentId, departmentId, semester, section, shift, isVerified: true });

    if (role === 'student' && studentId) {
      const qrData = JSON.stringify({ studentId: user._id.toString(), sid: studentId });
      user.qrCode = await QRCode.toDataURL(qrData);
      await user.save();
    }
    res.status(201).json({ success: true, message: 'User created successfully', user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Change password (inside dashboard)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword))) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Send OTP for Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'ইমেইল এড্রেস দিন' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'অ্যাকাউন্টটি ডিঅ্যাক্টিভেটেড আছে' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    // Send email
    const subject = 'PolyAttend Password Reset OTP';
    const message = `Hello ${user.name},\n\nYou requested to reset your password. Please use the following 6-digit OTP to proceed:\n\nOTP Code: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1a6b4a; text-align: center;">Reset Your Password</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>We received a request to reset your password. Use the following 6-digit OTP code to complete the process:</p>
        <div style="background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #b45309; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code is valid for 10 minutes. If you did not request this reset, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">PolyAttend Management System</p>
      </div>
    `;

    await sendEmail({ email: user.email, subject, message, html });

    res.json({ success: true, message: 'পাসওয়ার্ড রিসেট OTP ইমেইলে পাঠানো হয়েছে' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Verify OTP & Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'সবগুলো তথ্য দিন' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'ভুল OTP অথবা ওটিপির মেয়াদ শেষ হয়ে গেছে' });

    user.password = newPassword;
    user.isVerified = true; // Mark as verified on successful password reset
    user.resetPasswordOTP = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Verify OTP for Email Verification (Registration)
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'ইমেইল ও OTP দিন' });

    const user = await User.findOne({
      email,
      verificationOTP: otp,
      verificationExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'ভুল OTP অথবা ওটিপির মেয়াদ শেষ হয়ে গেছে' });

    user.isVerified = true;
    user.verificationOTP = null;
    user.verificationExpire = null;
    await user.save();

    res.json({ success: true, message: 'ইমেইল ভেরিফিকেশন সফল হয়েছে! আপনি এখন লগইন করতে পারবেন।' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// এই function টা authController.js-এ যোগ করো (শেষে paste করো)

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'ইমেইল দিন' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'এই ইমেইলে কোনো account নেই' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'এই account ইতিমধ্যে verified' });

    // Rate limit: আগের OTP যদি এখনো ৮ মিনিট বাকি থাকে তাহলে আবার পাঠাবে না
    const remaining = user.verificationExpire
      ? user.verificationExpire.getTime() - Date.now()
      : 0;
    if (remaining > 2 * 60 * 1000) {
      const mins = Math.ceil(remaining / 60000);
      return res.status(429).json({
        success: false,
        message: `অনুগ্রহ করে ${mins} মিনিট অপেক্ষা করুন`
      });
    }

    // নতুন OTP generate করো
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationOTP = otp;
    user.verificationExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    const subject = 'PolyAttend — নতুন Verification Code';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #1a6b4a; text-align: center;">Email Verification</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>আপনার নতুন verification code:</p>
        <div style="background-color: #f0fdf4; border: 2px dashed #1a6b4a; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; color: #1a6b4a; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">এই code ১০ মিনিট valid।</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">PolyAttend Management System</p>
      </div>
    `;

    await sendEmail({ email: user.email, subject, message: `Your new OTP: ${otp}`, html });

    res.json({ success: true, message: 'নতুন OTP পাঠানো হয়েছে' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};