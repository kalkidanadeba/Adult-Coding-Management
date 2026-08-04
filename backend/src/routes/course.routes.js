const express = require('express');
const router = express.Router();

const {
  createCourse,
  getCourses,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} = require('../controllers/course.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');
const {
  validateCourseCreation,
  validateCourseId,
  validateCourseUpdate
} = require('../middleware/validation.middleware');

router.get('/', getCourses);
router.get('/admin/all', protect, authorize(...MANAGEMENT_ROLES), getAllCourses);
router.get('/:id', validateCourseId, getCourseById);
router.post('/', protect, authorize(...MANAGEMENT_ROLES), validateCourseCreation, createCourse);
router.put('/:id', protect, authorize(...MANAGEMENT_ROLES), validateCourseId, validateCourseUpdate, updateCourse);
router.delete('/:id', protect, authorize(...MANAGEMENT_ROLES), validateCourseId, deleteCourse);

module.exports = router;
