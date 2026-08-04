export const LESSONS_BY_COURSE = {
  'html-css': [
    {
      id: 'getting-started',
      title: 'Getting Started',
      durationMinutes: 15,
      summary: 'Set up your tools and learn how the course is structured.',
      content: [
        { type: 'text', value: 'Welcome! In this lesson you will set up the tools you need and learn how to practice effectively.' },
        { type: 'list', value: ['Install a code editor (VS Code)', 'Create a simple project folder', 'Open the folder and create your first HTML file'] },
        {
          type: 'code',
          language: 'html',
          value: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My First Page</title>\n  </head>\n  <body>\n    <h1>Hello, world!</h1>\n  </body>\n</html>',
        },
      ],
    },
    {
      id: 'semantic-html',
      title: 'Semantic HTML',
      durationMinutes: 25,
      summary: 'Write readable, accessible HTML using semantic elements.',
      content: [
        { type: 'text', value: 'Semantic HTML improves accessibility, SEO, and maintainability by giving meaning to your structure.' },
        { type: 'list', value: ['Use <header>, <main>, <footer>', 'Use headings in order (h1 → h2 → h3)', 'Use <button> for actions and <a> for navigation'] },
        {
          type: 'code',
          language: 'html',
          value: '<header>\n  <nav>\n    <a href="#about">About</a>\n    <a href="#contact">Contact</a>\n  </nav>\n</header>\n<main>\n  <article>\n    <h1>My Post</h1>\n    <p>Semantic structure helps users and screen readers.</p>\n  </article>\n</main>\n<footer>\n  <small>© Keradion</small>\n</footer>',
        },
      ],
    },
    {
      id: 'css-foundations',
      title: 'CSS Foundations',
      durationMinutes: 30,
      summary: 'Understand selectors, the box model, and how styles apply.',
      content: [
        { type: 'text', value: 'CSS controls layout and styling. Start with selectors and the box model to avoid common UI bugs.' },
        { type: 'list', value: ['Selectors: class, id, element', 'Box model: margin, border, padding, content', 'Specificity and cascade'] },
        {
          type: 'code',
          language: 'css',
          value: '.card {\n  padding: 16px;\n  border: 1px solid #e5e7eb;\n  border-radius: 16px;\n}\n\n.card h2 {\n  margin-bottom: 8px;\n}',
        },
      ],
    },
    {
      id: 'layout-flex-grid',
      title: 'Layout With Flex & Grid',
      durationMinutes: 35,
      summary: 'Build responsive layouts using modern CSS layout systems.',
      content: [
        { type: 'text', value: 'Flexbox is great for 1D layouts and alignment, while Grid is ideal for 2D page layouts.' },
        { type: 'list', value: ['Use flex for navbars and rows', 'Use grid for page sections and card layouts', 'Combine both for clean responsive UI'] },
        {
          type: 'code',
          language: 'css',
          value: '.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));\n  gap: 16px;\n}\n\n.row {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}',
        },
      ],
    },
    {
      id: 'responsive-ui',
      title: 'Responsive UI & Accessibility',
      durationMinutes: 25,
      summary: 'Make your UI work well on mobile and desktop, with accessibility in mind.',
      content: [
        { type: 'text', value: 'Responsive design means your layout adapts to different screen sizes. Accessibility ensures everyone can use it.' },
        { type: 'list', value: ['Use mobile-first breakpoints', 'Ensure good color contrast', 'Use labels for inputs and alt text for images'] },
      ],
    },
  ],

  javascript: [
    {
      id: 'js-intro',
      title: 'JavaScript Basics',
      durationMinutes: 30,
      summary: 'Learn variables, data types, and basic operators.',
      content: [
        { type: 'text', value: 'JavaScript runs in the browser and lets you make your pages interactive.' },
        { type: 'list', value: ['Variables: let/const', 'Types: string, number, boolean, null, undefined', 'Operators and comparisons'] },
        { type: 'code', language: 'js', value: "const name = 'Keradion';\nlet points = 0;\npoints += 10;\nconsole.log({ name, points });" },
      ],
    },
    {
      id: 'functions-scope',
      title: 'Functions & Scope',
      durationMinutes: 35,
      summary: 'Write functions and understand scope for predictable code.',
      content: [
        { type: 'text', value: 'Functions help you reuse logic. Scope helps you understand where variables live.' },
        { type: 'list', value: ['Function declarations vs arrow functions', 'Parameters and return values', 'Block scope (let/const)'] },
        { type: 'code', language: 'js', value: 'const add = (a, b) => a + b;\nconsole.log(add(2, 3));' },
      ],
    },
    {
      id: 'arrays-objects',
      title: 'Arrays & Objects',
      durationMinutes: 40,
      summary: 'Work with collections and structured data.',
      content: [
        { type: 'text', value: 'Most applications store data in arrays and objects. Learn common operations to manipulate them.' },
        { type: 'list', value: ['Array methods: map, filter, find', 'Object access and destructuring', 'Immutability basics'] },
      ],
    },
    {
      id: 'dom-events',
      title: 'DOM & Events',
      durationMinutes: 35,
      summary: 'Respond to user actions using events and DOM APIs.',
      content: [
        { type: 'text', value: 'The DOM represents the page structure. Events let you respond to clicks, input, and more.' },
        { type: 'code', language: 'js', value: "document.querySelector('button')?.addEventListener('click', () => {\n  alert('Clicked!');\n});" },
      ],
    },
    {
      id: 'async-basics',
      title: 'Async JavaScript',
      durationMinutes: 35,
      summary: 'Learn promises and async/await for API requests.',
      content: [
        { type: 'text', value: 'Async code helps you fetch data without freezing the UI.' },
        { type: 'code', language: 'js', value: "const load = async () => {\n  const res = await fetch('/api/health');\n  return res.json();\n};" },
      ],
    },
  ],

  react: [
    {
      id: 'react-setup',
      title: 'React Setup & Components',
      durationMinutes: 30,
      summary: 'Understand components and how React renders UI.',
      content: [
        { type: 'text', value: 'React lets you build UIs from reusable components.' },
        { type: 'code', language: 'jsx', value: 'const Hello = ({ name }) => <h1>Hello {name}</h1>;' },
      ],
    },
    {
      id: 'props-state',
      title: 'Props & State',
      durationMinutes: 40,
      summary: 'Pass data with props and manage state with useState.',
      content: [
        { type: 'text', value: 'Props flow down. State changes over time and triggers re-renders.' },
        { type: 'code', language: 'jsx', value: "const Counter = () => {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n};" },
      ],
    },
    {
      id: 'hooks-basics',
      title: 'Hooks Basics',
      durationMinutes: 45,
      summary: 'Use effects and derived state responsibly.',
      content: [
        { type: 'text', value: 'Hooks like useEffect help you run side effects such as data loading.' },
        { type: 'code', language: 'jsx', value: "useEffect(() => {\n  // load data here\n}, []);" },
      ],
    },
    {
      id: 'routing',
      title: 'Routing',
      durationMinutes: 35,
      summary: 'Navigate between pages using react-router.',
      content: [
        { type: 'text', value: 'Client-side routing keeps your app fast and responsive.' },
        { type: 'code', language: 'jsx', value: "<Route path=\"/courses\" element={<CourseCatalog />} />" },
      ],
    },
    {
      id: 'api-calls',
      title: 'API Calls',
      durationMinutes: 40,
      summary: 'Call backend APIs and handle loading and errors.',
      content: [
        { type: 'text', value: 'Use axios or fetch to call your backend and display results in the UI.' },
      ],
    },
  ],

  'node-express': [
    {
      id: 'node-basics',
      title: 'Node Basics',
      durationMinutes: 30,
      summary: 'Understand Node.js runtime and modules.',
      content: [{ type: 'text', value: 'Node.js lets you run JavaScript on the server.' }],
    },
    {
      id: 'express-routing',
      title: 'Express Routing',
      durationMinutes: 35,
      summary: 'Create routes and controllers for your API.',
      content: [{ type: 'code', language: 'js', value: "app.get('/api/health', (req, res) => res.json({ ok: true }));" }],
    },
    {
      id: 'middleware',
      title: 'Middleware',
      durationMinutes: 35,
      summary: 'Use middleware for auth, validation, and logging.',
      content: [{ type: 'text', value: 'Middleware runs between the request and response.' }],
    },
    {
      id: 'auth-jwt',
      title: 'JWT Authentication',
      durationMinutes: 45,
      summary: 'Protect routes with JWT-based authentication.',
      content: [{ type: 'text', value: 'JWT is commonly used to authenticate API requests.' }],
    },
    {
      id: 'error-handling',
      title: 'Error Handling',
      durationMinutes: 30,
      summary: 'Return consistent error responses and handle failures.',
      content: [{ type: 'text', value: 'Use centralized error handling for consistent APIs.' }],
    },
  ],

  databases: [
    {
      id: 'data-modeling',
      title: 'Data Modeling',
      durationMinutes: 30,
      summary: 'Model data for real applications.',
      content: [{ type: 'text', value: 'Good schemas make your app easier to build and maintain.' }],
    },
    {
      id: 'sql-basics',
      title: 'SQL Basics',
      durationMinutes: 40,
      summary: 'Write common SQL queries to read and write data.',
      content: [{ type: 'code', language: 'sql', value: 'SELECT * FROM users WHERE email = ?;' }],
    },
    {
      id: 'nosql-basics',
      title: 'NoSQL Basics',
      durationMinutes: 35,
      summary: 'Work with document databases and collections.',
      content: [{ type: 'text', value: 'NoSQL databases store data in documents for flexibility.' }],
    },
    {
      id: 'indexes',
      title: 'Indexes',
      durationMinutes: 30,
      summary: 'Speed up queries with the right indexes.',
      content: [{ type: 'text', value: 'Indexes help databases find data quickly.' }],
    },
    {
      id: 'integrating-orm',
      title: 'Connecting From Backend',
      durationMinutes: 30,
      summary: 'Connect your API to a database through an ORM/driver.',
      content: [{ type: 'text', value: 'Your backend will use a driver/ORM to connect to the database.' }],
    },
  ],

  'git-github': [
    {
      id: 'git-basics',
      title: 'Git Basics',
      durationMinutes: 25,
      summary: 'Track changes and understand commits.',
      content: [{ type: 'text', value: 'Git records your project history through commits.' }],
    },
    {
      id: 'branching',
      title: 'Branching',
      durationMinutes: 35,
      summary: 'Use branches to work safely on features.',
      content: [{ type: 'text', value: 'Branches help you isolate changes and collaborate.' }],
    },
    {
      id: 'pull-requests',
      title: 'Pull Requests',
      durationMinutes: 30,
      summary: 'Collaborate and review changes with PRs.',
      content: [{ type: 'text', value: 'Pull requests help teams review code before merging.' }],
    },
    {
      id: 'conflicts',
      title: 'Merge Conflicts',
      durationMinutes: 30,
      summary: 'Resolve conflicts when changes overlap.',
      content: [{ type: 'text', value: 'Conflicts happen when Git cannot auto-merge edits.' }],
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      durationMinutes: 25,
      summary: 'Use clear messages and consistent workflows.',
      content: [{ type: 'list', value: ['Commit small changes', 'Write descriptive messages', 'Pull before pushing'] }],
    },
  ],
};

const ADMIN_LESSONS_KEY = 'aclms_admin_lessons';

const readAdminLessons = () => {
  try {
    const raw = localStorage.getItem(ADMIN_LESSONS_KEY);
    if (!raw) return LESSONS_BY_COURSE;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : LESSONS_BY_COURSE;
  } catch {
    return LESSONS_BY_COURSE;
  }
};

export const getLessonsForCourse = (courseId) => {
  if (!courseId) return [];
  const source = readAdminLessons();
  return source?.[courseId] ?? [];
};

export const getLessonById = (courseId, lessonId) => {
  const lessons = getLessonsForCourse(courseId);
  return lessons.find((lesson) => lesson.id === lessonId) ?? null;
};