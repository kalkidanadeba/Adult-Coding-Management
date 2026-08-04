const express = require('express');

const {
  getMyCertificates,
  getCourseCertificateStatus,
  issueCourseCertificate,
  getCertificateById,
  verifyCertificate
} = require('../controllers/certificate.controller');
const { protect } = require('../middleware/auth.middleware');
const {
  validateCertificateId,
  validateCertificateVerificationCode,
  validateCourseLookup
} = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/verify/:verificationCode', validateCertificateVerificationCode, verifyCertificate);
router.get('/my', protect, getMyCertificates);
router.get('/course/:courseId', protect, validateCourseLookup, getCourseCertificateStatus);
router.post('/course/:courseId/issue', protect, validateCourseLookup, issueCourseCertificate);
router.get('/:id', protect, validateCertificateId, getCertificateById);

module.exports = router;
