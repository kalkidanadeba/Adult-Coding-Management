/**
 * Many backends populate `lesson` as `{ _id, title }`. Stringifying that breaks Map keys / routes.
 */
export const lessonRefToIdString = (ref) => {
  if (ref == null || ref === '') return undefined;
  if (typeof ref === 'object') {
    const inner = ref._id ?? ref.id;
    if (inner == null || inner === '') return undefined;
    return String(inner);
  }
  return String(ref);
};

const pickLessonIdFromQuizPayload = (quiz) => {
  for (const key of ['lessonId', 'lesson_id', 'lesson']) {
    const s = lessonRefToIdString(quiz?.[key]);
    if (s) return s;
  }
  return undefined;
};

const normalizeOption = (option) => {
  if (option == null) return { text: '', value: '', isCorrect: false, original: option };

  const text =
    typeof option === 'string' || typeof option === 'number'
      ? String(option)
      : String(
          option?.text ??
            option?.label ??
            option?.value ??
            option?.optionText ??
            option?.option_text ??
            option?.title ??
            option?.name ??
            '',
        );

  const value =
    typeof option === 'string' || typeof option === 'number'
      ? option
      : option?.value ?? option?.id ?? option?.optionId ?? option?.option_id ?? option?.label ?? option?.text ?? option;

  const isCorrect =
    parseBooleanLike(
      option?.isCorrect ?? option?.is_correct ?? option?.correct ?? option?.correctOption ?? option?.correct_option,
    ) ?? false;

  return { text, value, isCorrect, original: option };
};

const normalizeCandidateValue = (candidate) => {
  if (candidate == null) return '';
  if (typeof candidate === 'object') {
    return String(
      candidate?.value ??
        candidate?.id ??
        candidate?.optionId ??
        candidate?.option_id ??
        candidate?.label ??
        candidate?.text ??
        candidate?.optionText ??
        candidate?.option_text ??
        candidate?.title ??
        candidate?.name ??
        '',
    );
  }
  return String(candidate);
};

const findCorrectAnswerIndex = (question, options) => {
  const numericIndex =
    parseNumberLike(question?.answerIndex) ??
    parseNumberLike(question?.answer_index) ??
    parseNumberLike(question?.correctAnswerIndex) ??
    parseNumberLike(question?.correct_answer_index) ??
    parseNumberLike(question?.correctOptionIndex) ??
    parseNumberLike(question?.correct_option_index) ??
    parseNumberLike(question?.correctAnswer) ??
    parseNumberLike(question?.correct_answer) ??
    parseNumberLike(question?.correctOption) ??
    parseNumberLike(question?.correct_option);

  if (numericIndex != null && Number.isFinite(numericIndex) && numericIndex >= 0 && numericIndex < options.length) {
    return numericIndex;
  }

  const rawCorrect = question?.correctOption ?? question?.correct_option ?? question?.correctAnswer ?? question?.correct_answer;
  const candidateValue = normalizeCandidateValue(rawCorrect);

  if (candidateValue) {
    const foundIndex = options.findIndex(
      (option) =>
        normalizeCandidateValue(option.value) === candidateValue || normalizeCandidateValue(option.text) === candidateValue,
    );
    if (foundIndex >= 0) return foundIndex;
  }

  const markedCorrectIndex = options.findIndex((option) => option.isCorrect === true);
  return markedCorrectIndex >= 0 ? markedCorrectIndex : null;
};

const parseNumberLike = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseBooleanLike = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on', 'correct', 'correctOption', 'correct_answer', 'correct'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'incorrect', 'wrong'].includes(normalized)) return false;
  }
  return null;
};

const normalizeStudentQuestion = (question, index) => {
  const id = question?.id ?? question?._id ?? question?.questionId ?? question?.question_id ?? index;
  const rawOptions = Array.isArray(question?.options)
    ? question.options
    : Array.isArray(question?.choices)
      ? question.choices
      : Array.isArray(question?.answers)
        ? question.answers
        : [];

  const options = rawOptions.map(normalizeOption);
  const answerIndex = findCorrectAnswerIndex(question, options);

  return {
    ...question,
    id: id != null ? String(id) : String(index),
    prompt: question?.prompt ?? question?.question ?? question?.questionText ?? question?.question_text ?? question?.text ?? '',
    options,
    answerIndex,
    explanation: question?.explanation ?? question?.explanationText ?? question?.explanation_text ?? '',
  };
};

/**
 * Normalize student-facing quiz list/detail payloads after GET /quizzes/course/:id (or equivalents).
 */
export const normalizeStudentQuiz = (quiz) => {
  const id = quiz?.id ?? quiz?._id ?? quiz?.quizId ?? quiz?.quiz_id ?? null;
  const rawQuestions = Array.isArray(quiz?.questions) ? quiz.questions : Array.isArray(quiz?.items) ? quiz.items : [];
  const questions = rawQuestions.map(normalizeStudentQuestion);
  const passPercent =
    parseNumberLike(quiz?.passPercent) ??
    parseNumberLike(quiz?.pass_percent) ??
    parseNumberLike(quiz?.passingScore) ??
    parseNumberLike(quiz?.passing_score) ??
    60;
  const timeLimitMinutes =
    parseNumberLike(quiz?.timeLimitMinutes) ??
    parseNumberLike(quiz?.time_limit_minutes) ??
    parseNumberLike(quiz?.time_limit) ??
    (() => {
      const seconds = parseNumberLike(quiz?.timeLimitSeconds) ?? parseNumberLike(quiz?.time_limit_seconds);
      return seconds != null && seconds > 0 ? seconds / 60 : null;
    })();
  const questionsCount = parseNumberLike(quiz?.questionsCount) ?? questions.length;

  return {
    ...quiz,
    id: id != null ? String(id) : undefined,
    lessonId: pickLessonIdFromQuizPayload(quiz),
    title: quiz?.title ?? quiz?.name ?? 'Lesson quiz',
    passPercent,
    timeLimitMinutes: timeLimitMinutes != null && timeLimitMinutes > 0 ? timeLimitMinutes : null,
    passed: Boolean(quiz?.passed ?? quiz?.isPassed ?? quiz?.is_passed),
    questions,
    questionsCount,
  };
};
