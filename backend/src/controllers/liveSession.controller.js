const { validationResult } = require('express-validator');

const Course = require('../models/course.model');
const LiveSession = require('../models/liveSession.model');

const LIVE_SESSION_FIELDS = [
  'title',
  'startAt',
  'durationMinutes',
  'meetingUrl',
  'status'
];

const getInstructorLiveSessions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const query = { instructor: req.user.id };

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.courseId) {
      query.course = req.query.courseId;
    }

    const liveSessions = await LiveSession.find(query)
      .populate('course', 'title code')
      .sort({ startAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      count: liveSessions.length,
      liveSessions
    });
  } catch (error) {
    console.error('Get instructor live sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching live sessions',
      error: error.message
    });
  }
};

const createInstructorLiveSession = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    let course = null;
    if (req.body.courseId) {
      course = await Course.findById(req.body.courseId).select('_id');
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }
    }

    const liveSession = await LiveSession.create({
      instructor: req.user.id,
      course: course?._id || null,
      title: req.body.title,
      startAt: req.body.startAt,
      durationMinutes: req.body.durationMinutes,
      meetingUrl: req.body.meetingUrl,
      status: req.body.status || 'scheduled'
    });

    await liveSession.populate('course', 'title code');

    return res.status(201).json({
      success: true,
      message: 'Live session created successfully',
      liveSession
    });
  } catch (error) {
    console.error('Create instructor live session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating live session',
      error: error.message
    });
  }
};

const updateInstructorLiveSession = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const liveSession = await LiveSession.findOne({
      _id: req.params.id,
      instructor: req.user.id
    });

    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    const updates = {};

    LIVE_SESSION_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'courseId')) {
      if (req.body.courseId) {
        const course = await Course.findById(req.body.courseId).select('_id');
        if (!course) {
          return res.status(404).json({
            success: false,
            message: 'Course not found'
          });
        }
        updates.course = course._id;
      } else {
        updates.course = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one live session field is required to update'
      });
    }

    Object.assign(liveSession, updates);
    await liveSession.save();
    await liveSession.populate('course', 'title code');

    return res.json({
      success: true,
      message: 'Live session updated successfully',
      liveSession
    });
  } catch (error) {
    console.error('Update instructor live session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating live session',
      error: error.message
    });
  }
};

const deleteInstructorLiveSession = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const liveSession = await LiveSession.findOneAndDelete({
      _id: req.params.id,
      instructor: req.user.id
    });

    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    return res.json({
      success: true,
      message: 'Live session deleted successfully'
    });
  } catch (error) {
    console.error('Delete instructor live session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting live session',
      error: error.message
    });
  }
};

const updateInstructorLiveSessionStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const liveSession = await LiveSession.findOne({
      _id: req.params.id,
      instructor: req.user.id
    });

    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    liveSession.status = req.body.status;
    await liveSession.save();
    await liveSession.populate('course', 'title code');

    return res.json({
      success: true,
      message: 'Live session status updated successfully',
      liveSession
    });
  } catch (error) {
    console.error('Update instructor live session status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating live session status',
      error: error.message
    });
  }
};

module.exports = {
  getInstructorLiveSessions,
  createInstructorLiveSession,
  updateInstructorLiveSession,
  deleteInstructorLiveSession,
  updateInstructorLiveSessionStatus
};
