const express = require('express');
const router = express.Router();

const { uploadLessonResources } = require('../controllers/upload.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadLessonResources: uploadLessonResourcesMiddleware } = require('../middleware/upload.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');

router.post(
  '/lesson-resources',
  protect,
  authorize(...MANAGEMENT_ROLES),
  uploadLessonResourcesMiddleware,
  uploadLessonResources
);

module.exports = router;
