const Enrollment = require('../models/enrollment.model');
const Lesson = require('../models/lesson.model');
const User = require('../models/user.model');

const toIdString = (value) => value.toString();

const calculateEnrollmentProgress = async (enrollment) => {
  const courseId = enrollment.course && enrollment.course._id
    ? enrollment.course._id
    : enrollment.course;

  const totalLessons = courseId
    ? await Lesson.countDocuments({ course: courseId, isPublished: true })
    : 0;

  const uniqueCompletedLessons = [
    ...new Set((enrollment.completedLessons || []).map(toIdString))
  ];
  const completedLessonsCount = uniqueCompletedLessons.length;
  const progress = totalLessons === 0
    ? 0
    : Math.round((completedLessonsCount / totalLessons) * 100);
  const status = totalLessons > 0 && completedLessonsCount >= totalLessons
    ? 'completed'
    : 'active';

  return {
    totalLessons,
    completedLessonsCount,
    progress,
    status
  };
};

const ensureEnrollmentRecord = async (studentId, courseId) => {
  let enrollment = await Enrollment.findOne({ student: studentId, course: courseId });

  if (enrollment) {
    return enrollment;
  }

  const user = await User.findById(studentId).select('enrolledCourses');
  if (!user) {
    return null;
  }

  const alreadyEnrolled = user.enrolledCourses.some(
    (enrolledCourseId) => enrolledCourseId.toString() === courseId.toString()
  );

  if (!alreadyEnrolled) {
    return null;
  }

  enrollment = await Enrollment.create({
    student: studentId,
    course: courseId,
    lastAccessedAt: new Date()
  });

  return enrollment;
};

const syncLegacyEnrollmentsForUser = async (studentId) => {
  const user = await User.findById(studentId).select('enrolledCourses');

  if (!user || user.enrolledCourses.length === 0) {
    return;
  }

  const existingEnrollments = await Enrollment.find({
    student: studentId,
    course: { $in: user.enrolledCourses }
  }).select('course');

  const existingCourseIds = new Set(
    existingEnrollments.map((enrollment) => enrollment.course.toString())
  );

  const missingCourses = user.enrolledCourses.filter(
    (courseId) => !existingCourseIds.has(courseId.toString())
  );

  if (missingCourses.length === 0) {
    return;
  }

  try {
    await Enrollment.insertMany(
      missingCourses.map((courseId) => ({
        student: studentId,
        course: courseId,
        lastAccessedAt: new Date()
      })),
      { ordered: false }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
};

module.exports = {
  calculateEnrollmentProgress,
  ensureEnrollmentRecord,
  syncLegacyEnrollmentsForUser
};
