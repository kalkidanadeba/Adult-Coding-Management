const mongoose = require('mongoose');

const lessonContentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['text', 'list', 'code'],
      required: [true, 'Lesson content block type is required']
    },
    content: {
      type: String,
      trim: true
    },
    items: {
      type: [String],
      default: undefined
    },
    ordered: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      trim: true,
      maxlength: [50, 'Code language cannot exceed 50 characters']
    }
  },
  {
    _id: false
  }
);

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required']
    },
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
      minlength: [2, 'Lesson title must be at least 2 characters'],
      maxlength: [120, 'Lesson title cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Lesson description cannot exceed 1000 characters']
    },
    content: {
      type: String,
      required: [true, 'Lesson content is required'],
      trim: true,
      minlength: [1, 'Lesson content cannot be empty'],
      maxlength: [50000, 'Lesson content cannot exceed 50000 characters']
    },
    contentBlocks: {
      type: [lessonContentBlockSchema],
      default: []
    },
    videoUrl: {
      type: String,
      trim: true
    },
    resources: {
      type: [String],
      default: []
    },
    order: {
      type: Number,
      required: [true, 'Lesson order is required'],
      min: [1, 'Lesson order must be at least 1']
    },
    duration: {
      type: Number,
      min: [0, 'Lesson duration cannot be negative'],
      default: 0
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

lessonSchema.index({ course: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('Lesson', lessonSchema);
