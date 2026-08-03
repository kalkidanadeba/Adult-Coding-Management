import api from './api';
import { groupStudentResults } from '../utils/studentResults';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const asObject = (value) => (value && typeof value === 'object' ? value : {});

const extractList = (data, extraKeys = []) => {
  if (Array.isArray(data)) return data;

  const obj = asObject(data);
  const keys = [
    ...extraKeys,
    'items',
    'results',
    'courses',
    'lessons',
    'quizzes',
    'enrollments',
    'data',
  ];

  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key];
  }

  const nested = asObject(obj?.data);
  for (const key of keys) {
    if (Array.isArray(nested?.[key])) return nested[key];
  }

  return [];
};

const looksLikeCourse = (value) => {
  const obj = asObject(value);
  return Boolean(
    obj?.title ??
      obj?.name ??
      obj?.description ??
      obj?.summary ??
      obj?.code ??
      obj?.courseCode ??
      obj?.course_code
  );
};

const looksLikeLesson = (value) => {
  const obj = asObject(value);
  return Boolean(
    obj?.title ??
      obj?.name ??
      obj?.summary ??
      obj?.description ??
      obj?.content ??
      obj?.videoUrl ??
      obj?.video_url
  );
};

const looksLikeQuiz = (value) => {
  const obj = asObject(value);
  return Boolean(obj?.questions ?? obj?.items ?? obj?.passPercent ?? obj?.pass_percent ?? obj?.title ?? obj?.name);
};

const unwrapFromKey = (value, key, looksLike) => {
  const obj = asObject(value);
  const nested = obj?.[key];
  if (nested && typeof nested === 'object' && looksLike(nested)) return nested;
  return value;
};

const unwrapCourse = (value) => unwrapFromKey(value, 'course', looksLikeCourse);
const unwrapLesson = (value) => unwrapFromKey(value, 'lesson', looksLikeLesson);
const unwrapQuiz = (value) => unwrapFromKey(value, 'quiz', looksLikeQuiz);

const pickId = (value) => {
  if (!value) return null;
  const obj = asObject(value);
  return (
    obj.id ??
    obj._id ??
    obj.courseCode ??
    obj.course_code ??
    obj.courseId ??
    obj.course_id ??
    obj.code ??
    obj.slug ??
    null
  );
};

const getWith404Fallback = async (paths) => {
  let lastErr;
  for (const url of paths) {
    try {
      return await api.get(url);
    } catch (e) {
      lastErr = e;
      if (e?.response?.status !== 404) throw e;
    }
  }
  throw lastErr;
};

export const studentApi = {
  getCourses: async () => {
    const data = unwrap(await api.get('/courses'));
    const list = extractList(data, ['courses']);
    return list.map(unwrapCourse).filter(Boolean);
  },

  getCourseById: async (courseId) => {
    if (!courseId) return null;
    const data = unwrap(await api.get(`/courses/${courseId}`));
    return unwrapCourse(data) ?? null;
  },

  // Student endpoints (per request)
  getLessonsByCourse: async (courseId) => {
    if (!courseId) return [];
    const id = encodeURIComponent(String(courseId).trim());
    const res = await getWith404Fallback([`/lessons/course/${id}`, `/courses/${id}/lessons`]);
    const data = unwrap(res);
    const list = extractList(data, ['lessons']);
    return list.map(unwrapLesson).filter(Boolean);
  },

  getQuizzesByCourse: async (courseId) => {
    if (!courseId) return [];
    const id = encodeURIComponent(String(courseId).trim());
    const res = await getWith404Fallback([`/quizzes/course/${id}`, `/courses/${id}/quizzes`]);
    const data = unwrap(res);
    const list = extractList(data, ['quizzes']);
    return list.map(unwrapQuiz).filter(Boolean);
  },

  getQuizById: async (quizId) => {
    if (!quizId) return null;
    const id = encodeURIComponent(String(quizId).trim());
    const res = await getWith404Fallback([`/quizzes/${id}`]);
    const data = unwrap(res);
    return unwrapQuiz(data);
  },

  getMyResults: async () => {
    const data = unwrap(await api.get('/results/my'));
    const list = extractList(data, ['results']);
    return groupStudentResults(list.filter(Boolean));
  },

  getMyDashboard: async () => {
    const data = unwrap(await api.get('/dashboard/me'));
    return data ?? null;
  },

  getMyCourses: async () => {
    const data = unwrap(await api.get('/enrollments/my-courses'));
    const list = extractList(data, ['courses', 'myCourses', 'enrolledCourses']);
    return list.map(unwrapCourse).filter(Boolean);
  },

  enrollInCourse: async (courseId) => {
    if (!courseId) return null;
    const normalizedCourseId = String(courseId).trim();
    if (!normalizedCourseId) return null;
    return unwrap(await api.post(`/enrollments/${normalizedCourseId}`));
  },

  markLessonCompleted: async ({ courseId, lessonId, completed }) => {
    if (!lessonId && !courseId) return null;

    const payload = { courseId, lessonId, completed: Boolean(completed) };

    try {
      if (courseId && lessonId) return unwrap(await api.post(`/courses/${courseId}/lessons/${lessonId}/complete`, payload));
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }

    try {
      if (lessonId) return unwrap(await api.post(`/lessons/${lessonId}/complete`, payload));
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }

    return unwrap(await api.post('/lessons/complete', payload));
  },

  submitQuizAttempt: async ({ courseId, lessonId, quizId, answers, ...rest }) => {
    const payload = {
      courseId,
      lessonId,
      quizId,
      answers,
      ...rest,
    };

    const id = quizId ?? lessonId ?? courseId ?? pickId(payload);
    try {
      if (quizId) return unwrap(await api.post(`/quizzes/${quizId}/attempt`, payload));
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }

    try {
      if (id) return unwrap(await api.post(`/quizzes/attempt/${id}`, payload));
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }

    return unwrap(await api.post('/quizzes/attempt', payload));
  },

  getCodeLanguages: async () => unwrap(await api.get('/code/languages')),

  executeCode: async ({ language, code, stdin = '', timeoutMs } = {}) => {
    const payload = {
      language,
      code,
      stdin,
    };

    if (timeoutMs) payload.timeoutMs = timeoutMs;

    return unwrap(await api.post('/code/execute', payload));
  },
};

export default studentApi;
