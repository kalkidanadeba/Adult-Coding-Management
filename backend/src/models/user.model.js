const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|io)$/i,
      'Please provide a valid email'
    ]
  },
  profilePhoto: {
    type: String,
    trim: true,
    default: null
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'instructor'],
    default: 'student'
  },
  enrolledCourses: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }],
    default: []
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    if (!this.isNew) {
      this.passwordChangedAt = Date.now();
    }

    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});


userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    name: this.name
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};


userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresInMinutes = parseInt(process.env.PASSWORD_RESET_EXPIRE_MINUTES, 10) || 10;

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + (expiresInMinutes * 60 * 1000);

  return resetToken;
};


userSchema.statics.findByEmail = async function(email) {
  const normalizedEmail = typeof email === 'string'
    ? email.trim().toLowerCase()
    : email;

  return this.findOne({ email: normalizedEmail }).select('+password');
};

module.exports = mongoose.model('User', userSchema);
