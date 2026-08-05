const { validationResult } = require('express-validator');
const {
  executeCode,
  getCodeExecutionLanguageOptions,
  getCodeExecutionLimits,
  getSupportedLanguages,
  resolveCodeExecutionPayload
} = require('../utils/codeExecution.helpers');

const getCodeExecutionOptions = async (req, res) => {
  return res.json({
    success: true,
    languages: getSupportedLanguages(),
    languageOptions: getCodeExecutionLanguageOptions(),
    defaultLanguage: 'javascript',
    limits: getCodeExecutionLimits()
  });
};

const executeCodeSnippet = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const payload = resolveCodeExecutionPayload(req.body);
    const execution = await executeCode(payload);
    const resultDisplay = execution.result ? execution.result.display : null;
    const resultType = execution.result ? execution.result.type : null;

    return res.json({
      success: execution.success,
      message: execution.success ? 'Code executed successfully' : 'Code execution failed',
      language: payload.language,
      output: execution.output,
      stdout: execution.output,
      logs: execution.logs,
      result: resultDisplay,
      resultType,
      error: execution.error,
      timedOut: execution.timedOut,
      truncated: execution.truncated,
      executionTimeMs: execution.executionTimeMs
    });
  } catch (error) {
    console.error('Code execution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error executing code',
      error: error.message
    });
  }
};

module.exports = {
  executeCodeSnippet,
  getCodeExecutionOptions
};
