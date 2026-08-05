const express = require('express');
const router = express.Router();

const { submitContactForm } = require('../controllers/contact.controller');
const { validateContactSubmission } = require('../middleware/validation.middleware');

router.post('/', validateContactSubmission, submitContactForm);

module.exports = router;
