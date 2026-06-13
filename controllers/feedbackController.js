const Feedback = require('../models/Feedback');
const sendEmail = require('../utils/sendEmail');

exports.submitFeedback = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'সবগুলো ফিল্ড পূরণ করুন' });
    }

    await Feedback.create({ name, email, message });

    await sendEmail({
      email: process.env.SMTP_USER,
      subject: `PolyAttend Feedback — ${name}`,
      message: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1a6b4a;">New Feedback — PolyAttend</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p><strong>Message:</strong></p>
          <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${message}</p>
        </div>
      `
    });

    res.status(201).json({ success: true, message: 'ফিডব্যাক সফলভাবে জমা দেওয়া হয়েছে! ধন্যবাদ।' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};