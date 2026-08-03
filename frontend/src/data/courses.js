import { FaDatabase, FaGitAlt, FaHtml5, FaJs, FaNodeJs, FaReact } from 'react-icons/fa';

export const COURSE_LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];
export const COURSE_CATEGORIES = ['All', 'Frontend', 'Backend', 'Database', 'Tools'];

export const COURSE_CATALOG = [
  {
    id: 'html-css',
    title: 'HTML & CSS',
    category: 'Frontend',
    level: 'Beginner',
    lessons: 12,
    durationHours: 8,
    tags: ['HTML', 'CSS', 'Responsive'],
    description: 'Build modern, responsive interfaces using semantic HTML and clean CSS styling.',
    outcomes: ['Create responsive layouts', 'Use flexbox and grid', 'Style accessible UI components'],
    Icon: FaHtml5,
  },
  {
    id: 'javascript',
    title: 'JavaScript',
    category: 'Frontend',
    level: 'Beginner',
    lessons: 14,
    durationHours: 10,
    tags: ['ES6+', 'DOM', 'Functions'],
    description: 'Learn core programming fundamentals and write interactive web experiences with JavaScript.',
    outcomes: ['Understand variables and functions', 'Work with arrays/objects', 'Manipulate the DOM'],
    Icon: FaJs,
  },
  {
    id: 'react',
    title: 'React',
    category: 'Frontend',
    level: 'Intermediate',
    lessons: 16,
    durationHours: 12,
    tags: ['Components', 'State', 'Hooks'],
    description: 'Build component-based UIs, manage state, and create real-world frontend projects.',
    outcomes: ['Create reusable components', 'Use hooks effectively', 'Build multi-page apps'],
    Icon: FaReact,
  },
  {
    id: 'node-express',
    title: 'Node & Express',
    category: 'Backend',
    level: 'Intermediate',
    lessons: 15,
    durationHours: 12,
    tags: ['REST API', 'Auth', 'Middleware'],
    description: 'Create REST APIs, implement authentication, and connect a frontend to a backend service.',
    outcomes: ['Build REST endpoints', 'Handle auth flows', 'Structure Express apps'],
    Icon: FaNodeJs,
  },
  {
    id: 'databases',
    title: 'Databases',
    category: 'Database',
    level: 'Intermediate',
    lessons: 10,
    durationHours: 8,
    tags: ['SQL', 'NoSQL', 'Modeling'],
    description: 'Understand data modeling and learn how to store, query, and manage application data.',
    outcomes: ['Design basic schemas', 'Write common queries', 'Connect backend to a database'],
    Icon: FaDatabase,
  },
  {
    id: 'git-github',
    title: 'Git & GitHub',
    category: 'Tools',
    level: 'Beginner',
    lessons: 9,
    durationHours: 6,
    tags: ['Version Control', 'Branches', 'Collaboration'],
    description: 'Track changes, collaborate with others, and manage project history using Git and GitHub.',
    outcomes: ['Use branches confidently', 'Resolve common conflicts', 'Collaborate via pull requests'],
    Icon: FaGitAlt,
  },
  ];

const ADMIN_COURSES_KEY = 'aclms_admin_courses';
const DEFAULT_ICON = FaHtml5;

const readAdminCourses = () => {
  try {
    const raw = localStorage.getItem(ADMIN_COURSES_KEY);
    if (!raw) return COURSE_CATALOG;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : COURSE_CATALOG;
  } catch {
    return COURSE_CATALOG;
  }
};

const iconById = COURSE_CATALOG.reduce((acc, course) => {
  acc[course.id] = course.Icon;
  return acc;
}, {});

const iconByCategory = {
  Frontend: FaReact,
  Backend: FaNodeJs,
  Database: FaDatabase,
  Tools: FaGitAlt,
};

const withCourseIcon = (course) => ({
  ...course,
  Icon: course?.Icon || iconById[course?.id] || iconByCategory[course?.category] || DEFAULT_ICON,
});

export const getCourseCatalog = () => readAdminCourses().map(withCourseIcon);

export const getCourseById = (courseId) => getCourseCatalog().find((course) => course.id === courseId);
