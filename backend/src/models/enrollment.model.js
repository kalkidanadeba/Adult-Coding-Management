const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    },
    completedLessons: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Lesson'
        }
      ],
      default: []
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be below 0'],
      max: [100, 'Progress cannot exceed 100']
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now
    },
    lastCompletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
