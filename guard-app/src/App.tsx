import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import EnrollmentPage from './pages/EnrollmentPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import PayslipPage from './pages/PayslipPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import TasksPage from './pages/TasksPage';
import PatrolPage from './pages/PatrolPage';
import BottomNav from './components/BottomNav';
import SosButton from './components/SosButton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isAuthenticated && (
        <header className="bg-gray-900 text-white px-4 py-3">
          <div>
            <h1 className="font-bold text-lg leading-tight">Black Belt GuardSync</h1>
            <p className="text-xs text-gray-400">Guard Portal</p>
          </div>
        </header>
      )}
      <div className="flex-1 pb-16">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/enroll" element={<EnrollmentPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
          <Route path="/patrol" element={<ProtectedRoute><PatrolPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/payslip" element={<ProtectedRoute><PayslipPage /></ProtectedRoute>} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      {isAuthenticated && <SosButton />}
      {isAuthenticated && <BottomNav />}
    </div>
  );
}
