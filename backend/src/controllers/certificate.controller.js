const { validationResult } = require('express-validator');

const Certificate = require('../models/certificate.model');
const {
  buildCertificateEligibilityPayload,
  buildCertificateRenderPayload,
  getCertificateEligibilitySnapshot,
  issueCourseCertificateIfEligible
} = require('../utils/certificate.helpers');
const { isManagementRole } = require('../utils/role.helpers');

const ensureStudentRole = (req, res) => {
  if (req.user.role !== 'student') {
    res.status(403).json({
      success: false,
      message: 'Only students can access certificate actions'
    });
    return false;
  }

  return true;
};

const getMyCertificates = async (req, res) => {
  try {
    if (!ensureStudentRole(req, res)) {
      return;
    }

    const certificates = await Certificate.find({ student: req.user.id })
      .sort({ issuedAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: certificates.length,
      certificates: certificates.map(buildCertificateRenderPayload)
    });
  } catch (error) {
    console.error('Get my certificates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching certificates',
      error: error.message
    });
  }
};

const getCourseCertificateStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!ensureStudentRole(req, res)) {
      return;
    }

    const snapshot = await getCertificateEligibilitySnapshot(req.user.id, req.params.courseId);

    if (!snapshot.course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    return res.json({
      success: true,
      course: {
        id: snapshot.course._id,
        title: snapshot.course.title,
        code: snapshot.course.code
      },
      eligibility: buildCertificateEligibilityPayload(snapshot),
      certificate: snapshot.existingCertificate
        ? buildCertificateRenderPayload(snapshot.existingCertificate)
        : null
    });
  } catch (error) {
    console.error('Get course certificate status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching certificate status',
      error: error.message
    });
  }
};

const issueCourseCertificate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!ensureStudentRole(req, res)) {
      return;
    }

    const { certificate, snapshot, created } = await issueCourseCertificateIfEligible(
      req.user.id,
      req.params.courseId
    );

    if (!snapshot.course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!certificate) {
      return res.status(400).json({
        success: false,
        message: 'Course certificate is not available yet',
        eligibility: buildCertificateEligibilityPayload(snapshot)
      });
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? 'Certificate issued successfully'
        : 'Certificate already issued',
      eligibility: buildCertificateEligibilityPayload(snapshot),
      certificate: buildCertificateRenderPayload(certificate)
    });
  } catch (error) {
    console.error('Issue course certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error issuing certificate',
      error: error.message
    });
  }
};

const getCertificateById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    const isOwner = certificate.student.toString() === req.user.id.toString();
    const isAdmin = isManagementRole(req.user);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this certificate'
      });
    }

    return res.json({
      success: true,
      certificate: buildCertificateRenderPayload(certificate)
    });
  } catch (error) {
    console.error('Get certificate by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching certificate',
      error: error.message
    });
  }
};

const verifyCertificate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const certificate = await Certificate.findOne({
      verificationCode: req.params.verificationCode
    }).lean();

    if (!certificate) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Certificate not found'
      });
    }

    return res.json({
      success: true,
      verified: true,
      certificate: buildCertificateRenderPayload(certificate)
    });
  } catch (error) {
    console.error('Verify certificate error:', error);
    return res.status(500).json({
      success: false,
      verified: false,
      message: 'Error verifying certificate',
      error: error.message
    });
  }
};

const getAllCertificates = async (req, res) => {
  try {
    const query = {};

    if (req.query.courseId) {
      query.course = req.query.courseId;
    }

    if (req.query.studentId) {
      query.student = req.query.studentId;
    }

    const certificates = await Certificate.find(query)
      .sort({ issuedAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: certificates.length,
      certificates: certificates.map(buildCertificateRenderPayload)
    });
  } catch (error) {
    console.error('Get all certificates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching certificates',
      error: error.message
    });
  }
};

const getAdminCertificateById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const certificate = await Certificate.findById(req.params.id).lean();

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    return res.json({
      success: true,
      certificate: buildCertificateRenderPayload(certificate)
    });
  } catch (error) {
    console.error('Get admin certificate by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching certificate',
      error: error.message
    });
  }
};

module.exports = {
  getMyCertificates,
  getCourseCertificateStatus,
  issueCourseCertificate,
  getCertificateById,
  verifyCertificate,
  getAllCertificates,
  getAdminCertificateById
};
