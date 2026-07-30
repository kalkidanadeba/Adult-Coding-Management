const { body, param, query } = require('express-validator');
const { normalizeCourseLevel } = require('../utils/courseLevel.helpers');
const {
  getCodeExecutionLanguageSupport,
  getCodeExecutionLimits,
  resolveCodeExecutionPayload
} = require('../utils/codeExecution.helpers');
const { resolveLessonContentFields } = require('../utils/lessonContent.helpers');
const { resolveQuizAttemptPayload } = require('../utils/quizAttempt.helpers');

const buildMongoIdParamValidator = (fieldName, message) => (
  param(fieldName)
    .trim()
    .isMongoId()
    .withMessage(message)
);

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const isValidLessonResourceValue = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (isHttpUrl(trimmed)) {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const resourceUrl = typeof parsed.url === 'string' ? parsed.url.trim() : '';
    if (!resourceUrl) {
      return false;
    }

    if (parsed.kind === 'file') {
      return Boolean(parsed.name?.trim()) && (isHttpUrl(resourceUrl) || resourceUrl.startsWith('data:'));
    }

    return isHttpUrl(resourceUrl) || resourceUrl.startsWith('data:');
  } catch (error) {
    return false;
  }
};

const validateLessonResourceItem = (value) => {
  if (isValidLessonResourceValue(value)) {
    return true;
  }

  throw new Error('Each resource must be a valid URL or uploaded file');
};

const validateQuizQuestionsPayload = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('At least one quiz question is required');
  }

  questions.forEach((question, index) => {
    const prefix = `Question ${index + 1}`;

    if (!question || typeof question !== 'object') {
      throw new Error(`${prefix} is invalid`);
    }

    if (!question.questionText || !question.questionText.trim()) {
      throw new Error(`${prefix} text is required`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`${prefix} must include at least 2 options`);
    }

    question.options.forEach((option, optionIndex) => {
      if (!option || !String(option).trim()) {
        throw new Error(`${prefix} option ${optionIndex + 1} is required`);
      }
    });

    const correctAnswer = Number(question.correctAnswer);
    if (
      !Number.isInteger(correctAnswer) ||
      correctAnswer < 0 ||
      correctAnswer >= question.options.length
    ) {
      throw new Error(`${prefix} must have a valid correct answer index`);
    }

    if (question.points !== undefined) {
      const points = Number(question.points);
      if (!Number.isInteger(points) || points < 1) {
        throw new Error(`${prefix} points must be a whole number of at least 1`);
      }
    }
  });

  return true;
};

const validateLessonContentPayload = (_, { req }) => {
  resolveLessonContentFields(req.body, { required: true });
  return true;
};

const validateOptionalLessonContentPayload = (_, { req }) => {
  const hasContent = Object.prototype.hasOwnProperty.call(req.body, 'content');
  const hasContentBlocks = Object.prototype.hasOwnProperty.call(req.body, 'contentBlocks');

  if (!hasContent && !hasContentBlocks) {
    return true;
  }

  resolveLessonContentFields(req.body);
  return true;
};

const validateQuizSubmissionPayload = (_, { req }) => {
  resolveQuizAttemptPayload(req);
  return true;
};

const validateCodeExecutionPayload = (_, { req }) => {
  const payload = resolveCodeExecutionPayload(req.body);
  const limits = getCodeExecutionLimits();

  if (typeof payload.code !== 'string' || !payload.code.trim()) {
    throw new Error('Code is required');
  }

  if (payload.code.length > limits.maxCodeLength) {
    throw new Error(`Code cannot exceed ${limits.maxCodeLength} characters`);
  }

  const languageSupport = getCodeExecutionLanguageSupport(payload.language);
  if (!languageSupport.known) {
    throw new Error('Unsupported programming language');
  }

  if (!languageSupport.available) {
    throw new Error(
      `${languageSupport.displayName} execution is not available on this server. Required runtime: ${languageSupport.requiredCommands.join(', ')}`
    );
  }

  if (payload.stdin.length > limits.maxInputLength) {
    throw new Error(`Input cannot exceed ${limits.maxInputLength} characters`);
  }

  const timeoutMs = req.body.timeoutMs;
  if (timeoutMs !== undefined && timeoutMs !== null && timeoutMs !== '') {
    const numericTimeout = Number(timeoutMs);

    if (
      !Number.isInteger(numericTimeout) ||
      numericTimeout < limits.minTimeoutMs ||
      numericTimeout > limits.maxTimeoutMs
    ) {
      throw new Error(`timeoutMs must be between ${limits.minTimeoutMs} and ${limits.maxTimeoutMs}`);
    }
  }

  return true;
};

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email required'),

  body('profilePhoto')
    .optional()
    .custom((value, { req }) => {
      if (req.file) {
        return true;
      }

      if (value === undefined || value === null || value === '') {
        return true;
      }

      const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
      if (normalizedValue.length > 1024) {
        throw new Error('Profile photo URL must be at most 1024 characters');
      }

      return true;
    })
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
];

const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail()
];

const validateResetPassword = [
  param('token')
    .trim()
    .notEmpty().withMessage('Reset token is required'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  body('confirmPassword')
    .optional()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
];

const validateContactSubmission = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),

  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 2, max: 2000 }).withMessage('Message must be 2-2000 characters')
];

const validateCourseCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Course title is required')
    .isLength({ min: 2, max: 100 }).withMessage('Course title must be 2-100 characters'),

  body('code')
    .trim()
    .notEmpty().withMessage('Course code is required')
    .isLength({ min: 2, max: 20 }).withMessage('Course code must be 2-20 characters')
    .matches(/^[A-Za-z0-9-]+$/).withMessage('Course code can only contain letters, numbers, and hyphens'),

  body('description')
    .trim()
    .notEmpty().withMessage('Course description is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Course description must be 10-2000 characters'),

  body('category')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Category must be 2-100 characters'),

  body('level')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => {
      if (value === undefined || value === null || String(value).trim() === '') {
        return true;
      }
      if (normalizeCourseLevel(value) === null) {
        throw new Error('Level must be Beginner, Intermediate, or Advanced');
      }
      return true;
    }),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
];

const validateCourseId = [
  buildMongoIdParamValidator('id', 'Valid course id is required')
];

const validateCourseUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Course title must be 2-100 characters'),

  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 }).withMessage('Course code must be 2-20 characters')
    .matches(/^[A-Za-z0-9-]+$/).withMessage('Course code can only contain letters, numbers, and hyphens'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('Course description must be 10-2000 characters'),

  body('category')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Category must be 2-100 characters'),

  body('level')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => {
      if (value === undefined || value === null || String(value).trim() === '') {
        return true;
      }
      if (normalizeCourseLevel(value) === null) {
        throw new Error('Level must be Beginner, Intermediate, or Advanced');
      }
      return true;
    }),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
];

const validateCourseLookup = [
  buildMongoIdParamValidator('courseId', 'Valid course id is required')
];

const validateLessonId = [
  buildMongoIdParamValidator('id', 'Valid lesson id is required')
];

const validateLessonLookup = [
  buildMongoIdParamValidator('lessonId', 'Valid lesson id is required')
];

const validateLessonCreation = [
  body('course')
    .trim()
    .isMongoId().withMessage('Valid course id is required'),

  body('title')
    .trim()
    .notEmpty().withMessage('Lesson title is required')
    .isLength({ min: 2, max: 120 }).withMessage('Lesson title must be 2-120 characters'),

  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Lesson description cannot exceed 1000 characters'),

  body().custom(validateLessonContentPayload),

  body('videoUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL().withMessage('Video URL must be valid'),

  body('resources')
    .optional()
    .isArray().withMessage('Resources must be an array'),

  body('resources.*')
    .optional({ values: 'falsy' })
    .custom(validateLessonResourceItem),

  body('order')
    .notEmpty().withMessage('Lesson order is required')
    .isInt({ min: 1 }).withMessage('Lesson order must be a whole number of at least 1'),

  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Lesson duration must be a non-negative whole number'),

  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean value')
];

const validateLessonUpdate = [
  body('course')
    .optional()
    .trim()
    .isMongoId().withMessage('Valid course id is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Lesson title must be 2-120 characters'),

  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Lesson description cannot exceed 1000 characters'),

  body().custom(validateOptionalLessonContentPayload),

  body('videoUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL().withMessage('Video URL must be valid'),

  body('resources')
    .optional()
    .isArray().withMessage('Resources must be an array'),

  body('resources.*')
    .optional({ values: 'falsy' })
    .custom(validateLessonResourceItem),

  body('order')
    .optional()
    .isInt({ min: 1 }).withMessage('Lesson order must be a whole number of at least 1'),

  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Lesson duration must be a non-negative whole number'),

  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean value')
];

const validateQuizId = [
  buildMongoIdParamValidator('id', 'Valid quiz id is required')
];

const validateQuizCreation = [
  body('course')
    .trim()
    .isMongoId().withMessage('Valid course id is required'),

  body('lesson')
    .optional({ values: 'falsy' })
    .trim()
    .isMongoId().withMessage('Valid lesson id is required'),

  body('title')
    .trim()
    .notEmpty().withMessage('Quiz title is required')
    .isLength({ min: 2, max: 120 }).withMessage('Quiz title must be 2-120 characters'),

  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Quiz description cannot exceed 1000 characters'),

  body('questions')
    .custom(validateQuizQuestionsPayload),

  body('passingScore')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),

  body('timeLimitMinutes')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 300 }).withMessage('Time limit must be between 1 and 300 minutes'),

  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean value')
];

const validateQuizUpdate = [
  body('course')
    .optional()
    .trim()
    .isMongoId().withMessage('Valid course id is required'),

  body('lesson')
    .optional({ values: 'falsy' })
    .trim()
    .isMongoId().withMessage('Valid lesson id is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Quiz title must be 2-120 characters'),

  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Quiz description cannot exceed 1000 characters'),

  body('questions')
    .optional()
    .custom(validateQuizQuestionsPayload),

  body('passingScore')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),

  body('timeLimitMinutes')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 300 }).withMessage('Time limit must be between 1 and 300 minutes'),

  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean value')
];

const validateQuizSubmission = [
  buildMongoIdParamValidator('id', 'Valid quiz id is required'),

  body().custom(validateQuizSubmissionPayload)
];

const validateQuizAttemptSubmission = [
  body().custom(validateQuizSubmissionPayload)
];

const validateAdminUserId = [
  buildMongoIdParamValidator('id', 'Valid user id is required')
];

const validateAdminUserUpdate = [
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
    .toBoolean(),

  body('role')
    .optional()
    .isIn(['student', 'instructor']).withMessage('Role must be student or instructor'),

  body().custom((_, { req }) => {
    const hasStatusUpdate = Object.prototype.hasOwnProperty.call(req.body, 'isActive');
    const hasRoleUpdate = Object.prototype.hasOwnProperty.call(req.body, 'role');

    if (!hasStatusUpdate && !hasRoleUpdate) {
      throw new Error('At least one user field is required to update');
    }

    return true;
  })
];

const LIVE_SESSION_STATUSES = ['scheduled', 'live', 'completed'];

const validateLiveSessionId = [
  buildMongoIdParamValidator('id', 'Valid live session id is required')
];

const validateLiveSessionCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Live session title is required')
    .isLength({ min: 2, max: 120 }).withMessage('Live session title must be 2-120 characters'),

  body('courseId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Valid course id is required'),

  body('startAt')
    .notEmpty().withMessage('Start date and time is required')
    .isISO8601().withMessage('Start date and time must be a valid ISO date')
    .toDate(),

  body('durationMinutes')
    .notEmpty().withMessage('Duration is required')
    .isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
    .toInt(),

  body('meetingUrl')
    .trim()
    .notEmpty().withMessage('Meeting URL is required')
    .isLength({ max: 1000 }).withMessage('Meeting URL cannot exceed 1000 characters')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Meeting URL must be a valid http or https URL'),

  body('status')
    .optional()
    .isIn(LIVE_SESSION_STATUSES).withMessage('Status must be scheduled, live, or completed')
];

const validateLiveSessionQuery = [
  query('courseId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Valid course id is required'),

  query('status')
    .optional()
    .isIn(LIVE_SESSION_STATUSES).withMessage('Status must be scheduled, live, or completed')
];

const validateLiveSessionUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Live session title must be 2-120 characters'),

  body('courseId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Valid course id is required'),

  body('startAt')
    .optional()
    .isISO8601().withMessage('Start date and time must be a valid ISO date')
    .toDate(),

  body('durationMinutes')
    .optional()
    .isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
    .toInt(),

  body('meetingUrl')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Meeting URL cannot exceed 1000 characters')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Meeting URL must be a valid http or https URL'),

  body('status')
    .optional()
    .isIn(LIVE_SESSION_STATUSES).withMessage('Status must be scheduled, live, or completed')
];

const validateLiveSessionStatusUpdate = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(LIVE_SESSION_STATUSES).withMessage('Status must be scheduled, live, or completed')
];

const validateCertificateId = [
  buildMongoIdParamValidator('id', 'Valid certificate id is required')
];

const validateCertificateVerificationCode = [
  param('verificationCode')
    .trim()
    .notEmpty().withMessage('Verification code is required')
    .isLength({ min: 8, max: 64 }).withMessage('Verification code is invalid')
];

const validateCodeExecution = [
  body().custom(validateCodeExecutionPayload)
];

const validateInstructorCreation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateForgotPassword,
  validateResetPassword,
  validateContactSubmission,
  validateCourseCreation,
  validateCourseId,
  validateCourseUpdate,
  validateCourseLookup,
  validateLessonId,
  validateLessonLookup,
  validateLessonCreation,
  validateLessonUpdate,
  validateQuizId,
  validateQuizCreation,
  validateQuizUpdate,
  validateQuizSubmission,
  validateQuizAttemptSubmission,
  validateAdminUserId,
  validateAdminUserUpdate,
  validateInstructorCreation,
  validateLiveSessionId,
  validateLiveSessionQuery,
  validateLiveSessionCreation,
  validateLiveSessionUpdate,
  validateLiveSessionStatusUpdate,
  validateCertificateId,
  validateCertificateVerificationCode,
  validateCodeExecution
};
