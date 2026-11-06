import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GuardsPage from './pages/GuardsPage';
import GuardDetailPage from './pages/GuardDetailPage';
import SitesPage from './pages/SitesPage';
import ManageSitePage from './pages/ManageSitePage';
import AttendancePage from './pages/AttendancePage';
import PayrollPage from './pages/PayrollPage';
import SettingsPage from './pages/SettingsPage';
import CommandCentrePage from './pages/CommandCentrePage';
import AlertsPage from './pages/AlertsPage';
import OvertimePage from './pages/OvertimePage';
import AssetsPage from './pages/AssetsPage';
import TasksPage from './pages/TasksPage';
import IncidentsPage from './pages/IncidentsPage';
import PatrolPage from './pages/PatrolPage';
import ClientsPage from './pages/ClientsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/command" element={<CommandCentrePage />} />
                <Route path="/guards" element={<GuardsPage />} />
                <Route path="/guards/:id" element={<GuardDetailPage />} />
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/sites/:id/manage" element={<ManageSitePage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/patrol" element={<PatrolPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/overtime" element={<OvertimePage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
