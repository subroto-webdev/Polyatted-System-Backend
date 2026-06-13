require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  await mongoose.connection.collection('users').updateOne(
    { role: 'admin' },
    { $set: { active: true } }
  );

  console.log('Done');
  process.exit(0);
}

run();