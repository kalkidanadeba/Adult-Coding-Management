export const parseResultNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const parseResultBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'pass', 'passed', 'success', 'true', 'yes'].includes(normalized)) return true;
    if (['0', 'fail', 'failed', 'false', 'no'].includes(normalized)) return false;
  }
  return null;
};

const parseTimestamp = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
};

const pickLatestTimestamp = (...values) => {
  const valid = values.filter(Boolean);
  if (!valid.length) return null;

  return valid.reduce((latest, current) => (parseTimestamp(current) > parseTimestamp(latest) ? current : latest), valid[0]);
};

const refToIdString = (ref) => {
  if (ref == null || ref === '') return undefined;
  if (typeof ref === 'object') {
    const inner =
      ref._id ??
      ref.id ??
      ref.code ??
      ref.slug ??
      ref.courseId ??
      ref.course_id ??
      ref.lessonId ??
      ref.lesson_id ??
      ref.quizId ??
      ref.quiz_id;
    if (inner == null || inner === '') return undefined;
    return String(inner);
  }
  return String(ref);
};

const normalizeAttempt = (attempt) => {
  const correctCount =
    parseResultNumber(attempt?.correctCount) ??
    parseResultNumber(attempt?.correct_answers) ??
    parseResultNumber(attempt?.correctAnswers) ??
    0;
  const total =
    parseResultNumber(attempt?.total) ??
    parseResultNumber(attempt?.total_questions) ??
    parseResultNumber(attempt?.totalQuestions) ??
    0;
  const rawPercent = parseResultNumber(attempt?.percent) ?? parseResultNumber(attempt?.score) ?? parseResultNumber(attempt?.percentage) ?? 0;
  
  // Calculate percentage out of 100 if we have correctCount and total
  const calculatedPercent = total > 0 ? Math.round((correctCount / total) * 100 * 10) / 10 : Math.round(rawPercent * 10) / 10;
  
  return {
    timestamp: attempt?.timestamp ?? attempt?.submitted_at ?? attempt?.submittedAt ?? attempt?.createdAt ?? attempt?.updatedAt ?? null,
    percent: calculatedPercent,
    correctCount,
    total,
    answers: attempt?.answers && typeof attempt.answers === 'object' ? attempt.answers : null,
    passed:
      parseResultBoolean(attempt?.passed) ??
      parseResultBoolean(attempt?.isPassed) ??
      parseResultBoolean(attempt?.is_passed) ??
      parseResultBoolean(attempt?.status),
  };
};

const hasSingleAttemptShape = (row) =>
  [
    row?.timestamp,
    row?.submitted_at,
    row?.submittedAt,
    row?.createdAt,
    row?.updatedAt,
    row?.percent,
    row?.score,
    row?.percentage,
    row?.correctCount,
    row?.correct_answers,
    row?.correctAnswers,
    row?.total,
    row?.total_questions,
    row?.totalQuestions,
    row?.answers,
  ].some((value) => value !== undefined && value !== null);

export const normalizeStudentResultRow = (row) => {
  const courseId = refToIdString(row?.courseId ?? row?.course_id ?? row?.course);
  const lessonId = refToIdString(row?.lessonId ?? row?.lesson_id ?? row?.lesson);
  const quizId = refToIdString(row?.quizId ?? row?.quiz_id ?? row?.quiz);

  const attemptsSource = Array.isArray(row?.attempts) ? row.attempts : Array.isArray(row?.history) ? row.history : [];
  const attempts = attemptsSource.length
    ? attemptsSource.map(normalizeAttempt)
    : hasSingleAttemptShape(row)
      ? [normalizeAttempt(row)]
      : [];

  attempts.sort((a, b) => parseTimestamp(a?.timestamp) - parseTimestamp(b?.timestamp));

  const passPercent =
    parseResultNumber(row?.passPercent) ??
    parseResultNumber(row?.pass_percent) ??
    parseResultNumber(row?.passingScore) ??
    parseResultNumber(row?.passing_score) ??
    60;
  const bestFromAttempts = attempts.reduce((max, attempt) => Math.max(max, attempt?.percent || 0), 0);
  const bestPercent =
    parseResultNumber(row?.bestPercent) ??
    parseResultNumber(row?.best_percent) ??
    parseResultNumber(row?.bestScore) ??
    parseResultNumber(row?.score) ??
    parseResultNumber(row?.percent) ??
    Math.round(bestFromAttempts * 10) / 10;
  const explicitPassed =
    parseResultBoolean(row?.passed) ??
    parseResultBoolean(row?.isPassed) ??
    parseResultBoolean(row?.is_passed) ??
    parseResultBoolean(row?.status) ??
    parseResultBoolean(row?.result);
  const derivedPassed = attempts.some((attempt) => attempt?.passed === true) || bestPercent >= passPercent;
  const lastAttemptAt = pickLatestTimestamp(
    row?.lastAttemptAt,
    row?.last_attempt_at,
    row?.updatedAt,
    row?.timestamp,
    attempts.length ? attempts[attempts.length - 1]?.timestamp : null
  );
  const attemptsCount =
    parseResultNumber(row?.attemptsCount) ??
    parseResultNumber(row?.attempts_count) ??
    parseResultNumber(row?.attempt_number) ??
    parseResultNumber(row?.attemptNumber) ??
    attempts.length;

  return {
    courseId: courseId ?? null,
    lessonId: lessonId ?? null,
    quizId: quizId ?? null,
    courseTitle:
      row?.courseTitle ??
      row?.course_title ??
      row?.courseName ??
      row?.course_name ??
      row?.course?.title ??
      null,
    lessonTitle:
      row?.lessonTitle ??
      row?.lesson_title ??
      row?.lessonName ??
      row?.lesson_name ??
      row?.lesson?.title ??
      null,
    quizTitle:
      row?.quizTitle ??
      row?.quiz_title ??
      row?.quizName ??
      row?.quiz_name ??
      row?.quiz?.title ??
      'Lesson quiz',
    attempts,
    attemptsCount,
    bestPercent,
    passPercent,
    passed: explicitPassed == null ? derivedPassed : explicitPassed || derivedPassed,
    lastAttemptAt,
  };
};

export const groupStudentResults = (rows) => {
  if (!Array.isArray(rows)) return [];

  const grouped = new Map();

  for (const row of rows) {
    const normalized = normalizeStudentResultRow(row);
    if (!normalized.courseId || !normalized.lessonId) continue;

    const key = `${normalized.courseId}::${normalized.lessonId}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...normalized,
        attemptCountFloor: Math.max(normalized.attemptsCount || 0, normalized.attempts.length),
      });
      continue;
    }

    existing.quizId = existing.quizId ?? normalized.quizId;
    existing.courseTitle = existing.courseTitle || normalized.courseTitle;
    existing.lessonTitle = existing.lessonTitle || normalized.lessonTitle;
    existing.quizTitle =
      existing.quizTitle && existing.quizTitle !== 'Lesson quiz'
        ? existing.quizTitle
        : normalized.quizTitle;
    existing.passPercent = normalized.passPercent ?? existing.passPercent ?? 60;
    existing.bestPercent = Math.max(existing.bestPercent || 0, normalized.bestPercent || 0);
    existing.passed = Boolean(existing.passed || normalized.passed);
    existing.lastAttemptAt = pickLatestTimestamp(existing.lastAttemptAt, normalized.lastAttemptAt);
    existing.attempts.push(...normalized.attempts);
    existing.attemptCountFloor = Math.max(existing.attemptCountFloor || 0, normalized.attemptsCount || 0);
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const attempts = [...entry.attempts].sort((a, b) => parseTimestamp(a?.timestamp) - parseTimestamp(b?.timestamp));
      const bestFromAttempts = attempts.reduce((max, attempt) => Math.max(max, attempt?.percent || 0), 0);
      const bestPercent = Math.max(entry.bestPercent || 0, bestFromAttempts);
      const lastAttemptAt = pickLatestTimestamp(entry.lastAttemptAt, attempts.length ? attempts[attempts.length - 1]?.timestamp : null);
      const attemptsCount = Math.max(entry.attemptCountFloor || 0, attempts.length);
      const passed = Boolean(entry.passed || attempts.some((attempt) => attempt?.passed === true) || bestPercent >= (entry.passPercent ?? 60));

      return {
        courseId: String(entry.courseId),
        lessonId: String(entry.lessonId),
        quizId: entry.quizId != null ? String(entry.quizId) : null,
        courseTitle: entry.courseTitle || String(entry.courseId),
        lessonTitle: entry.lessonTitle || String(entry.lessonId),
        quizTitle: entry.quizTitle || 'Lesson quiz',
        attempts,
        attemptsCount,
        bestPercent,
        passPercent: entry.passPercent ?? 60,
        passed,
        lastAttemptAt: lastAttemptAt ? String(lastAttemptAt) : null,
      };
    })
    .sort((a, b) => parseTimestamp(b?.lastAttemptAt) - parseTimestamp(a?.lastAttemptAt));
};
