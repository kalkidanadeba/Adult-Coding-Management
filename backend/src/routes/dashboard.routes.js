const express = require('express');
const router = express.Router();

const {
  getMyDashboard,
  getAdminDashboard
} = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { MANAGEMENT_ROLES } = require('../utils/role.helpers');

router.get('/me', protect, getMyDashboard);
router.get('/admin', protect, authorize(...MANAGEMENT_ROLES), getAdminDashboard);

module.exports = router;
