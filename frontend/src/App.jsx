import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CourseCatalog = lazy(() => import('./pages/CourseCatalog'));
const CourseDetails = lazy(() => import('./pages/CourseDetails'));
const CourseLessons = lazy(() => import('./pages/CourseLessons'));
const LessonViewer = lazy(() => import('./pages/LessonViewer'));
const LessonQuiz = lazy(() => import('./pages/LessonQuiz'));
const CourseCertificate = lazy(() => import('./pages/CourseCertificate'));
const CourseQuizzes = lazy(() => import('./pages/CourseQuizzes'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Results = lazy(() => import('./pages/Results'));
const ResultDetails = lazy(() => import('./pages/ResultDetails'));
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses'));
const AdminLessons = lazy(() => import('./pages/admin/AdminLessons'));
const AdminQuizzes = lazy(() => import('./pages/admin/AdminQuizzes'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const InstructorLiveSessions = lazy(() => import('./pages/InstructorLiveSessions'));
const StudentLiveSessions = lazy(() => import('./pages/StudentLiveSessions'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isPrivilegedUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isPrivilegedUser && (location.pathname === '/dashboard' || location.pathname.startsWith('/courses'))) {
    return <Navigate to="/admin" replace />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isPrivilegedUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isPrivilegedUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const PrivilegedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isPrivilegedUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isPrivilegedUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route Component (redirects to courses if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isPrivilegedUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (isAuthenticated) {
    return <Navigate to={isPrivilegedUser ? '/admin' : '/courses'} replace />;
  }
  
  return children;
};

function AppContent() {
  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Landing page (before login/register) */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />

          {/* Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />
          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />
          <Route
            path="/reset-password/:token"
            element={<ResetPassword />}
          />
          {/* Protected Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/me"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Protected Course Catalog */}
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <CourseCatalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId"
            element={
              <ProtectedRoute>
                <CourseDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId/lessons"
            element={
              <ProtectedRoute>
                <CourseLessons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons/course/:courseId"
            element={
              <ProtectedRoute>
                <CourseLessons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId/lessons/:lessonId"
            element={
              <ProtectedRoute>
                <LessonViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId/lessons/:lessonId/quiz"
            element={
              <ProtectedRoute>
                <LessonQuiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId/certificate"
            element={
              <ProtectedRoute>
                <CourseCertificate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/course/:courseId"
            element={
              <ProtectedRoute>
                <CourseQuizzes />
              </ProtectedRoute>
            }
          />

          {/* Protected Results */}
          <Route
            path="/results"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/my"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:courseId/:lessonId"
            element={
              <ProtectedRoute>
                <ResultDetails />
              </ProtectedRoute>
            }
          />

          {/* Protected Live Sessions for Students */}
          <Route
            path="/live-sessions"
            element={
              <ProtectedRoute>
                <StudentLiveSessions />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/live-sessions"
            element={
              <PrivilegedRoute>
                <InstructorLiveSessions />
              </PrivilegedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="lessons" element={<AdminLessons />} />
            <Route path="quizzes" element={<AdminQuizzes />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          success: {
            style: {
              background: '#22c55e',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#22c55e',
            },
          },
          error: {
            style: {
              background: '#ef4444',
              color: '#fff',
            },
          },
          loading: {
            style: {
              background: '#3b82f6',
              color: '#fff',
            },
          },
        }}
      />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
