const express = require('express');
const router = express.Router();

const {
  getMyResults,
  getCourseResults
} = require('../controllers/result.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  validateCourseLookup
} = require('../middleware/validation.middleware');

router.get('/my', protect, getMyResults);
router.get('/course/:courseId', protect, validateCourseLookup, getCourseResults);

module.exports = router;
