const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const getFirstDefinedValue = (...values) => values.find((value) => value !== undefined);

const normalizeSelectedOption = (value, prefix) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new Error(`${prefix} must include a valid selected option index`);
  }

  return normalized;
};

const normalizeAnswerEntry = (answer, index) => {
  const prefix = `Answer ${index + 1}`;

  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    throw new Error(`${prefix} is invalid`);
  }

  const questionId = getFirstDefinedValue(
    answer.questionId,
    answer.question,
    answer.id
  );

  if (!isMongoId(questionId)) {
    throw new Error(`${prefix} must include a valid question id`);
  }

  const selectedOption = normalizeSelectedOption(
    getFirstDefinedValue(
      answer.selectedOption,
      answer.selectedAnswer,
      answer.answerIndex,
      answer.optionIndex,
      answer.choiceIndex
    ),
    prefix
  );

  return {
    questionId: String(questionId),
    selectedOption
  };
};

const normalizeAnswersPayload = (rawAnswers) => {
  if (Array.isArray(rawAnswers)) {
    if (rawAnswers.length === 0) {
      throw new Error('At least one answer is required');
    }

    return rawAnswers.map(normalizeAnswerEntry);
  }

  if (rawAnswers && typeof rawAnswers === 'object') {
    const entries = Object.entries(rawAnswers);
    if (entries.length === 0) {
      throw new Error('At least one answer is required');
    }

    return entries.map(([questionId, selectedOption], index) => normalizeAnswerEntry(
      { questionId, selectedOption },
      index
    ));
  }

  throw new Error('Answers must be an array or question-id map');
};

const resolveQuizAttemptPayload = (req) => {
  const quizId = getFirstDefinedValue(
    req.params?.id,
    req.body?.quizId,
    req.body?.quiz,
    req.body?.quiz_id
  );

  if (!isMongoId(quizId)) {
    throw new Error('Valid quiz id is required');
  }

  const rawAnswers = getFirstDefinedValue(
    req.body?.answers,
    req.body?.responses,
    req.body?.selectedAnswers,
    req.body?.attempt?.answers
  );

  return {
    quizId: String(quizId),
    answers: normalizeAnswersPayload(rawAnswers)
  };
};

module.exports = {
  resolveQuizAttemptPayload
};
