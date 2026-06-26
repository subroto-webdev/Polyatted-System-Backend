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
    if (!origin) return callback(null, true);
    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app');
    if (isAllowed) {
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

// ===== AUTO SEED DEPARTMENTS =====
const autoSeedDepartments = async () => {
  try {
    const Department = require('./models/Department');
    const defaultDepartments = [
      { name: 'Computer Science & Technology', code: 'CST' },
      { name: 'Mechanical Technology', code: 'MT' },
      { name: 'Electronics Technology', code: 'ECT' },
      { name: 'Architecture & Interior Design', code: 'AID' },
      { name: 'RAC Technology', code: 'RAC' },
    ];

    const count = await Department.countDocuments();
    if (count === 0) {
      await Department.insertMany(
        defaultDepartments.map(d => ({ ...d, isActive: true }))
      );
      console.log('✅ Default departments seeded successfully!');
    } else {
      // নতুন department আছে কিনা check করো, না থাকলে add করো
      for (const dept of defaultDepartments) {
        const exists = await Department.findOne({ code: dept.code });
        if (!exists) {
          await Department.create({ ...dept, isActive: true });
          console.log(`✅ New department added: ${dept.name}`);
        }
      }
    }
  } catch (err) {
    console.error('⚠️ Department seed error:', err.message);
  }
};
// ===== END AUTO SEED =====

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  isConnected = true;
  console.log('✅ MongoDB Connected');

  // MongoDB connect হলেই auto seed চলবে
  await autoSeedDepartments();
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

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
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
