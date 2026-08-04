const { validationResult } = require('express-validator');
const Course = require('../models/course.model');
const Certificate = require('../models/certificate.model');
const Enrollment = require('../models/enrollment.model');
const User = require('../models/user.model');
const {
  calculateEnrollmentProgress,
  syncLegacyEnrollmentsForUser
} = require('../utils/enrollment.helpers');
const {
  buildCertificateEligibilityPayload,
  buildCertificateRenderPayload,
  getCertificateEligibilitySnapshot
} = require('../utils/certificate.helpers');

const enrollInCourse = async (req, res) => {
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
        message: 'Only students can enroll in courses'
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

    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Student is already enrolled in this course'
      });
    }

    const user = await User.findById(req.user.id);
    user.enrolledCourses.addToSet(course._id);
    await user.save();

    const enrollment = await Enrollment.create({
      student: req.user.id,
      course: course._id,
      lastAccessedAt: new Date()
    });

    const progressSnapshot = await calculateEnrollmentProgress(enrollment);
    enrollment.progress = progressSnapshot.progress;
    enrollment.status = progressSnapshot.status;
    await enrollment.save();

    const updatedUser = await User.findById(req.user.id).select('name email role enrolledCourses');

    return res.json({
      success: true,
      message: 'Course enrolled successfully',
      user: updatedUser,
      enrollment: {
        id: enrollment._id,
        course: enrollment.course,
        progress: progressSnapshot.progress,
        status: progressSnapshot.status
      }
    });
  } catch (error) {
    console.error('Enroll course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error enrolling in course',
      error: error.message
    });
  }
};

const getMyCourses = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view enrolled courses'
      });
    }

    await syncLegacyEnrollmentsForUser(req.user.id);

    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate({
        path: 'course',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 });
    const existingCertificates = await Certificate.find({ student: req.user.id }).lean();
    const certificatesByCourse = new Map(
      existingCertificates.map((certificate) => [certificate.course.toString(), certificate])
    );

    const courses = [];

    for (const enrollment of enrollments) {
      if (!enrollment.course) {
        continue;
      }

      const progressSnapshot = await calculateEnrollmentProgress(enrollment);

      if (
        enrollment.progress !== progressSnapshot.progress ||
        enrollment.status !== progressSnapshot.status
      ) {
        enrollment.progress = progressSnapshot.progress;
        enrollment.status = progressSnapshot.status;
        await enrollment.save();
      }
      const certificateSnapshot = await getCertificateEligibilitySnapshot(
        req.user.id,
        enrollment.course._id,
        {
          course: enrollment.course,
          enrollment,
          student: req.user,
          certificate: certificatesByCourse.get(enrollment.course._id.toString()) || null
        }
      );

      courses.push({
        ...enrollment.course.toObject(),
        enrollmentId: enrollment._id,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        lastCompletedAt: enrollment.lastCompletedAt,
        progress: progressSnapshot.progress,
        status: progressSnapshot.status,
        completedLessonsCount: progressSnapshot.completedLessonsCount,
        totalLessons: progressSnapshot.totalLessons,
        certificateEligibility: buildCertificateEligibilityPayload(certificateSnapshot),
        certificate: certificateSnapshot.existingCertificate
          ? buildCertificateRenderPayload(certificateSnapshot.existingCertificate)
          : null
      });
    }

    return res.json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Get my courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching enrolled courses',
      error: error.message
    });
  }
};

module.exports = {
  enrollInCourse,
  getMyCourses
};
