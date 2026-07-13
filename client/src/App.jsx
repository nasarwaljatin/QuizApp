import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import QuizPage from './pages/QuizPage';
import ResultPage from './pages/ResultPage';
import StudentDashboard from './pages/StudentDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageQuizzes from './pages/admin/ManageQuizzes';
import ManageFolders from './pages/admin/ManageFolders';
import GenerateFromPdf from './pages/admin/GenerateFromPdf';
import AdminAnswerKey from './pages/admin/AdminAnswerKey';
import AdminAnswerKeyReview from './pages/admin/AdminAnswerKeyReview';

// ─── Protected Route Wrappers ─────────────────────────────────────────────────

function RequireStudent({ children }) {
  const { isAuthenticated, isStudent } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isStudent) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function RequireGuest({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin/dashboard' : '/'} replace />;
  return children;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public / Guest-only routes */}
      <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
      <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
      <Route path="/forgot-password" element={<RequireGuest><ForgotPassword /></RequireGuest>} />
      <Route path="/admin/login" element={<RequireGuest><AdminLogin /></RequireGuest>} />

      {/* Student routes */}
      <Route path="/" element={<RequireStudent><Home /></RequireStudent>} />
      <Route path="/quiz/:id" element={<RequireStudent><QuizPage /></RequireStudent>} />
      <Route path="/result/:attemptId" element={<RequireStudent><ResultPage /></RequireStudent>} />
      <Route path="/dashboard" element={<RequireStudent><StudentDashboard /></RequireStudent>} />

      {/* Admin routes */}
      <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/quizzes" element={<RequireAdmin><ManageQuizzes /></RequireAdmin>} />
      <Route path="/admin/folders" element={<RequireAdmin><ManageFolders /></RequireAdmin>} />
      <Route path="/admin/generate-from-pdf" element={<RequireAdmin><GenerateFromPdf /></RequireAdmin>} />
      <Route path="/admin/quiz/:id/answer-key" element={<RequireAdmin><AdminAnswerKey /></RequireAdmin>} />
      <Route path="/admin/quiz/:id/review" element={<RequireAdmin><AdminAnswerKeyReview /></RequireAdmin>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
