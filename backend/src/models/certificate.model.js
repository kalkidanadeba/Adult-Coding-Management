const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required']
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required']
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment'
    },
    certificateNumber: {
      type: String,
      required: [true, 'Certificate number is required'],
      unique: true,
      trim: true
    },
    verificationCode: {
      type: String,
      required: [true, 'Verification code is required'],
      unique: true,
      trim: true
    },
    studentName: {
      type: String,
      required: [true, 'Student name snapshot is required'],
      trim: true
    },
    courseTitle: {
      type: String,
      required: [true, 'Course title snapshot is required'],
      trim: true
    },
    courseCode: {
      type: String,
      trim: true
    },
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    providerName: {
      type: String,
      required: [true, 'Provider name is required'],
      trim: true
    },
    signatureName: {
      type: String,
      trim: true
    },
    signatureRole: {
      type: String,
      trim: true
    },
    templateKey: {
      type: String,
      default: 'keradion-classic',
      trim: true
    },
    totalLessons: {
      type: Number,
      default: 0,
      min: [0, 'Total lessons cannot be negative']
    },
    totalQuizzes: {
      type: Number,
      default: 0,
      min: [0, 'Total quizzes cannot be negative']
    },
    completionDate: {
      type: Date,
      required: [true, 'Completion date is required']
    },
    issuedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
