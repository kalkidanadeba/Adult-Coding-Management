const { validationResult } = require('express-validator');
const Result = require('../models/result.model');
const { ensureEnrollmentRecord } = require('../utils/enrollment.helpers');
const { isManagementRole } = require('../utils/role.helpers');

const getMyResults = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view personal results'
      });
    }

    const results = await Result.find({ student: req.user.id })
      .populate('course', 'title code')
      .populate('lesson', 'title order')
      .populate('quiz', 'title passingScore')
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Get my results error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching results',
      error: error.message
    });
  }
};

const getCourseResults = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const query = { course: req.params.courseId };

    if (req.user.role === 'student') {
      const enrollment = await ensureEnrollmentRecord(req.user.id, req.params.courseId);

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to view its results'
        });
      }

      query.student = req.user.id;
    }

    let resultsQuery = Result.find(query)
      .populate('course', 'title code')
      .populate('lesson', 'title order')
      .populate('quiz', 'title passingScore')
      .sort({ submittedAt: -1 });

    if (isManagementRole(req.user)) {
      resultsQuery = resultsQuery.populate('student', 'name email');
    }

    const results = await resultsQuery;

    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Get course results error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course results',
      error: error.message
    });
  }
};

module.exports = {
  getMyResults,
  getCourseResults
};
