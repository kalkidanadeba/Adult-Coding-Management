import { readScopedStorageItem, writeScopedStorageItem } from './clientProgressStorage';

const QUIZ_PROGRESS_KEY = 'quizProgress';

const PASS_DEFAULT = 60;

const readAllQuizProgress = () => {
  try {
    const raw = readScopedStorageItem(QUIZ_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeAllQuizProgress = (progress) => {
  writeScopedStorageItem(QUIZ_PROGRESS_KEY, JSON.stringify(progress));
};

export const getAllQuizProgress = () => {
  const all = readAllQuizProgress();
  const result = {};

  for (const [courseId, lessons] of Object.entries(all)) {
    if (!lessons || typeof lessons !== 'object') continue;

    result[courseId] = {};

    for (const [lessonId, entry] of Object.entries(lessons)) {
      if (!entry || typeof entry !== 'object') continue;

      const attempts = Array.isArray(entry?.attempts) ? entry.attempts : [];
      const bestPercent = typeof entry?.bestPercent === 'number' ? entry.bestPercent : 0;
      const passed = Boolean(entry?.passed);
      const lastAttemptAt = entry?.lastAttemptAt ? String(entry.lastAttemptAt) : null;

      result[courseId][lessonId] = { attempts, bestPercent, passed, lastAttemptAt };
    }
  }

  return result;
};

export const getQuizProgress = (courseId, lessonId) => {
  if (!courseId || !lessonId) return { attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null };

  const all = readAllQuizProgress();
  const entry = all?.[courseId]?.[lessonId];

  const attempts = Array.isArray(entry?.attempts) ? entry.attempts : [];
  const bestPercent = typeof entry?.bestPercent === 'number' ? entry.bestPercent : 0;
  const passed = Boolean(entry?.passed);
  const lastAttemptAt = entry?.lastAttemptAt ? String(entry.lastAttemptAt) : null;

  return { attempts, bestPercent, passed, lastAttemptAt };
};

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getQuizTimeLimitSeconds = (quiz) => {
  if (!quiz) return null;

  const minutes =
    parsePositiveNumber(quiz?.timeLimitMinutes) ??
    parsePositiveNumber(quiz?.time_limit_minutes) ??
    parsePositiveNumber(quiz?.time_limit);

  if (minutes != null) return Math.round(minutes * 60);

  const seconds = parsePositiveNumber(quiz?.timeLimitSeconds) ?? parsePositiveNumber(quiz?.time_limit_seconds);
  if (seconds != null) return Math.round(seconds);

  return null;
};

export const formatQuizCountdown = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const quizTimerStorageKey = (courseId, lessonId) => `quizTimer:${courseId}:${lessonId}`;

export const readQuizTimerSession = (courseId, lessonId) => {
  if (typeof window === 'undefined' || !courseId || !lessonId) return null;

  try {
    const raw = window.sessionStorage.getItem(quizTimerStorageKey(courseId, lessonId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeQuizTimerSession = (courseId, lessonId, payload) => {
  if (typeof window === 'undefined' || !courseId || !lessonId) return;

  try {
    window.sessionStorage.setItem(quizTimerStorageKey(courseId, lessonId), JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
};

export const clearQuizTimerSession = (courseId, lessonId) => {
  if (typeof window === 'undefined' || !courseId || !lessonId) return;

  try {
    window.sessionStorage.removeItem(quizTimerStorageKey(courseId, lessonId));
  } catch {
    // Ignore storage failures.
  }
};

export const saveQuizAttempt = ({ courseId, lessonId, percent, correctCount, total, passPercent = PASS_DEFAULT, answers }) => {
  if (!courseId || !lessonId) return null;

  const all = readAllQuizProgress();
  const courseBucket = all[courseId] && typeof all[courseId] === 'object' ? all[courseId] : {};
  const current = getQuizProgress(courseId, lessonId);

  const timestamp = new Date().toISOString();
  const attempt =
    answers && typeof answers === 'object' && !Array.isArray(answers)
      ? { timestamp, percent, correctCount, total, answers }
      : { timestamp, percent, correctCount, total };
  const attempts = [...current.attempts, attempt].slice(-20);
  const bestPercent = Math.max(current.bestPercent || 0, percent || 0);
  const passed = bestPercent >= (passPercent || PASS_DEFAULT);

  all[courseId] = {
    ...courseBucket,
    [lessonId]: {
      attempts,
      bestPercent,
      passed,
      lastAttemptAt: timestamp,
    },
  };

  writeAllQuizProgress(all);
  return { attempts, bestPercent, passed, lastAttemptAt: timestamp };
};
