import { readScopedStorageItem, writeScopedStorageItem } from './clientProgressStorage';

const LESSON_PROGRESS_KEY = 'lessonProgress';
const TRUE_LIKE_VALUES = new Set(['1', 'true', 'yes', 'completed', 'complete', 'done', 'passed']);
const FALSE_LIKE_VALUES = new Set(['0', 'false', 'no', 'pending', 'in-progress', 'in_progress', 'not-completed', 'not_completed']);

const parseCompletionValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (TRUE_LIKE_VALUES.has(normalized)) return true;
    if (FALSE_LIKE_VALUES.has(normalized)) return false;
  }

  return null;
};

export const getLessonId = (lesson) => {
  if (!lesson || typeof lesson !== 'object') return null;

  const id =
    lesson?.code ??
    lesson?.id ??
    lesson?._id ??
    lesson?.slug ??
    lesson?.lessonId ??
    lesson?.lesson_id ??
    null;

  return id != null && id !== '' ? String(id) : null;
};

const getApiLessonCompletedState = (lesson) => {
  const candidates = [
    lesson?.completed,
    lesson?.isCompleted,
    lesson?.is_completed,
    lesson?.completionStatus,
    lesson?.completion_status,
    lesson?.status,
    lesson?.progress?.completed,
    lesson?.progress?.isCompleted,
    lesson?.progress?.is_completed,
    lesson?.progress?.status,
    lesson?.lessonProgress?.completed,
    lesson?.lessonProgress?.isCompleted,
    lesson?.lessonProgress?.is_completed,
    lesson?.lessonProgress?.status,
    lesson?.userProgress?.completed,
    lesson?.userProgress?.isCompleted,
    lesson?.userProgress?.is_completed,
    lesson?.userProgress?.status,
  ];

  for (const candidate of candidates) {
    const parsed = parseCompletionValue(candidate);
    if (parsed !== null) return parsed;
  }

  if (lesson?.completedAt ?? lesson?.completed_at ?? lesson?.progress?.completedAt ?? lesson?.progress?.completed_at) {
    return true;
  }

  return null;
};

const readAllProgress = () => {
  try {
    const raw = readScopedStorageItem(LESSON_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeAllProgress = (progress) => {
  writeScopedStorageItem(LESSON_PROGRESS_KEY, JSON.stringify(progress));
};

export const getAllLessonProgress = () => {
  const all = readAllProgress();
  const result = {};

  for (const [courseId, entry] of Object.entries(all)) {
    const completed = Array.isArray(entry?.completed) ? entry.completed.map(String) : [];
    const lastViewed = entry?.lastViewed ? String(entry.lastViewed) : null;

    result[courseId] = { completed, lastViewed };
  }

  return result;
};

export const getCourseProgress = (courseId) => {
  const all = readAllProgress();
  const entry = all?.[courseId];

  const completed = Array.isArray(entry?.completed) ? entry.completed.map(String) : [];
  const lastViewed = entry?.lastViewed ? String(entry.lastViewed) : null;

  return { completed, lastViewed };
};

export const isLessonCompleted = (courseId, lessonId) => {
  if (!courseId || !lessonId) return false;
  return getCourseProgress(courseId).completed.includes(String(lessonId));
};

export const resolveLessonCompletedState = (courseId, lesson) => {
  const lessonId = getLessonId(lesson);
  const apiState = getApiLessonCompletedState(lesson);
  const localState = courseId && lessonId ? isLessonCompleted(courseId, lessonId) : false;

  return Boolean(localState || apiState === true);
};

export const applyLessonProgress = (courseId, lesson) => {
  if (!lesson || typeof lesson !== 'object') return lesson;
  return {
    ...lesson,
    completed: resolveLessonCompletedState(courseId, lesson),
  };
};

export const applyCourseLessonProgress = (courseId, lessons) =>
  Array.isArray(lessons) ? lessons.map((lesson) => applyLessonProgress(courseId, lesson)) : [];

export const setLessonCompleted = (courseId, lessonId, completed) => {
  if (!courseId || !lessonId) return;

  const all = readAllProgress();
  const current = getCourseProgress(courseId);

  const normalizedLessonId = String(lessonId);
  const nextCompleted = completed
    ? Array.from(new Set([...current.completed, normalizedLessonId]))
    : current.completed.filter((id) => id !== normalizedLessonId);

  all[courseId] = { ...all[courseId], completed: nextCompleted };
  writeAllProgress(all);
};

export const setLastViewedLesson = (courseId, lessonId) => {
  if (!courseId || !lessonId) return;

  const all = readAllProgress();
  all[courseId] = { ...all[courseId], lastViewed: String(lessonId) };
  writeAllProgress(all);
};
