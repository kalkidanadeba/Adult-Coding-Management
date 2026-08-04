const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      minlength: [3, 'Question text must be at least 3 characters'],
      maxlength: [500, 'Question text cannot exceed 500 characters']
    },
    options: {
      type: [String],
      validate: {
        validator: (options) => Array.isArray(options) && options.length >= 2,
        message: 'Each question must have at least 2 options'
      }
    },
    correctAnswer: {
      type: Number,
      required: [true, 'Correct answer index is required'],
      min: [0, 'Correct answer index cannot be negative']
    },
    points: {
      type: Number,
      default: 1,
      min: [1, 'Question points must be at least 1']
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [1000, 'Question explanation cannot exceed 1000 characters']
    }
  },
  {
    _id: true
  }
);

const quizSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required']
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      minlength: [2, 'Quiz title must be at least 2 characters'],
      maxlength: [120, 'Quiz title cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Quiz description cannot exceed 1000 characters']
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (questions) => Array.isArray(questions) && questions.length > 0,
        message: 'Quiz must contain at least 1 question'
      }
    },
    passingScore: {
      type: Number,
      default: 50,
      min: [0, 'Passing score cannot be below 0'],
      max: [100, 'Passing score cannot exceed 100']
    },
    timeLimitMinutes: {
      type: Number,
      min: [1, 'Time limit must be at least 1 minute']
    },
    isPublished: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Quiz', quizSchema);
