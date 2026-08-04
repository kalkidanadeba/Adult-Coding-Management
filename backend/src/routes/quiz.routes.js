const express = require('express');
const router = express.Router();

const {
  createQuiz,
  getAllQuizzes,
  getQuizzesByCourse,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitQuiz
} = require('../controllers/quiz.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');
const {
  validateCourseLookup,
  validateQuizAttemptSubmission,
  validateQuizCreation,
  validateQuizId,
  validateQuizSubmission,
  validateQuizUpdate
} = require('../middleware/validation.middleware');

router.get('/admin/all', protect, authorize(...MANAGEMENT_ROLES), getAllQuizzes);
router.get('/course/:courseId', protect, validateCourseLookup, getQuizzesByCourse);
router.get('/:id', protect, validateQuizId, getQuizById);
router.post('/', protect, authorize(...MANAGEMENT_ROLES), validateQuizCreation, createQuiz);
router.post('/attempt', protect, validateQuizAttemptSubmission, submitQuiz);
router.put('/:id', protect, authorize(...MANAGEMENT_ROLES), validateQuizId, validateQuizUpdate, updateQuiz);
router.delete('/:id', protect, authorize(...MANAGEMENT_ROLES), validateQuizId, deleteQuiz);
router.post('/:id/attempt', protect, validateQuizSubmission, submitQuiz);
router.post('/:id/submit', protect, validateQuizSubmission, submitQuiz);

module.exports = router;
