const express = require('express');
const {
  executeCodeSnippet,
  getCodeExecutionOptions
} = require('../controllers/codeExecution.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateCodeExecution } = require('../middleware/validation.middleware');

const router = express.Router();

router.use(protect);

router.get('/languages', getCodeExecutionOptions);
router.post('/execute', validateCodeExecution, executeCodeSnippet);
router.post('/run', validateCodeExecution, executeCodeSnippet);

module.exports = router;
