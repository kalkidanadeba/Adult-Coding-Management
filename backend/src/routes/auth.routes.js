const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  logout,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');
const { uploadProfilePhoto } = require('../middleware/upload.middleware');
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation.middleware');


router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.put('/reset-password/:token', validateResetPassword, resetPassword);


router.get('/me', protect, getMe);
router.get('/profile', protect, getMe);
router.put('/profile', protect, uploadProfilePhoto, validateProfileUpdate, updateProfile);
router.post('/logout', protect, logout);
router.put('/change-password', protect, validatePasswordChange, changePassword);

module.exports = router;
