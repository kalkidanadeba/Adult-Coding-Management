const { validationResult } = require('express-validator');
const Course = require('../models/course.model');
const Lesson = require('../models/lesson.model');
const Quiz = require('../models/quiz.model');
const Result = require('../models/result.model');
const { ensureEnrollmentRecord } = require('../utils/enrollment.helpers');
const {
  buildCertificateRenderPayload,
  issueCourseCertificateIfEligible
} = require('../utils/certificate.helpers');
const { resolveQuizAttemptPayload } = require('../utils/quizAttempt.helpers');
const { isManagementRole } = require('../utils/role.helpers');

const sanitizeQuizForStudent = (quiz) => {
  const quizObject = typeof quiz.toObject === 'function' ? quiz.toObject() : quiz;

  return {
    ...quizObject,
    questions: quizObject.questions.map((question) => ({
      _id: question._id,
      questionText: question.questionText,
      options: question.options,
      points: question.points
    }))
  };
};

const createQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      course,
      lesson,
      title,
      description,
      questions,
      passingScore,
      timeLimitMinutes,
      isPublished
    } = req.body;
    const normalizedLessonId = lesson || undefined;

    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (normalizedLessonId) {
      const lessonExists = await Lesson.findOne({ _id: normalizedLessonId, course });
      if (!lessonExists) {
        return res.status(400).json({
          success: false,
          message: 'Lesson does not belong to the selected course'
        });
      }
    }

    const quiz = await Quiz.create({
      course,
      lesson: normalizedLessonId,
      title,
      description,
      questions,
      passingScore,
      timeLimitMinutes,
      isPublished
    });

    return res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating quiz',
      error: error.message
    });
  }
};

const getAllQuizzes = async (req, res) => {
  try {
    const query = {};

    if (req.query.courseId) {
      query.course = req.query.courseId;
    }

    if (req.query.lessonId) {
      query.lesson = req.query.lessonId;
    }

    const quizzes = await Quiz.find(query)
      .populate('course', 'title code')
      .populate('lesson', 'title order')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Get all quizzes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching quizzes',
      error: error.message
    });
  }
};

const getAdminQuizzesByCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const quizzes = await Quiz.find({ course: course._id })
      .populate('lesson', 'title order')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      course,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Get admin quizzes by course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course quizzes',
      error: error.message
    });
  }
};

const getAdminQuizzesByLesson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lesson = await Lesson.findById(req.params.lessonId)
      .populate('course', 'title code category isActive');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const quizzes = await Quiz.find({ lesson: lesson._id })
      .populate('course', 'title code')
      .populate('lesson', 'title order')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      lesson,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Get admin quizzes by lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching lesson quizzes',
      error: error.message
    });
  }
};

const getQuizzesByCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const course = await Course.findOne({
      _id: req.params.courseId,
      isActive: true
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!isManagementRole(req.user)) {
      const enrollment = await ensureEnrollmentRecord(req.user.id, course._id);

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to access quizzes'
        });
      }
    }

    const query = { course: course._id };
    if (req.query.lessonId) {
      query.lesson = req.query.lessonId;
    }
    if (!isManagementRole(req.user)) {
      query.isPublished = true;
    }

    const quizzes = await Quiz.find(query)
      .populate('lesson', 'title order')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: quizzes.length,
      quizzes: isManagementRole(req.user)
        ? quizzes
        : quizzes.map(sanitizeQuizForStudent)
    });
  } catch (error) {
    console.error('Get quizzes by course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course quizzes',
      error: error.message
    });
  }
};

const getAdminQuizById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const quiz = await Quiz.findById(req.params.id)
      .populate('course', 'title code category isActive')
      .populate('lesson', 'title order');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    return res.json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Get admin quiz by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching quiz',
      error: error.message
    });
  }
};

const getQuizById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const quiz = await Quiz.findById(req.params.id)
      .populate('course', 'title code isActive')
      .populate('lesson', 'title order');

    if (!quiz || !quiz.course || !quiz.course.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (!isManagementRole(req.user)) {
      if (!quiz.isPublished) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      const enrollment = await ensureEnrollmentRecord(req.user.id, quiz.course._id);
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to access this quiz'
        });
      }
    }

    return res.json({
      success: true,
      quiz: isManagementRole(req.user) ? quiz : sanitizeQuizForStudent(quiz)
    });
  } catch (error) {
    console.error('Get quiz by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching quiz',
      error: error.message
    });
  }
};

const updateQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const allowedFields = [
      'course',
      'lesson',
      'title',
      'description',
      'questions',
      'passingScore',
      'timeLimitMinutes',
      'isPublished'
    ];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'lesson' && !req.body[field]) {
          updates[field] = null;
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    const targetCourseId = updates.course || quiz.course;
    const targetLessonId = updates.lesson !== undefined ? updates.lesson : quiz.lesson;

    if (updates.course) {
      const courseExists = await Course.findById(targetCourseId);
      if (!courseExists) {
        return res.status(404).json({
          success: false,
          message: 'Target course not found'
        });
      }
    }

    if (targetLessonId) {
      const lessonExists = await Lesson.findOne({
        _id: targetLessonId,
        course: targetCourseId
      });

      if (!lessonExists) {
        return res.status(400).json({
          success: false,
          message: 'Lesson does not belong to the selected course'
        });
      }
    }

    Object.assign(quiz, updates);
    await quiz.save();

    return res.json({
      success: true,
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating quiz',
      error: error.message
    });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    await Promise.all([
      Result.deleteMany({ quiz: quiz._id }),
      quiz.deleteOne()
    ]);

    return res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting quiz',
      error: error.message
    });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { quizId, answers } = resolveQuizAttemptPayload(req);

    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit quizzes'
      });
    }

    const quiz = await Quiz.findOne({
      _id: quizId,
      isPublished: true
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const enrollment = await ensureEnrollmentRecord(req.user.id, quiz.course);
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to submit this quiz'
      });
    }

    const answersByQuestionId = new Map(
      answers.map((answer) => [answer.questionId.toString(), answer.selectedOption])
    );

    let score = 0;
    let correctAnswers = 0;
    const totalQuestions = quiz.questions.length;
    const totalPoints = quiz.questions.reduce(
      (sum, question) => sum + Number(question.points || 1),
      0
    );

    const normalizedAnswers = quiz.questions.map((question) => {
      const selectedOption = answersByQuestionId.has(question._id.toString())
        ? answersByQuestionId.get(question._id.toString())
        : -1;
      const isCorrect = selectedOption === question.correctAnswer;

      if (isCorrect) {
        correctAnswers += 1;
        score += Number(question.points || 1);
      }

      return {
        questionId: question._id,
        selectedOption: selectedOption < 0 ? null : selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect
      };
    });

    const percentage = totalPoints === 0
      ? 0
      : Math.round((score / totalPoints) * 100);
    const passed = percentage >= quiz.passingScore;
    const attemptNumber = (await Result.countDocuments({
      student: req.user.id,
      quiz: quiz._id
    })) + 1;

    const result = await Result.create({
      student: req.user.id,
      course: quiz.course,
      lesson: quiz.lesson,
      quiz: quiz._id,
      answers: normalizedAnswers,
      totalQuestions,
      correctAnswers,
      score,
      totalPoints,
      percentage,
      passed,
      attemptNumber
    });

    enrollment.lastAccessedAt = new Date();
    await enrollment.save();
    const { certificate } = await issueCourseCertificateIfEligible(
      req.user.id,
      quiz.course,
      { enrollment }
    );

    return res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      result: {
        id: result._id,
        quiz: result.quiz,
        score: result.score,
        totalPoints: result.totalPoints,
        percentage: result.percentage,
        passed: result.passed,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correctAnswers,
        attemptNumber: result.attemptNumber,
        submittedAt: result.submittedAt,
        answers: normalizedAnswers
      },
      certificate: certificate ? buildCertificateRenderPayload(certificate) : null
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting quiz',
      error: error.message
    });
  }
};

module.exports = {
  createQuiz,
  getAllQuizzes,
  getAdminQuizzesByCourse,
  getAdminQuizzesByLesson,
  getQuizzesByCourse,
  getAdminQuizById,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitQuiz
};
