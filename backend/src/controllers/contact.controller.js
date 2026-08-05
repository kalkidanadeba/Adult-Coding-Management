const Contact = require('../models/contact.model');
const { validationResult } = require('express-validator');

const submitContactForm = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, message } = req.body;

    const contactSubmission = await Contact.create({
      name,
      email,
      message
    });

    res.status(201).json({
      success: true,
      message: 'Contact message sent successfully',
      submission: {
        id: contactSubmission._id,
        name: contactSubmission.name,
        email: contactSubmission.email,
        message: contactSubmission.message,
        createdAt: contactSubmission.createdAt
      }
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending contact message',
      error: error.message
    });
  }
};

module.exports = {
  submitContactForm
};
