const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/user.model');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const adminExists = await User.findOne({ role: 'admin' });

    if (!adminExists) {
      await User.create({
        name: 'System Admin',
        email: 'admin@aclms.com', 
        password: 'Admin@123',
        role: 'admin'
      });
      console.log('✅ Admin created');
      console.log('📧 Email: admin@aclms.com');
      console.log('🔑 Password: Admin@123');
    } else {
      console.log('ℹ️ Admin already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedAdmin();
