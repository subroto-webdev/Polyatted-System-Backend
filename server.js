const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const path = require('path');

dotenv.config();
const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:3000',
  'https://polytechnic-attendance-system2026.netlify.app',
  'https://polyatted-system-frontend.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.method === 'GET',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB — serverless এর জন্য cached connection
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  isConnected = true;
  console.log('✅ MongoDB Connected');
};

// ✅ সব request এর আগে DB connect করো
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// Routes
app.use('/api/auth',        authLimiter, require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/subjects',    require('./routes/subjects'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/sessions',    require('./routes/sessions'));
app.use('/api/attendance',  require('./routes/attendance'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/qr',          require('./routes/qr'));
app.use('/api/holidays',    require('./routes/holidays'));
app.post('/api/feedback',   require('./controllers/feedbackController').submitFeedback);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ✅ app.listen() সরানো হয়েছে — Vercel এ লাগে না
module.exports = app;