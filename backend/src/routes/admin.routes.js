const express = require('express');

const {
  createCourse,
  getAllCourses,
  getAdminCourseById,
  updateCourse,
  deleteCourse
} = require('../controllers/course.controller');
const {
  createLesson,
  getAllLessons,
  getAdminLessonsByCourse,
  getAdminLessonById,
  updateLesson,
  deleteLesson
} = require('../controllers/lesson.controller');
const {
  createQuiz,
  getAllQuizzes,
  getAdminQuizzesByCourse,
  getAdminQuizzesByLesson,
  getAdminQuizById,
  updateQuiz,
  deleteQuiz
} = require('../controllers/quiz.controller');
const {
  getAdminDashboard,
  getAdminUsers,
  updateAdminUser,
  createInstructor
} = require('../controllers/dashboard.controller');
const {
  getAllCertificates,
  getAdminCertificateById
} = require('../controllers/certificate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');
const {
  validateCourseCreation,
  validateCertificateId,
  validateCourseId,
  validateCourseLookup,
  validateCourseUpdate,
  validateLessonCreation,
  validateLessonId,
  validateLessonLookup,
  validateLessonUpdate,
  validateQuizCreation,
  validateQuizId,
  validateQuizUpdate,
  validateAdminUserId,
  validateAdminUserUpdate,
  validateInstructorCreation
} = require('../middleware/validation.middleware');

const router = express.Router();

router.use(protect, authorize(...MANAGEMENT_ROLES));

router.get('/dashboard', getAdminDashboard);
router.get('/users', getAdminUsers);
router.post('/users/instructors/create', validateInstructorCreation, createInstructor);
router.put('/users/:id', validateAdminUserId, validateAdminUserUpdate, updateAdminUser);
router.get('/certificates', getAllCertificates);
router.get('/certificates/:id', validateCertificateId, getAdminCertificateById);

router.get('/courses', getAllCourses);
router.post('/courses', validateCourseCreation, createCourse);
router.get('/courses/:courseId/lessons', validateCourseLookup, getAdminLessonsByCourse);
router.get('/courses/:courseId/quizzes', validateCourseLookup, getAdminQuizzesByCourse);
router.get('/courses/:id', validateCourseId, getAdminCourseById);
router.put('/courses/:id', validateCourseId, validateCourseUpdate, updateCourse);
router.delete('/courses/:id', validateCourseId, deleteCourse);

router.get('/lessons', getAllLessons);
router.post('/lessons', validateLessonCreation, createLesson);
router.get('/lessons/:lessonId/quizzes', validateLessonLookup, getAdminQuizzesByLesson);
router.get('/lessons/:id', validateLessonId, getAdminLessonById);
router.put('/lessons/:id', validateLessonId, validateLessonUpdate, updateLesson);
router.delete('/lessons/:id', validateLessonId, deleteLesson);

router.get('/quizzes', getAllQuizzes);
router.post('/quizzes', validateQuizCreation, createQuiz);
router.get('/quizzes/:id', validateQuizId, getAdminQuizById);
router.put('/quizzes/:id', validateQuizId, validateQuizUpdate, updateQuiz);
router.delete('/quizzes/:id', validateQuizId, deleteQuiz);

module.exports = router;
