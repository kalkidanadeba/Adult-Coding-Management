const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    minlength: [2, 'Course title must be at least 2 characters'],
    maxlength: [100, 'Course title cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Course code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [2, 'Course code must be at least 2 characters'],
    maxlength: [20, 'Course code cannot exceed 20 characters'],
    match: [
      /^[A-Z0-9-]+$/,
      'Course code can only contain letters, numbers, and hyphens'
    ]
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
    minlength: [10, 'Course description must be at least 10 characters'],
    maxlength: [2000, 'Course description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner',
    trim: true
  },
  duration: {
    type: Number,
    min: [0, 'Course duration cannot be negative'],
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

courseSchema.set('toJSON', {
  transform(doc, ret) {
    if (ret.level == null || ret.level === '') {
      ret.level = 'Beginner';
    }
    return ret;
  }
});

module.exports = mongoose.model('Course', courseSchema);
