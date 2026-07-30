const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { ensureUploadDirectories } = require('./utils/fileUpload.helpers');
const { serveUploads } = require('./middleware/staticUploads.middleware');

dotenv.config();
ensureUploadDirectories();

const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);


app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use('/api/uploads', serveUploads);
app.use('/uploads', serveUploads);


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many attempts, try again later'
  }
});
app.use('/api/auth', authLimiter);

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many contact form submissions, try again later'
  }
});
app.use('/api/contact', contactLimiter);


const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contact.routes');
const courseRoutes = require('./routes/course.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const lessonRoutes = require('./routes/lesson.routes');
const quizRoutes = require('./routes/quiz.routes');
const resultRoutes = require('./routes/result.routes');
const certificateRoutes = require('./routes/certificate.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const adminRoutes = require('./routes/admin.routes');
const instructorRoutes = require('./routes/instructor.routes');
const uploadRoutes = require('./routes/upload.routes');
const codeExecutionRoutes = require('./routes/codeExecution.routes');
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/uploads', uploadRoutes);

const codeExecutionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many code execution requests, try again later'
  }
});
app.use('/api/code', codeExecutionLimiter, codeExecutionRoutes);


app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server running',
    time: new Date().toISOString()
  });
});


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
