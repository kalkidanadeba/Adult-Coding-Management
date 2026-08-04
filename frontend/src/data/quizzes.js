export const QUIZZES_BY_COURSE = {
  'html-css': {
    'getting-started': {
      title: 'Quiz: Getting Started',
      passPercent: 60,
      questions: [
        {
          id: 'q1',
          prompt: 'Which tool is commonly used to write code for web development?',
          options: ['A code editor (VS Code)', 'A calculator', 'A music player', 'A photo gallery'],
          answerIndex: 0,
          explanation: 'A code editor such as VS Code is used to write and manage code files.',
        },
        {
          id: 'q2',
          prompt: 'What does HTML stand for?',
          options: [
            'HyperText Markup Language',
            'HighText Machine Language',
            'Hyper Transfer Markup List',
            'Home Tool Markup Language',
          ],
          answerIndex: 0,
          explanation: 'HTML stands for HyperText Markup Language.',
        },
        {
          id: 'q3',
          prompt: 'Which tag is used for the main page title?',
          options: ['<h1>', '<p>', '<div>', '<span>'],
          answerIndex: 0,
          explanation: '<h1> is the highest-level heading and is used for the main page title.',
        },
      ],
    },
    'semantic-html': {
      title: 'Quiz: Semantic HTML',
      passPercent: 60,
      questions: [
        {
          id: 'q1',
          prompt: 'Why is semantic HTML important?',
          options: [
            'It improves accessibility and readability',
            'It makes files larger',
            'It prevents CSS from working',
            'It removes the need for JavaScript',
          ],
          answerIndex: 0,
          explanation: 'Semantic HTML gives meaning to structure, improving accessibility and maintainability.',
        },
        {
          id: 'q2',
          prompt: 'Which element is most appropriate for site navigation links?',
          options: ['<nav>', '<main>', '<section>', '<footer>'],
          answerIndex: 0,
          explanation: '<nav> is designed for navigation links.',
        },
        {
          id: 'q3',
          prompt: 'Which should you use for an action like submitting a form?',
          options: ['<button>', '<a>', '<div>', '<span>'],
          answerIndex: 0,
          explanation: '<button> is correct for actions; <a> is best for navigation.',
        },
      ],
    },
  },

  javascript: {
    'js-intro': {
      title: 'Quiz: JavaScript Basics',
      passPercent: 60,
      questions: [
        {
          id: 'q1',
          prompt: 'Which keyword creates a block-scoped variable?',
          options: ['let', 'var', 'define', 'make'],
          answerIndex: 0,
          explanation: '`let` creates a block-scoped variable; `const` is also block-scoped.',
        },
        {
          id: 'q2',
          prompt: 'What is the result of 2 + "2" in JavaScript?',
          options: ['"22"', '4', 'NaN', '"4"'],
          answerIndex: 0,
          explanation: 'When adding a number and a string, JavaScript performs string concatenation.',
        },
        {
          id: 'q3',
          prompt: 'Which type represents true/false values?',
          options: ['boolean', 'number', 'string', 'object'],
          answerIndex: 0,
          explanation: 'The boolean type represents true and false.',
        },
      ],
    },
    'functions-scope': {
      title: 'Quiz: Functions & Scope',
      passPercent: 60,
      questions: [
        {
          id: 'q1',
          prompt: 'What does a function return by default if no return statement is provided?',
          options: ['undefined', 'null', '0', 'false'],
          answerIndex: 0,
          explanation: 'A JavaScript function returns `undefined` if there is no return statement.',
        },
        {
          id: 'q2',
          prompt: 'Which is an arrow function?',
          options: ['const add = (a, b) => a + b;', 'function add(a, b) { a + b }', 'add(a, b) = a + b', 'fn add => a + b'],
          answerIndex: 0,
          explanation: 'Arrow functions use the `=>` syntax.',
        },
        {
          id: 'q3',
          prompt: 'What is scope?',
          options: [
            'Where variables can be accessed',
            'A way to style elements',
            'A method to store images',
            'A type of database',
          ],
          answerIndex: 0,
          explanation: 'Scope defines where variables and functions are accessible in your code.',
        },
      ],
    },
  },
};

const ADMIN_QUIZZES_KEY = 'aclms_admin_quizzes';

const readAdminQuizzes = () => {
  try {
    const raw = localStorage.getItem(ADMIN_QUIZZES_KEY);
    if (!raw) return QUIZZES_BY_COURSE;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : QUIZZES_BY_COURSE;
  } catch {
    return QUIZZES_BY_COURSE;
  }
};

export const getQuizForLesson = (courseId, lessonId) => {
  if (!courseId || !lessonId) return null;
  const source = readAdminQuizzes();
  return source?.[courseId]?.[lessonId] ?? null;
};

export const hasQuizForLesson = (courseId, lessonId) => Boolean(getQuizForLesson(courseId, lessonId));
