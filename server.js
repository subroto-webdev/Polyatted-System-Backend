const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const path = require('path');

dotenv.config();
const app = express();

// ✅ Trust proxy FIRST
app.set('trust proxy', 1);

// General API rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.method === 'GET', // GET request count korbe na
});

// Login er jonno alada limit (brute force theke bachate)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/holidays', require('./routes/holidays'));
app.post('/api/feedback', require('./controllers/feedbackController').submitFeedback);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

module.exports = app;