const express = require('express');

const {
  getInstructorLiveSessions,
  createInstructorLiveSession,
  updateInstructorLiveSession,
  deleteInstructorLiveSession,
  updateInstructorLiveSessionStatus
} = require('../controllers/liveSession.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  validateLiveSessionCreation,
  validateLiveSessionId,
  validateLiveSessionQuery,
  validateLiveSessionStatusUpdate,
  validateLiveSessionUpdate
} = require('../middleware/validation.middleware');
const { LIVE_SESSION_ROLES } = require('../utils/role.helpers');

const router = express.Router();

router.use(protect, authorize(...LIVE_SESSION_ROLES));

router.get('/live-sessions', validateLiveSessionQuery, getInstructorLiveSessions);
router.post('/live-sessions', validateLiveSessionCreation, createInstructorLiveSession);
router.put('/live-sessions/:id', validateLiveSessionId, validateLiveSessionUpdate, updateInstructorLiveSession);
router.delete('/live-sessions/:id', validateLiveSessionId, deleteInstructorLiveSession);
router.patch('/live-sessions/:id/status', validateLiveSessionId, validateLiveSessionStatusUpdate, updateInstructorLiveSessionStatus);

module.exports = router;
