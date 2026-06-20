const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = 'mongodb://new-attendence:z9ace7S5JCX5nkAk@ac-4anr9xa-shard-00-00.eygeuzn.mongodb.net:27017,ac-4anr9xa-shard-00-01.eygeuzn.mongodb.net:27017,ac-4anr9xa-shard-00-02.eygeuzn.mongodb.net:27017/school-attendence?ssl=true&replicaSet=atlas-8houp0-shard-0&authSource=admin&retryWrites=true&w=majority';

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const existing = await User.findOne({ email: 'student0cse11@gmail.com' });
    if (existing) {
      console.log('Admin already exists!');
      process.exit(0);
    }

    const admin = new User({
      name: 'Super Admin',
      email: 'student0cse11@gmail.com',
      password: 'P@lyAtt3nd#2026',
      role: 'admin',
      isActive: true,
      isVerified: true,
    });

    await admin.save();
    console.log('✅ Admin created!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

seedAdmin();