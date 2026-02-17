import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import GuardsPage from '@/pages/GuardsPage';
import AttendancePage from '@/pages/AttendancePage';
import Layout from '@/components/Layout';

export default function App() {
  const { staff, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  if (!staff) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/guards" element={<GuardsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
