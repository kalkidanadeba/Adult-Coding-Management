import api from './api';

const unwrap = (response) => response?.data?.data ?? response?.data;

const asObject = (value) => (value && typeof value === 'object' ? value : {});

/** Handles wrapped list responses from various Express/Mongo API styles. */
export const extractAdminList = (data, extraKeys = []) => {
  if (Array.isArray(data)) return data;

  const obj = asObject(data);
  const keys = [...extraKeys, 'items', 'results', 'lessons', 'courses', 'quizzes', 'users', 'data'];

  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key];
  }

  const nested = asObject(obj?.data);
  for (const key of keys) {
    if (Array.isArray(nested?.[key])) return nested[key];
  }

  return [];
};

const firstDefinedNumber = (...candidates) => {
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
};

/** Maps common dashboard response shapes to { courses, lessons, quizzes, users, activeUsers }. */
export const normalizeAdminDashboard = (raw) => {
  const obj = asObject(raw);
  const nested = {
    ...asObject(obj.stats),
    ...asObject(obj.counts),
    ...asObject(obj.overview),
    ...asObject(obj.summary),
    ...asObject(obj.metrics),
  };
  const src = { ...nested, ...obj };

  const courses = firstDefinedNumber(
    src.courses,
    src.courseCount,
    src.totalCourses,
    src.numCourses,
    src.coursesCount,
    src.total_courses
  );
  const lessons = firstDefinedNumber(
    src.lessons,
    src.lessonCount,
    src.totalLessons,
    src.numLessons,
    src.lessonsCount,
    src.total_lessons
  );
  const quizzes = firstDefinedNumber(
    src.quizzes,
    src.quizCount,
    src.totalQuizzes,
    src.numQuizzes,
    src.quizzesCount,
    src.total_quizzes
  );
  const users = firstDefinedNumber(
    src.users,
    src.userCount,
    src.totalUsers,
    src.numUsers,
    src.usersCount,
    src.total_users
  );
  const activeUsers = firstDefinedNumber(
    src.activeUsers,
    src.activeUserCount,
    src.active_users,
    src.active
  );

  const out = {};
  if (courses !== undefined) out.courses = courses;
  if (lessons !== undefined) out.lessons = lessons;
  if (quizzes !== undefined) out.quizzes = quizzes;
  if (users !== undefined) out.users = users;
  if (activeUsers !== undefined) out.activeUsers = activeUsers;
  return out;
};

export const adminApi = {
  getDashboard: async () => {
    const raw = unwrap(await api.get('/admin/dashboard'));
    return normalizeAdminDashboard(raw);
  },

  getCourses: async () => {
    const data = unwrap(await api.get('/admin/courses'));
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.courses)) return data.courses;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return data;
  },
  getCourseById: async (id) => unwrap(await api.get(`/admin/courses/${id}`)),
  createCourse: async (payload) => unwrap(await api.post('/admin/courses', payload)),
  updateCourse: async (id, payload) => unwrap(await api.put(`/admin/courses/${id}`, payload)),
  deleteCourse: async (id) => unwrap(await api.delete(`/admin/courses/${id}`)),

  getLessons: async () => {
    const data = unwrap(await api.get('/admin/lessons'));
    return extractAdminList(data, ['lessons']);
  },
  getLessonsByCourse: async (courseId) => {
    if (!courseId) return [];
    const data = unwrap(await api.get(`/admin/courses/${courseId}/lessons`));
    return extractAdminList(data, ['lessons']);
  },
  getLessonById: async (id) => unwrap(await api.get(`/admin/lessons/${id}`)),
  createLesson: async (payload) => unwrap(await api.post('/admin/lessons', payload)),
  updateLesson: async (id, payload) => unwrap(await api.put(`/admin/lessons/${id}`, payload)),
  deleteLesson: async (id) => unwrap(await api.delete(`/admin/lessons/${id}`)),

  getQuizzes: async () => {
    const data = unwrap(await api.get('/admin/quizzes'));
    return extractAdminList(data, ['quizzes']);
  },
  getQuizzesByCourse: async (courseId) => {
    if (!courseId) return [];
    const data = unwrap(await api.get(`/admin/courses/${courseId}/quizzes`));
    return extractAdminList(data, ['quizzes']);
  },
  getQuizzesByLesson: async (lessonId) => {
    if (!lessonId) return [];
    const data = unwrap(await api.get(`/admin/lessons/${lessonId}/quizzes`));
    return extractAdminList(data, ['quizzes']);
  },
  getQuizById: async (id) => unwrap(await api.get(`/admin/quizzes/${id}`)),
  createQuiz: async (payload) => unwrap(await api.post('/admin/quizzes', payload)),
  updateQuiz: async (id, payload) => unwrap(await api.put(`/admin/quizzes/${id}`, payload)),
  deleteQuiz: async (id) => unwrap(await api.delete(`/admin/quizzes/${id}`)),

  getUsers: async () => {
    try {
      const data = unwrap(await api.get('/admin/users'));
      return extractAdminList(data, ['users']);
    } catch {
      // Try alternative endpoints if admin/users doesn't exist
      try {
        const data = unwrap(await api.get('/auth/users'));
        return extractAdminList(data, ['users']);
      } catch {
        try {
          const data = unwrap(await api.get('/users'));
          return extractAdminList(data, ['users']);
        } catch {
          // If no user endpoints exist, return empty array
          return [];
        }
      }
    }
  },
  getUserById: async (id) => unwrap(await api.get(`/admin/users/${id}`)),
  createUser: async (payload) => unwrap(await api.post('/admin/users', payload)),
  updateUser: async (id, payload) => unwrap(await api.put(`/admin/users/${id}`, payload)),
  deleteUser: async (id) => unwrap(await api.delete(`/admin/users/${id}`)),
};

