const mongoose = require('mongoose');
const Department = require('./models/Department');
require('dotenv').config({ path: __dirname + '/.env' });

const departments = [
  { name: 'Computer Science & Technology', code: 'CST', isActive: true },
  { name: 'Electrical Technology', code: 'ET', isActive: true },
  { name: 'Civil Technology', code: 'CT', isActive: true },
  { name: 'Mechanical Technology', code: 'MT', isActive: true },
  { name: 'Electronics Technology', code: 'ECT', isActive: true },
  { name: 'Architecture & Interior Design', code: 'AID', isActive: true },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Department.deleteMany({});
  await Department.insertMany(departments);
  console.log('✅ Departments seeded successfully!');
  process.exit();
}

seed().catch(err => { console.error(err); process.exit(1); });