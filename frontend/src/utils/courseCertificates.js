import { normalizeStudentResultRow } from './studentResults';
import { lessonRefToIdString, normalizeStudentQuiz } from './studentContent';
import { resolveLessonCompletedState } from './lessonProgress';

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

const toIdString = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const nested =
      value.id ??
      value._id ??
      value.code ??
      value.slug ??
      value.courseId ??
      value.course_id ??
      value.lessonId ??
      value.lesson_id ??
      value.quizId ??
      value.quiz_id;
    return nested == null || nested === '' ? null : String(nested);
  }

  return String(value);
};

const pickQuizLessonId = (quiz) => {
  const fromNormalized = lessonRefToIdString(quiz?.lessonId ?? quiz?.lesson_id ?? quiz?.lesson);
  if (fromNormalized) return fromNormalized;

  const lesson = quiz?.lesson;
  if (lesson && typeof lesson === 'object') {
    const nested = lesson?._id ?? lesson?.id ?? lesson?.code ?? lesson?.slug;
    if (nested != null && nested !== '') return String(nested);
  }

  return null;
};

const getLessonIdCandidates = (lesson) => {
  if (!lesson) return [];

  return Array.from(
    new Set(
      [lesson.id, lesson.code, lesson._id, lesson.slug, lesson.lessonId, lesson.lesson_id]
        .filter((value) => value != null && value !== '')
        .map(String),
    ),
  );
};

const lessonIdsMatch = (lesson, candidateId) => {
  if (candidateId == null || candidateId === '') return false;
  return getLessonIdCandidates(lesson).includes(String(candidateId));
};

const resolveLessonIdForCourse = (lessonRef, lessons) => {
  const ref = lessonRefToIdString(lessonRef);
  if (!ref) return null;

  const matchedLesson = lessons.find((lesson) => lessonIdsMatch(lesson, ref));
  return matchedLesson?.id != null ? String(matchedLesson.id) : ref;
};

const normalizeLesson = (lesson, courseId) => {
  const id =
    lesson?.code ??
    lesson?.id ??
    lesson?._id ??
    lesson?.slug ??
    lesson?.lessonId ??
    lesson?.lesson_id ??
    null;
  return {
    ...lesson,
    id: id != null ? String(id) : null,
    title: lesson?.title ?? lesson?.name ?? '',
    completed: resolveLessonCompletedState(courseId, lesson),
    completedAt:
      lesson?.completedAt ??
      lesson?.completed_at ??
      lesson?.updatedAt ??
      lesson?.updated_at ??
      lesson?.lastCompletedAt ??
      null,
  };
};

const normalizeQuiz = (quiz) => {
  const normalized = normalizeStudentQuiz(quiz);
  const lessonId = pickQuizLessonId(quiz) ?? pickQuizLessonId(normalized) ?? normalized.lessonId ?? null;

  return {
    ...normalized,
    id: normalized.id ?? toIdString(quiz?.id ?? quiz?._id ?? quiz?.quizId ?? quiz?.quiz_id),
    lessonId: lessonId != null ? String(lessonId) : null,
    title: normalized.title ?? quiz?.title ?? quiz?.name ?? 'Lesson quiz',
    isPublished: quiz?.isPublished !== false && quiz?.is_published !== false,
  };
};

const hasRecordedQuizAttempt = (row) => {
  if (!row) return false;
  if (toIdString(row?.quizId ?? row?.quiz_id ?? row?.quiz)) return true;
  if (Array.isArray(row?.attempts) && row.attempts.length > 0) return true;
  if (Array.isArray(row?.history) && row.history.length > 0) return true;

  const attemptsCount =
    parseResultNumber(row?.attemptsCount) ??
    parseResultNumber(row?.attempts_count) ??
    parseResultNumber(row?.attemptNumber) ??
    parseResultNumber(row?.attempt_number);

  return attemptsCount != null && attemptsCount > 0;
};

const isQuizResultPassed = (row) => {
  if (!row || !hasRecordedQuizAttempt(row)) return false;

  const passPercent =
    parseResultNumber(row?.passPercent) ??
    parseResultNumber(row?.pass_percent) ??
    parseResultNumber(row?.passingScore) ??
    parseResultNumber(row?.passing_score) ??
    60;

  if (row?.passed === true || row?.isPassed === true || row?.is_passed === true) {
    return true;
  }

  if (Array.isArray(row.attempts) && row.attempts.length > 0) {
    return row.attempts.some((attempt) => {
      if (attempt?.passed === true) return true;
      const percent = parseResultNumber(attempt?.percent) ?? parseResultNumber(attempt?.score) ?? parseResultNumber(attempt?.percentage);
      return percent != null && percent >= passPercent;
    });
  }

  const bestPercent =
    parseResultNumber(row?.bestPercent) ??
    parseResultNumber(row?.best_percent) ??
    parseResultNumber(row?.bestScore) ??
    parseResultNumber(row?.score) ??
    parseResultNumber(row?.percent) ??
    parseResultNumber(row?.percentage);

  if (bestPercent != null) {
    return bestPercent >= passPercent;
  }

  return false;
};

const parseResultNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const upsertPassedQuizResult = (map, lessonId, row) => {
  if (!lessonId || !row) return;

  const key = String(lessonId);
  const existing = map.get(key);
  const nextPassed = isQuizResultPassed(row);

  if (!existing) {
    map.set(key, { ...row, passed: nextPassed });
    return;
  }

  const existingPassed = isQuizResultPassed(existing);
  const nextTimestamp = row.lastAttemptAt;
  const existingTimestamp = existing.lastAttemptAt;

  if (nextPassed && !existingPassed) {
    map.set(key, { ...row, passed: true });
    return;
  }

  if (nextPassed === existingPassed && parseTimestamp(nextTimestamp) > parseTimestamp(existingTimestamp)) {
    map.set(key, { ...row, passed: nextPassed });
  }
};

const buildRequiredQuizLessonIds = (lessons, normalizedQuizzes, rawQuizzes = []) => {
  const lessonIds = lessons.map((lesson) => String(lesson.id)).filter(Boolean);
  const mappedQuizLessonIds = Array.from(
    new Set(normalizedQuizzes.map((quiz) => String(quiz.lessonId)).filter(Boolean)),
  );
  const rawQuizCount = Array.isArray(rawQuizzes) ? rawQuizzes.filter(Boolean).length : 0;

  if (mappedQuizLessonIds.length > 0) {
    return mappedQuizLessonIds;
  }

  if (rawQuizCount > 0 && lessonIds.length > 0) {
    return lessonIds;
  }

  if (lessonIds.length > 0) {
    return lessonIds;
  }

  return [];
};

const findQuizResultForLesson = (lesson, passedQuizByLessonId) => {
  for (const candidateId of getLessonIdCandidates(lesson)) {
    const row = passedQuizByLessonId.get(candidateId);
    if (row) return row;
  }
  return null;
};

export const buildCourseCertificateStatus = ({ courseId, lessons = [], quizzes = [], results = [] }) => {
  const normalizedCourseId = toIdString(courseId);
  const normalizedLessons = Array.isArray(lessons) ? lessons.map((lesson) => normalizeLesson(lesson, normalizedCourseId)).filter((lesson) => lesson.id) : [];
  const rawQuizzes = Array.isArray(quizzes) ? quizzes : [];
  const normalizedQuizzes = rawQuizzes
    .map(normalizeQuiz)
    .filter((quiz) => quiz.lessonId && quiz.isPublished !== false);
  const normalizedResults = Array.isArray(results) ? results.map(normalizeStudentResultRow) : [];

  const relevantResults = normalizedResults.filter((row) => {
    if (!row?.lessonId) return false;
    if (!normalizedCourseId) return true;
    return String(row.courseId) === String(normalizedCourseId);
  });
  const requiredQuizLessonIds = buildRequiredQuizLessonIds(normalizedLessons, normalizedQuizzes, rawQuizzes);
  const requiredQuizLessonIdSet = new Set(requiredQuizLessonIds.map(String));

  const passedQuizByLessonId = new Map();
  for (const row of relevantResults) {
    const resolvedLessonId = resolveLessonIdForCourse(row.lessonId, normalizedLessons) ?? String(row.lessonId);
    if (!requiredQuizLessonIdSet.has(String(resolvedLessonId))) continue;
    if (!hasRecordedQuizAttempt(row)) continue;
    upsertPassedQuizResult(passedQuizByLessonId, resolvedLessonId, row);
  }

  const completedLessons = normalizedLessons.filter((lesson) => lesson.completed);
  const passedQuizLessonIds = requiredQuizLessonIds.filter((lessonId) => {
    const lesson = normalizedLessons.find((item) => String(item.id) === String(lessonId));
    if (!lesson) return isQuizResultPassed(passedQuizByLessonId.get(String(lessonId)));
    return isQuizResultPassed(findQuizResultForLesson(lesson, passedQuizByLessonId));
  });

  const missingLessons = normalizedLessons.filter((lesson) => !lesson.completed);
  const missingQuizLessons = requiredQuizLessonIds
    .filter((lessonId) => {
      const lesson = normalizedLessons.find((item) => String(item.id) === String(lessonId));
      if (!lesson) return !isQuizResultPassed(passedQuizByLessonId.get(String(lessonId)));
      return !isQuizResultPassed(findQuizResultForLesson(lesson, passedQuizByLessonId));
    })
    .map((lessonId) => normalizedLessons.find((lesson) => String(lesson.id) === String(lessonId)))
    .filter(Boolean);

  const lessonsComplete = normalizedLessons.length > 0 && completedLessons.length === normalizedLessons.length;
  const hasQuizRequirements = requiredQuizLessonIds.length > 0;
  const quizzesComplete =
    hasQuizRequirements && passedQuizLessonIds.length === requiredQuizLessonIds.length;
  const eligible = lessonsComplete && quizzesComplete;

  const completedAt = eligible
    ? pickLatestTimestamp(
        ...completedLessons.map((lesson) => lesson.completedAt),
        ...passedQuizLessonIds.map((lessonId) => {
          const lesson = normalizedLessons.find((item) => String(item.id) === String(lessonId));
          const row = lesson ? findQuizResultForLesson(lesson, passedQuizByLessonId) : passedQuizByLessonId.get(String(lessonId));
          return row?.lastAttemptAt;
        }),
        new Date().toISOString(),
      )
    : null;

  return {
    eligible,
    completedAt,
    lessonsComplete,
    quizzesComplete,
    totalLessons: normalizedLessons.length,
    completedLessons: completedLessons.length,
    requiredQuizCount: requiredQuizLessonIds.length,
    passedQuizCount: passedQuizLessonIds.length,
    hasQuizRequirements,
    missingLessons,
    missingQuizLessons,
    lessonStatus: normalizedLessons,
    quizStatus: normalizedQuizzes.map((quiz) => {
      const lesson = normalizedLessons.find((item) => lessonIdsMatch(item, quiz.lessonId));
      const row = lesson ? findQuizResultForLesson(lesson, passedQuizByLessonId) : passedQuizByLessonId.get(String(quiz.lessonId));

      return {
        ...quiz,
        passed: isQuizResultPassed(row),
        lastAttemptAt: row?.lastAttemptAt ?? null,
      };
    }),
  };
};

export const createCertificateReference = ({ courseId, userId, completedAt }) => {
  const compactCourse = String(courseId ?? 'course').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'COURSE';
  const compactUser = String(userId ?? 'student').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'STUDENT';
  const stamp = (() => {
    const date = completedAt ? new Date(completedAt) : new Date();
    if (Number.isNaN(date.getTime())) return '00000000';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}${month}${day}`;
  })();

  return `KER-${compactCourse}-${compactUser}-${stamp}`;
};
