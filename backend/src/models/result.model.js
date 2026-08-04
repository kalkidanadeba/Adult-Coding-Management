const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Question id is required']
    },
    selectedOption: {
      type: Number,
      default: null,
      min: [0, 'Selected option cannot be negative']
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

const resultSchema = new mongoose.Schema(
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
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz is required']
    },
    answers: {
      type: [answerSchema],
      default: []
    },
    totalQuestions: {
      type: Number,
      required: [true, 'Total questions is required'],
      min: [0, 'Total questions cannot be negative']
    },
    correctAnswers: {
      type: Number,
      required: [true, 'Correct answers count is required'],
      min: [0, 'Correct answers cannot be negative']
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative']
    },
    totalPoints: {
      type: Number,
      required: [true, 'Total points is required'],
      min: [0, 'Total points cannot be negative']
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percentage cannot be below 0'],
      max: [100, 'Percentage cannot exceed 100']
    },
    passed: {
      type: Boolean,
      default: false
    },
    attemptNumber: {
      type: Number,
      required: [true, 'Attempt number is required'],
      min: [1, 'Attempt number must be at least 1']
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

resultSchema.index({ student: 1, quiz: 1, attemptNumber: 1 });

module.exports = mongoose.model('Result', resultSchema);
