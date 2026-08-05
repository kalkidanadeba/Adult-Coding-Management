const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/user.model');

dotenv.config();

const seedInstructor = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const instructorExists = await User.findOne({ role: 'instructor', email: 'instructor@aclms.com' });

    if (!instructorExists) {
      await User.create({
        name: 'System Instructor',
        email: 'instructor@aclms.com',
        password: 'Instructor@123',
        role: 'instructor'
      });
      console.log('✅ Instructor created');
      console.log('📧 Email: instructor@aclms.com');
      console.log('🔑 Password: Instructor@123');
    } else {
      console.log('ℹ️ Instructor already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedInstructor();
