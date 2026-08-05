const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor is required']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  title: {
    type: String,
    required: [true, 'Live session title is required'],
    trim: true,
    minlength: [2, 'Live session title must be at least 2 characters'],
    maxlength: [120, 'Live session title cannot exceed 120 characters']
  },
  startAt: {
    type: Date,
    required: [true, 'Start date and time is required']
  },
  durationMinutes: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  meetingUrl: {
    type: String,
    required: [true, 'Meeting URL is required'],
    trim: true,
    maxlength: [1000, 'Meeting URL cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

liveSessionSchema.index({ instructor: 1, startAt: -1 });
liveSessionSchema.index({ course: 1, startAt: -1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
