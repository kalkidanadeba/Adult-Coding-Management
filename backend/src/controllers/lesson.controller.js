const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Enrollment = require('../models/enrollment.model');
const Lesson = require('../models/lesson.model');
const Quiz = require('../models/quiz.model');
const Result = require('../models/result.model');
const {
  calculateEnrollmentProgress,
  ensureEnrollmentRecord
} = require('../utils/enrollment.helpers');
const {
  buildCertificateRenderPayload,
  issueCourseCertificateIfEligible
} = require('../utils/certificate.helpers');
const {
  ensureLessonContentBlocks,
  resolveLessonContentFields
} = require('../utils/lessonContent.helpers');
const { persistLessonResources } = require('../utils/fileUpload.helpers');
const { isManagementRole } = require('../utils/role.helpers');

const updateCourseDuration = async (courseId) => {
  if (!courseId) {
    return;
  }

  const aggregation = await Lesson.aggregate([
    { $match: { course: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: '$course', totalDuration: { $sum: '$duration' } } }
  ]);

  const totalDuration = aggregation.length > 0 ? aggregation[0].totalDuration : 0;
  await Course.findByIdAndUpdate(courseId, { duration: totalDuration }, { runValidators: true });
};

const createLesson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      course,
      title,
      description,
      videoUrl,
      resources,
      order,
      duration,
      isPublished
    } = req.body;
    const contentFields = resolveLessonContentFields(req.body, { required: true });

    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const existingOrder = await Lesson.findOne({ course, order });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'A lesson already exists with this order in the selected course'
      });
    }

    const persistedResources = await persistLessonResources(resources);

    const lesson = await Lesson.create({
      course,
      title,
      description,
      content: contentFields.content,
      contentBlocks: contentFields.contentBlocks,
      videoUrl,
      resources: persistedResources,
      order,
      duration,
      isPublished
    });

    await updateCourseDuration(course);

    return res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson: ensureLessonContentBlocks(lesson)
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating lesson',
      error: error.message
    });
  }
};

const getAllLessons = async (req, res) => {
  try {
    const query = {};

    if (req.query.courseId) {
      query.course = req.query.courseId;
    }

    const lessons = await Lesson.find(query)
      .populate('course', 'title code')
      .sort({ course: 1, order: 1, createdAt: -1 });

    return res.json({
      success: true,
      count: lessons.length,
      lessons: lessons.map(ensureLessonContentBlocks)
    });
  } catch (error) {
    console.error('Get all lessons error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching lessons',
      error: error.message
    });
  }
};

const getAdminLessonsByCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const lessons = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 });

    return res.json({
      success: true,
      course,
      count: lessons.length,
      lessons: lessons.map(ensureLessonContentBlocks)
    });
  } catch (error) {
    console.error('Get admin lessons by course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course lessons',
      error: error.message
    });
  }
};

const getLessonsByCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findOne({
      _id: req.params.courseId,
      isActive: true
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    let enrollment = null;

    if (!isManagementRole(req.user)) {
      enrollment = await ensureEnrollmentRecord(req.user.id, course._id);

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to access lessons'
        });
      }
    }

    const lessonQuery = { course: course._id };
    if (!isManagementRole(req.user)) {
      lessonQuery.isPublished = true;
    }

    const lessons = await Lesson.find(lessonQuery).sort({ order: 1, createdAt: 1 });
    const completedLessonIds = new Set(
      (enrollment?.completedLessons || []).map((lessonId) => lessonId.toString())
    );
    const lessonsWithCompletion = lessons.map((lesson) => ({
      ...ensureLessonContentBlocks(lesson),
      isCompleted: completedLessonIds.has(lesson._id.toString())
    }));

    return res.json({
      success: true,
      count: lessons.length,
      lessons: lessonsWithCompletion
    });
  } catch (error) {
    console.error('Get lessons by course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course lessons',
      error: error.message
    });
  }
};

const getAdminLessonById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lesson = await Lesson.findById(req.params.id)
      .populate('course', 'title code category isActive');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    return res.json({
      success: true,
      lesson: ensureLessonContentBlocks(lesson)
    });
  } catch (error) {
    console.error('Get admin lesson by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching lesson',
      error: error.message
    });
  }
};

const getLessonById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lesson = await Lesson.findById(req.params.id).populate('course', 'title code isActive');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    if (!isManagementRole(req.user)) {
      if (!lesson.course || !lesson.course.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Lesson not found'
        });
      }

      if (!lesson.isPublished) {
        return res.status(404).json({
          success: false,
          message: 'Lesson not found'
        });
      }

      const enrollment = await ensureEnrollmentRecord(req.user.id, lesson.course._id);
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to access this lesson'
        });
      }
    }

    return res.json({
      success: true,
      lesson: ensureLessonContentBlocks(lesson)
    });
  } catch (error) {
    console.error('Get lesson by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching lesson',
      error: error.message
    });
  }
};

const updateLesson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const originalCourseId = lesson.course ? lesson.course.toString() : null;
    const updates = {};
    const contentFields = resolveLessonContentFields(req.body);
    const allowedFields = [
      'course',
      'title',
      'description',
      'videoUrl',
      'resources',
      'order',
      'duration',
      'isPublished'
    ];

    for (const field of allowedFields) {
      if (req.body[field] === undefined) {
        continue;
      }

      if (field === 'resources') {
        updates.resources = await persistLessonResources(req.body.resources);
        continue;
      }

      updates[field] = req.body[field];
    }

    if (contentFields) {
      updates.content = contentFields.content;
      updates.contentBlocks = contentFields.contentBlocks;
    }

    if (updates.course) {
      const courseExists = await Course.findById(updates.course);
      if (!courseExists) {
        return res.status(404).json({
          success: false,
          message: 'Target course not found'
        });
      }
    }

    const targetCourseId = updates.course || lesson.course;
    const targetOrder = updates.order || lesson.order;

    const existingOrder = await Lesson.findOne({
      course: targetCourseId,
      order: targetOrder,
      _id: { $ne: lesson._id }
    });

    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'A lesson already exists with this order in the selected course'
      });
    }

    Object.assign(lesson, updates);
    await lesson.save();

    const updatedCourseId = lesson.course ? lesson.course.toString() : null;
    await Promise.all([
      updateCourseDuration(originalCourseId),
      updateCourseDuration(updatedCourseId)
    ]);

    return res.json({
      success: true,
      message: 'Lesson updated successfully',
      lesson: ensureLessonContentBlocks(lesson)
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating lesson',
      error: error.message
    });
  }
};

const deleteLesson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const lessonQuizzes = await Quiz.find({ lesson: lesson._id }).select('_id');
    const lessonQuizIds = lessonQuizzes.map((quiz) => quiz._id);

    await Promise.all([
      Enrollment.updateMany(
        { completedLessons: lesson._id },
        { $pull: { completedLessons: lesson._id } }
      ),
      Result.deleteMany({
        $or: [
          { lesson: lesson._id },
          { quiz: { $in: lessonQuizIds } }
        ]
      }),
      Quiz.deleteMany({ lesson: lesson._id })
    ]);

    const courseId = lesson.course ? lesson.course.toString() : null;
    await lesson.deleteOne();
    await updateCourseDuration(courseId);

    return res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error) {
    console.error('Delete lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting lesson',
      error: error.message
    });
  }
};

const markLessonComplete = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can complete lessons'
      });
    }

    const lesson = await Lesson.findOne({
      _id: req.params.id,
      isPublished: true
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const enrollment = await ensureEnrollmentRecord(req.user.id, lesson.course);
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to complete lessons'
      });
    }

    enrollment.completedLessons.addToSet(lesson._id);
    enrollment.lastAccessedAt = new Date();
    enrollment.lastCompletedAt = new Date();

    const progressSnapshot = await calculateEnrollmentProgress(enrollment);
    enrollment.progress = progressSnapshot.progress;
    enrollment.status = progressSnapshot.status;
    await enrollment.save();
    const { certificate } = await issueCourseCertificateIfEligible(
      req.user.id,
      lesson.course,
      { enrollment }
    );

    return res.json({
      success: true,
      message: 'Lesson marked as completed',
      enrollment: {
        id: enrollment._id,
        course: enrollment.course,
        progress: progressSnapshot.progress,
        status: progressSnapshot.status,
        completedLessonsCount: progressSnapshot.completedLessonsCount,
        totalLessons: progressSnapshot.totalLessons
      },
      certificate: certificate ? buildCertificateRenderPayload(certificate) : null
    });
  } catch (error) {
    console.error('Mark lesson complete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error completing lesson',
      error: error.message
    });
  }
};

module.exports = {
  createLesson,
  getAllLessons,
  getAdminLessonsByCourse,
  getLessonsByCourse,
  getAdminLessonById,
  getLessonById,
  updateLesson,
  deleteLesson,
  markLessonComplete
};
