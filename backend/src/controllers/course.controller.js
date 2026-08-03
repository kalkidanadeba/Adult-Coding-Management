const { validationResult } = require('express-validator');
const { normalizeCourseLevel } = require('../utils/courseLevel.helpers');
const Certificate = require('../models/certificate.model');
const Course = require('../models/course.model');
const Enrollment = require('../models/enrollment.model');
const Lesson = require('../models/lesson.model');
const Quiz = require('../models/quiz.model');
const Result = require('../models/result.model');
const User = require('../models/user.model');
const {
  calculateEnrollmentProgress,
  syncLegacyEnrollmentsForUser
} = require('../utils/enrollment.helpers');

const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { title, code, description, category, isActive, level } = req.body;
    const normalizedCode = code.toUpperCase();
    const normalizedLevel = normalizeCourseLevel(level);

    const existingCourse = await Course.findOne({ code: normalizedCode });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'A course already exists with this code'
      });
    }

    const course = await Course.create({
      title,
      code: normalizedCode,
      description,
      category,
      isActive,
      ...(normalizedLevel !== undefined ? { level: normalizedLevel } : {})
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating course',
      error: error.message
    });
  }
};

const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching courses',
      error: error.message
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Get all courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching courses',
      error: error.message
    });
  }
};

const getAdminCourseById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    return res.json({
      success: true,
      course
    });
  } catch (error) {
    console.error('Get admin course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
};

const getCourseById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    return res.json({
      success: true,
      course
    });
  } catch (error) {
    console.error('Get course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
};

const updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const allowedFields = ['title', 'code', 'description', 'category', 'isActive', 'level'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) {
        return;
      }
      if (field === 'code') {
        updates[field] = req.body[field].toUpperCase();
        return;
      }
      if (field === 'level') {
        const normalizedLevel = normalizeCourseLevel(req.body[field]);
        if (normalizedLevel !== undefined) {
          updates[field] = normalizedLevel;
        }
        return;
      }
      updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one course field is required to update'
      });
    }

    if (updates.code) {
      const existingCourse = await Course.findOne({
        code: updates.code,
        _id: { $ne: req.params.id }
      });

      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'A course already exists with this code'
        });
      }
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    return res.json({
      success: true,
      message: 'Course updated successfully',
      course
    });
  } catch (error) {
    console.error('Update course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating course',
      error: error.message
    });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await Promise.all([
      User.updateMany(
        { enrolledCourses: course._id },
        { $pull: { enrolledCourses: course._id } }
      ),
      Certificate.deleteMany({ course: course._id }),
      Enrollment.deleteMany({ course: course._id }),
      Result.deleteMany({ course: course._id }),
      Quiz.deleteMany({ course: course._id }),
      Lesson.deleteMany({ course: course._id })
    ]);

    await course.deleteOne();

    return res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting course',
      error: error.message
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getAllCourses,
  getAdminCourseById,
  getCourseById,
  updateCourse,
  deleteCourse
};
