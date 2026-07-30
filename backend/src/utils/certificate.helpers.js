const crypto = require('crypto');

const Certificate = require('../models/certificate.model');
const Course = require('../models/course.model');
const Enrollment = require('../models/enrollment.model');
const Lesson = require('../models/lesson.model');
const Quiz = require('../models/quiz.model');
const Result = require('../models/result.model');
const User = require('../models/user.model');
const { calculateEnrollmentProgress, ensureEnrollmentRecord } = require('./enrollment.helpers');

const CERTIFICATE_TEMPLATE = {
  theme: 'keradion-classic',
  organizationName: process.env.CERTIFICATE_ORGANIZATION_NAME || 'KERADION',
  providerName: process.env.CERTIFICATE_PROVIDER_NAME || 'Keradion Learning Systems',
  title: 'Certificate of Completion',
  subtitle: 'This Certifies That',
  completionIntro: 'Has successfully completed the following self-paced course:',
  completionOutro: 'All lessons, practical coding exercises, and quizzes have been finalized on:',
  presenterLine: 'Presented by Keradion Learning Systems.',
  signatureName: process.env.CERTIFICATE_SIGNATURE_NAME || 'Keradion Signature',
  signatureRole: process.env.CERTIFICATE_SIGNATURE_ROLE || 'ADMINISTRATOR',
  sealText: process.env.CERTIFICATE_SEAL_TEXT || 'KERADION LMS VERIFIED ACHIEVEMENT'
};

const uniqueIdStrings = (values) => [...new Set(values.map((value) => value.toString()))];

const buildCertificateNumber = () => {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `KRD-${year}-${suffix}`;
};

const buildVerificationCode = () => crypto.randomBytes(8).toString('hex').toUpperCase();

const buildCertificateRenderPayload = (certificate) => {
  const plainCertificate = typeof certificate?.toObject === 'function'
    ? certificate.toObject()
    : certificate;

  return {
    id: plainCertificate._id?.toString?.() || plainCertificate.id,
    certificateNumber: plainCertificate.certificateNumber,
    verificationCode: plainCertificate.verificationCode,
    verificationPath: `/api/certificates/verify/${plainCertificate.verificationCode}`,
    issuedAt: plainCertificate.issuedAt,
    completionDate: plainCertificate.completionDate,
    student: {
      id: plainCertificate.student?._id?.toString?.() || plainCertificate.student?.toString?.() || null,
      name: plainCertificate.studentName
    },
    course: {
      id: plainCertificate.course?._id?.toString?.() || plainCertificate.course?.toString?.() || null,
      title: plainCertificate.courseTitle,
      code: plainCertificate.courseCode || null
    },
    template: {
      theme: plainCertificate.templateKey || CERTIFICATE_TEMPLATE.theme,
      organizationName: plainCertificate.organizationName,
      providerName: plainCertificate.providerName,
      title: CERTIFICATE_TEMPLATE.title,
      subtitle: CERTIFICATE_TEMPLATE.subtitle,
      completionIntro: CERTIFICATE_TEMPLATE.completionIntro,
      completionOutro: CERTIFICATE_TEMPLATE.completionOutro,
      presenterLine: `Presented by ${plainCertificate.providerName}.`,
      signatureName: plainCertificate.signatureName,
      signatureRole: plainCertificate.signatureRole,
      sealText: CERTIFICATE_TEMPLATE.sealText
    }
  };
};

const buildCertificateEligibilityPayload = (snapshot) => ({
  isEnrolled: Boolean(snapshot.enrollment),
  isEligible: snapshot.isEligible,
  certificateIssued: snapshot.certificateIssued,
  progress: snapshot.progress,
  enrollmentStatus: snapshot.enrollmentStatus,
  completionDate: snapshot.completionDate,
  requirements: {
    totalLessons: snapshot.totalLessons,
    completedLessonsCount: snapshot.completedLessonsCount,
    totalQuizzes: snapshot.totalQuizzes,
    passedQuizzesCount: snapshot.passedQuizzesCount
  },
  reasons: snapshot.reasons
});

const resolveCompletionDate = ({ enrollment, latestPassedQuizAt }) => {
  const completionCandidates = [
    latestPassedQuizAt,
    enrollment?.lastCompletedAt,
    enrollment?.updatedAt,
    new Date()
  ].filter(Boolean).map((value) => new Date(value).getTime());

  return new Date(Math.max(...completionCandidates));
};

const getCertificateEligibilitySnapshot = async (studentId, courseId, options = {}) => {
  const {
    course: providedCourse,
    enrollment: providedEnrollment,
    student: providedStudent,
    certificate: providedCertificate
  } = options;

  const [student, course] = await Promise.all([
    providedStudent || User.findById(studentId).select('name role'),
    providedCourse || Course.findById(courseId).select('title code isActive')
  ]);

  const enrollment = course
    ? (providedEnrollment || await ensureEnrollmentRecord(studentId, courseId))
    : null;
  const existingCertificate = providedCertificate || await Certificate.findOne({
    student: studentId,
    course: courseId
  });

  const [publishedLessons, publishedQuizzes] = await Promise.all([
    Lesson.find({ course: courseId, isPublished: true }).select('_id').lean(),
    Quiz.find({ course: courseId, isPublished: true }).select('_id').lean()
  ]);

  const publishedLessonIds = publishedLessons.map((lesson) => lesson._id.toString());
  const publishedQuizIds = publishedQuizzes.map((quiz) => quiz._id.toString());

  const completedLessonsCount = enrollment
    ? uniqueIdStrings(enrollment.completedLessons || [])
      .filter((lessonId) => publishedLessonIds.includes(lessonId)).length
    : 0;

  const passedQuizIds = publishedQuizIds.length > 0
    ? await Result.distinct('quiz', {
        student: studentId,
        course: courseId,
        quiz: { $in: publishedQuizIds },
        passed: true
      })
    : [];

  const latestPassedQuiz = publishedQuizIds.length > 0
    ? await Result.findOne({
        student: studentId,
        course: courseId,
        quiz: { $in: publishedQuizIds },
        passed: true
      })
        .sort({ submittedAt: -1 })
        .select('submittedAt')
        .lean()
    : null;

  const totalLessons = publishedLessonIds.length;
  const totalQuizzes = publishedQuizIds.length;
  const passedQuizzesCount = uniqueIdStrings(passedQuizIds).length;
  const hasRequiredContent = totalLessons + totalQuizzes > 0;
  const lessonRequirementMet = totalLessons === 0 || completedLessonsCount >= totalLessons;
  const quizRequirementMet = totalQuizzes === 0 || passedQuizzesCount >= totalQuizzes;
  const isEligible = Boolean(
    student &&
    student.role === 'student' &&
    course &&
    enrollment &&
    hasRequiredContent &&
    lessonRequirementMet &&
    quizRequirementMet
  );

  const reasons = [];
  if (!student || student.role !== 'student') {
    reasons.push('Only students can receive certificates');
  }
  if (!course) {
    reasons.push('Course not found');
  }
  if (!enrollment) {
    reasons.push('Student is not enrolled in this course');
  }
  if (!hasRequiredContent) {
    reasons.push('This course has no published lessons or quizzes yet');
  }
  if (!lessonRequirementMet) {
    reasons.push('All published lessons must be completed');
  }
  if (!quizRequirementMet) {
    reasons.push('All published quizzes must be passed');
  }

  const progressSnapshot = enrollment
    ? await calculateEnrollmentProgress(enrollment)
    : {
        progress: 0,
        status: 'active',
        totalLessons,
        completedLessonsCount
      };

  return {
    student,
    course,
    enrollment,
    existingCertificate,
    certificateIssued: Boolean(existingCertificate),
    isEligible,
    reasons,
    totalLessons,
    completedLessonsCount,
    totalQuizzes,
    passedQuizzesCount,
    progress: progressSnapshot.progress,
    enrollmentStatus: progressSnapshot.status,
    completionDate: isEligible
      ? resolveCompletionDate({
          enrollment,
          latestPassedQuizAt: latestPassedQuiz?.submittedAt
        })
      : null
  };
};

const issueCourseCertificateIfEligible = async (studentId, courseId, options = {}) => {
  const snapshot = await getCertificateEligibilitySnapshot(studentId, courseId, options);

  if (snapshot.existingCertificate) {
    return {
      certificate: snapshot.existingCertificate,
      snapshot,
      created: false
    };
  }

  if (!snapshot.isEligible) {
    return {
      certificate: null,
      snapshot,
      created: false
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const certificate = await Certificate.create({
        student: snapshot.student._id,
        course: snapshot.course._id,
        enrollment: snapshot.enrollment?._id,
        certificateNumber: buildCertificateNumber(),
        verificationCode: buildVerificationCode(),
        studentName: snapshot.student.name,
        courseTitle: snapshot.course.title,
        courseCode: snapshot.course.code,
        organizationName: CERTIFICATE_TEMPLATE.organizationName,
        providerName: CERTIFICATE_TEMPLATE.providerName,
        signatureName: CERTIFICATE_TEMPLATE.signatureName,
        signatureRole: CERTIFICATE_TEMPLATE.signatureRole,
        templateKey: CERTIFICATE_TEMPLATE.theme,
        totalLessons: snapshot.totalLessons,
        totalQuizzes: snapshot.totalQuizzes,
        completionDate: snapshot.completionDate,
        issuedAt: new Date()
      });

      return {
        certificate,
        snapshot: {
          ...snapshot,
          existingCertificate: certificate,
          certificateIssued: true
        },
        created: true
      };
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      const certificate = await Certificate.findOne({
        student: studentId,
        course: courseId
      });

      if (certificate) {
        return {
          certificate,
          snapshot: {
            ...snapshot,
            existingCertificate: certificate,
            certificateIssued: true
          },
          created: false
        };
      }
    }
  }

  throw new Error('Could not issue certificate, please try again');
};

module.exports = {
  CERTIFICATE_TEMPLATE,
  buildCertificateEligibilityPayload,
  buildCertificateRenderPayload,
  getCertificateEligibilitySnapshot,
  issueCourseCertificateIfEligible
};
