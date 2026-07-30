const User = require('../models/user.model');
const { buildPublicUploadPath, deleteLocalUploadIfExists } = require('../utils/fileUpload.helpers');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const {
  extractIncomingPhotoValue,
  serializeUserForResponse,
  buildAuthUserResponse
} = require('../utils/userResponse.helpers');
const {
  getMissingEmailConfig,
  sendPasswordResetEmail
} = require('../services/email.service');

const getPasswordResetResponse = () => ({
  success: true,
  message: 'If an account exists with that email, password reset instructions have been generated.'
});

const buildResetUrl = (resetToken) => {
  if (!process.env.FRONTEND_URL) {
    return null;
  }

  const baseUrl = process.env.FRONTEND_URL.replace(/\/+$/, '');
  const resetPath = process.env.FRONTEND_RESET_PASSWORD_PATH || '/reset-password';
  const normalizedPath = resetPath.startsWith('/') ? resetPath : `/${resetPath}`;

  return `${baseUrl}${normalizedPath.replace(/\/+$/, '')}/${resetToken}`;
};

const getPasswordResetMissingConfig = () => {
  const missingConfig = getMissingEmailConfig();

  if (!process.env.FRONTEND_URL) {
    missingConfig.push('FRONTEND_URL');
  }

  return [...new Set(missingConfig)];
};


const register = async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;

  
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

  
    const incomingProfilePhoto = extractIncomingPhotoValue(req.body) ?? null;
    const user = await User.create({
      name,
      email,
      password,
      profilePhoto: incomingProfilePhoto
    });

    
    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: buildAuthUserResponse(user, req)
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

   
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact admin.'
      });
    }

  
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

  
    user.lastLogin = Date.now();
    await user.save();

  
    const token = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: buildAuthUserResponse(user, req)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};


const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate({
        path: 'enrolledCourses',
        match: { isActive: true }
      });

    res.json({
      success: true,
      user: serializeUserForResponse(user, req)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};


const logout = (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};


const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};
    const currentUser = await User.findById(req.user.id).select('profilePhoto');

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;

    if (req.file) {
      updates.profilePhoto = buildPublicUploadPath('profile-photos', req.file.filename);

      if (currentUser.profilePhoto && currentUser.profilePhoto !== updates.profilePhoto) {
        await deleteLocalUploadIfExists(currentUser.profilePhoto);
      }
    } else {
      const incomingProfilePhoto = extractIncomingPhotoValue(req.body);
      if (incomingProfilePhoto !== undefined) {
        updates.profilePhoto = incomingProfilePhoto;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: serializeUserForResponse(updatedUser, req)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id).select('+password');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const missingConfig = getPasswordResetMissingConfig();
    if (missingConfig.length > 0) {
      return res.status(500).json({
        success: false,
        message: 'Password reset email is not configured',
        ...(process.env.NODE_ENV !== 'production' && { missingConfig })
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return res.json(getPasswordResetResponse());
    }

    const expiresInMinutes = parseInt(process.env.PASSWORD_RESET_EXPIRE_MINUTES, 10) || 10;
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = buildResetUrl(resetToken);

    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.name,
        resetUrl,
        expiresInMinutes
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw emailError;
    }

    const response = getPasswordResetResponse();

    if (process.env.PASSWORD_RESET_DEBUG === 'true') {
      response.resetToken = resetToken;
      response.resetUrl = resetUrl;
      response.expiresAt = user.passwordResetExpires;
    }

    return res.json(response);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending password reset email',
      error: error.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is invalid or has expired'
      });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};

