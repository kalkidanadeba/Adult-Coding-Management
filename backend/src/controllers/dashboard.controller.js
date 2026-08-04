const { validationResult } = require('express-validator');
const Course = require('../models/course.model');
const Certificate = require('../models/certificate.model');
const Enrollment = require('../models/enrollment.model');
const Lesson = require('../models/lesson.model');
const Quiz = require('../models/quiz.model');
const Result = require('../models/result.model');
const User = require('../models/user.model');
const { buildAuthUserResponse } = require('../utils/userResponse.helpers');
const {
  calculateEnrollmentProgress,
  syncLegacyEnrollmentsForUser
} = require('../utils/enrollment.helpers');
const {
  buildCertificateEligibilityPayload,
  buildCertificateRenderPayload,
  getCertificateEligibilitySnapshot
} = require('../utils/certificate.helpers');

const getMyDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view the student dashboard'
      });
    }

    await syncLegacyEnrollmentsForUser(req.user.id);

    const [enrollments, results] = await Promise.all([
      Enrollment.find({ student: req.user.id })
        .populate({
          path: 'course',
          match: { isActive: true },
          select: 'title code description category level isActive createdAt updatedAt'
        })
        .sort({ createdAt: -1 }),
      Result.find({ student: req.user.id }).sort({ submittedAt: -1 }).lean()
    ]);
    const existingCertificates = await Certificate.find({ student: req.user.id }).lean();
    const certificatesByCourse = new Map(
      existingCertificates.map((certificate) => [certificate.course.toString(), certificate])
    );

    const resultsByCourse = new Map();

    results.forEach((result) => {
      const courseId = result.course.toString();
      if (!resultsByCourse.has(courseId)) {
        resultsByCourse.set(courseId, []);
      }
      resultsByCourse.get(courseId).push(result);
    });

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

      const courseResults = resultsByCourse.get(enrollment.course._id.toString()) || [];
      const averageQuizScore = courseResults.length === 0
        ? 0
        : Math.round(
            courseResults.reduce((sum, result) => sum + result.percentage, 0) /
            courseResults.length
          );
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
        totalLessons: progressSnapshot.totalLessons,
        completedLessonsCount: progressSnapshot.completedLessonsCount,
        quizAttempts: courseResults.length,
        averageQuizScore,
        certificateEligibility: buildCertificateEligibilityPayload(certificateSnapshot),
        certificate: certificateSnapshot.existingCertificate
          ? buildCertificateRenderPayload(certificateSnapshot.existingCertificate)
          : null
      });
    }

    const totalQuizAttempts = results.length;
    const averageQuizScore = totalQuizAttempts === 0
      ? 0
      : Math.round(
          results.reduce((sum, result) => sum + result.percentage, 0) /
          totalQuizAttempts
        );

    return res.json({
      success: true,
      user: buildAuthUserResponse(req.user, req),
      summary: {
        totalEnrolledCourses: courses.length,
        completedCourses: courses.filter((course) => course.status === 'completed').length,
        totalCompletedLessons: courses.reduce(
          (sum, course) => sum + course.completedLessonsCount,
          0
        ),
      totalQuizAttempts,
      averageQuizScore,
      totalCertificates: existingCertificates.length,
      eligibleForCertificates: courses.filter((course) => course.certificateEligibility.isEligible).length
    },
    courses
    });
  } catch (error) {
    console.error('Get my dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const [users, totalStudents, totalAdmins, totalInstructors] = await Promise.all([
      User.find()
        .select('name email role isActive createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'instructor' })
    ]);

    const studentIds = users
      .filter((u) => u.role === 'student')
      .map((u) => u._id);

    const progressByStudent = new Map();

    if (studentIds.length > 0) {
      const enrollments = await Enrollment.find({ student: { $in: studentIds } })
        .populate({
          path: 'course',
          match: { isActive: true },
          select: '_id'
        })
        .select('student progress course')
        .lean();

      enrollments.forEach((enrollment) => {
        if (!enrollment.course) {
          return;
        }
        const sid = enrollment.student.toString();
        if (!progressByStudent.has(sid)) {
          progressByStudent.set(sid, []);
        }
        const p = typeof enrollment.progress === 'number' ? enrollment.progress : 0;
        progressByStudent.get(sid).push(p);
      });

      progressByStudent.forEach((list, sid) => {
        const avg =
          list.length === 0
            ? 0
            : Math.round(list.reduce((sum, n) => sum + n, 0) / list.length);
        progressByStudent.set(sid, avg);
      });
    }

    const payload = users.map((u) => {
      const id = u._id.toString();
      const progress =
        u.role === 'student' ? (progressByStudent.get(id) ?? 0) : 0;

      return {
        id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        status: u.isActive ? 'active' : 'inactive',
        progress,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    });

    return res.json({
      success: true,
      users: payload,
      totalStudents,
      totalAdmins,
      totalInstructors,
      totalUsers: totalStudents + totalAdmins + totalInstructors
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching admin users',
      error: error.message
    });
  }
};

const updateAdminUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const target = await User.findById(req.params.id).select('name email role isActive');

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (target._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own account status here'
      });
    }

    if (target.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts cannot be updated from this screen'
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      target.isActive = req.body.isActive;
    }

    if (req.body.role !== undefined) {
      target.role = req.body.role;
    }

    await target.save();

    return res.json({
      success: true,
      user: {
        id: target._id.toString(),
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
        status: target.isActive ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Update admin user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    const [
      totalStudents,
      totalAdmins,
      totalInstructors,
      totalCourses,
      activeCourses,
      totalLessons,
      publishedLessons,
      totalQuizzes,
      publishedQuizzes,
      totalEnrollments,
      totalResults,
      totalCertificates,
      recentResults,
      recentEnrollments,
      recentCertificates
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'instructor' }),
      Course.countDocuments(),
      Course.countDocuments({ isActive: true }),
      Lesson.countDocuments(),
      Lesson.countDocuments({ isPublished: true }),
      Quiz.countDocuments(),
      Quiz.countDocuments({ isPublished: true }),
      Enrollment.countDocuments(),
      Result.countDocuments(),
      Certificate.countDocuments(),
      Result.find()
        .populate('student', 'name email')
        .populate('course', 'title code')
        .populate('quiz', 'title')
        .sort({ submittedAt: -1 })
        .limit(10),
      Enrollment.find()
        .populate('student', 'name email')
        .populate('course', 'title code')
        .sort({ enrolledAt: -1 })
        .limit(10),
      Certificate.find()
        .sort({ issuedAt: -1 })
        .limit(10)
        .lean()
    ]);

    return res.json({
      success: true,
      summary: {
        totalStudents,
        totalAdmins,
        totalInstructors,
        totalCourses,
        activeCourses,
        totalLessons,
        publishedLessons,
        totalQuizzes,
        publishedQuizzes,
        totalEnrollments,
        totalResults,
        totalCertificates
      },
      recentResults,
      recentEnrollments,
      recentCertificates: recentCertificates.map(buildCertificateRenderPayload)
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching admin dashboard data',
      error: error.message
    });
  }
};

const createInstructor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const instructor = await User.create({
      name,
      email,
      password,
      role: 'instructor'
    });

    return res.status(201).json({
      success: true,
      message: 'Instructor account created successfully',
      instructor: {
        id: instructor._id.toString(),
        name: instructor.name,
        email: instructor.email,
        role: instructor.role,
        createdAt: instructor.createdAt
      }
    });
  } catch (error) {
    console.error('Create instructor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating instructor account',
      error: error.message
    });
  }
};

module.exports = {
  getMyDashboard,
  getAdminUsers,
  updateAdminUser,
  getAdminDashboard,
  createInstructor
};
