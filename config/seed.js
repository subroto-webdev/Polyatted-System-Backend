const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

// 🚫 PRODUCTION-এ SEED বন্ধ
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seed script production-এ রান করা যাবে না!');
  console.error('⚠️  এটি শুধুমাত্র development/testing এর জন্য।');
  process.exit(1);
}

const User = require('../models/User');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const QRCode = require('qrcode');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/polyattend';

const departments = [
  { name: 'Computer Science & Technology', code: 'CST', description: 'Programming, Database, Networks' },
  { name: 'Electrical Technology', code: 'ET', description: 'Circuits, Power Systems' },
  { name: 'Civil Technology', code: 'CVT', description: 'Construction, Structures' },
  { name: 'Mechanical Technology', code: 'MT', description: 'Machines, Manufacturing' },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // ✅ পুরনো data মুছবে না — শুধু না থাকলে তৈরি করবে

    // Departments — code দিয়ে check
    const deptResults = [];
    for (const dept of departments) {
      const existing = await Department.findOne({ code: dept.code });
      if (existing) {
        console.log('Department already exists: ' + dept.code);
        deptResults.push(existing);
      } else {
        const created = await Department.create(dept);
        console.log('Department created: ' + dept.code);
        deptResults.push(created);
      }
    }
    const cst = deptResults.find(d => d.code === 'CST');

    // Admin
    const existingAdmin = await User.findOne({ email: 'admin@poly.edu' });
    if (existingAdmin) {
      console.log('Admin already exists, skipping');
    } else {
      await User.create({ name: 'System Admin', email: 'admin@poly.edu', password: 'admin123', role: 'admin', isActive: true });
      console.log('Admin created');
    }

    // Teacher 1
    let teacher1 = await User.findOne({ email: 'rahim@poly.edu' });
    if (teacher1) {
      console.log('Teacher 1 already exists, skipping');
    } else {
      teacher1 = await User.create({ name: 'Md. Abdur Rahim', email: 'rahim@poly.edu', password: 'teacher123', role: 'teacher', isActive: true });
      console.log('Teacher 1 created');
    }

    // Teacher 2
    let teacher2 = await User.findOne({ email: 'fatema@poly.edu' });
    if (teacher2) {
      console.log('Teacher 2 already exists, skipping');
    } else {
      teacher2 = await User.create({ name: 'Ms. Fatema Khatun', email: 'fatema@poly.edu', password: 'teacher123', role: 'teacher', isActive: true });
      console.log('Teacher 2 created');
    }

    // Subjects — code দিয়ে check
    const subjectsData = [
      { name: 'Data Structure', code: 'CST-301', departmentId: cst._id, semester: 3, section: 'A', teacherId: teacher1._id },
      { name: 'Database Management', code: 'CST-302', departmentId: cst._id, semester: 3, section: 'A', teacherId: teacher1._id },
      { name: 'Web Technology', code: 'CST-303', departmentId: cst._id, semester: 3, section: 'A', teacherId: teacher2._id },
      { name: 'Operating System', code: 'CST-304', departmentId: cst._id, semester: 5, section: 'B', teacherId: teacher2._id },
    ];

    for (const sub of subjectsData) {
      const existing = await Subject.findOne({ code: sub.code });
      if (existing) {
        console.log('Subject already exists: ' + sub.code);
      } else {
        await Subject.create(sub);
        console.log('Subject created: ' + sub.code);
      }
    }

    // Students — email দিয়ে check
    const studentData = [
      { name: 'Fahim Ahmed', email: 'fahim@poly.edu', studentId: 'CST-21-001', semester: 3, section: 'A' },
      { name: 'Nadia Islam', email: 'nadia@poly.edu', studentId: 'CST-21-002', semester: 3, section: 'A' },
      { name: 'Rakib Hasan', email: 'rakib@poly.edu', studentId: 'CST-21-003', semester: 3, section: 'A' },
      { name: 'Sumaiya Akter', email: 'sumaiya@poly.edu', studentId: 'CST-21-004', semester: 3, section: 'A' },
      { name: 'Tanvir Mahmud', email: 'tanvir@poly.edu', studentId: 'CST-21-005', semester: 3, section: 'A' },
    ];

    for (const sd of studentData) {
      const existing = await User.findOne({ email: sd.email });
      if (existing) {
        console.log('Student already exists: ' + sd.email);
      } else {
        const student = await User.create({ ...sd, password: 'student123', role: 'student', departmentId: cst._id, isActive: true });
        const qrData = JSON.stringify({ studentId: student._id.toString(), sid: student.studentId });
        student.qrCode = await QRCode.toDataURL(qrData);
        await student.save();
        console.log('Student created: ' + sd.email);
      }
    }

    console.log('\nSeed complete! (পুরনো data অক্ষত আছে)');
    console.log('Demo Accounts:');
    console.log('  Admin:   admin@poly.edu / admin123');
    console.log('  Teacher: rahim@poly.edu / teacher123');
    console.log('  Student: fahim@poly.edu / student123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();