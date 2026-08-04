const express = require('express');
const router = express.Router();

const {
  enrollInCourse,
  getMyCourses
} = require('../controllers/enrollment.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateCourseId } = require('../middleware/validation.middleware');

router.post('/:id', protect, validateCourseId, enrollInCourse);
router.get('/my-courses', protect, getMyCourses);

module.exports = router;
