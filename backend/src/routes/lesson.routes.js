const express = require('express');
const router = express.Router();

const {
  createLesson,
  getAllLessons,
  getLessonsByCourse,
  getLessonById,
  updateLesson,
  deleteLesson,
  markLessonComplete
} = require('../controllers/lesson.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');
const {
  validateCourseLookup,
  validateLessonCreation,
  validateLessonId,
  validateLessonUpdate
} = require('../middleware/validation.middleware');

router.get('/admin/all', protect, authorize(...MANAGEMENT_ROLES), getAllLessons);
router.get('/course/:courseId', protect, validateCourseLookup, getLessonsByCourse);
router.get('/:id', protect, validateLessonId, getLessonById);
router.post('/', protect, authorize(...MANAGEMENT_ROLES), validateLessonCreation, createLesson);
router.put('/:id', protect, authorize(...MANAGEMENT_ROLES), validateLessonId, validateLessonUpdate, updateLesson);
router.delete('/:id', protect, authorize(...MANAGEMENT_ROLES), validateLessonId, deleteLesson);
router.post('/:id/complete', protect, validateLessonId, markLessonComplete);

module.exports = router;
