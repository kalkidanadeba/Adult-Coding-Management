import { COURSE_CATALOG } from '../data/courses';
import { LESSONS_BY_COURSE } from '../data/lessons';
import { QUIZZES_BY_COURSE } from '../data/quizzes';

const STORAGE_KEYS = {
  courses: 'aclms_admin_courses',
  lessons: 'aclms_admin_lessons',
  quizzes: 'aclms_admin_quizzes',
  users: 'aclms_admin_users',
};

const cloneJSON = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_USERS = [
  { id: 'u-1', name: 'Admin User', email: 'admin@aclms.local', role: 'admin', status: 'active' },
  { id: 'u-2', name: 'Meklit Student', email: 'meklit@student.local', role: 'student', status: 'active' },
  { id: 'u-3', name: 'Kalkidan Student', email: 'kalkidan@student.local', role: 'student', status: 'active' },
];

const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneJSON(fallback);
    return JSON.parse(raw);
  } catch {
    return cloneJSON(fallback);
  }
};

const writeLS = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getAdminCourses = () => readLS(STORAGE_KEYS.courses, COURSE_CATALOG);
export const saveAdminCourses = (courses) => writeLS(STORAGE_KEYS.courses, courses);

export const getAdminLessons = () => readLS(STORAGE_KEYS.lessons, LESSONS_BY_COURSE);
export const saveAdminLessons = (lessons) => writeLS(STORAGE_KEYS.lessons, lessons);

export const getAdminQuizzes = () => readLS(STORAGE_KEYS.quizzes, QUIZZES_BY_COURSE);
export const saveAdminQuizzes = (quizzes) => writeLS(STORAGE_KEYS.quizzes, quizzes);

export const getAdminUsers = () => readLS(STORAGE_KEYS.users, DEFAULT_USERS);
export const saveAdminUsers = (users) => writeLS(STORAGE_KEYS.users, users);

export const getAdminStats = () => {
  const courses = getAdminCourses();
  const lessons = getAdminLessons();
  const quizzes = getAdminQuizzes();
  const users = getAdminUsers();

  const lessonCount = Object.values(lessons).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  const quizCount = Object.values(quizzes).reduce(
    (sum, perCourse) => sum + Object.keys(perCourse ?? {}).length,
    0
  );
  const activeUsers = users.filter((user) => user.status === 'active').length;

  return {
    courses: courses.length,
    lessons: lessonCount,
    quizzes: quizCount,
    users: users.length,
    activeUsers,
  };
};
