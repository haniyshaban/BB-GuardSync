import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, statusColor } from '@/lib/utils';
import { Users, Building2, ClipboardCheck, UserPlus, Wifi, WifiOff, Clock } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api('/stats/dashboard'),
    refetchInterval: 30000,
  });

  const s = stats?.data;

  const cards = [
    { label: 'Total Guards', value: s?.totalGuards, icon: Users, color: 'bg-gray-900 text-white', path: '/guards' },
    { label: 'Online', value: s?.onlineGuards, icon: Wifi, color: 'bg-green-50 text-green-700', path: '/guards?status=online' },
    { label: 'Idle', value: s?.idleGuards, icon: Clock, color: 'bg-amber-50 text-amber-700', path: '/guards?status=idle' },
    { label: 'Offline', value: s?.offlineGuards, icon: WifiOff, color: 'bg-red-50 text-red-400', path: '/guards?status=offline' },
    { label: 'Total Sites', value: s?.totalSites, icon: Building2, color: 'bg-blue-50 text-blue-700', path: '/sites' },
    { label: "Today's Attendance", value: s?.todayAttendance, icon: ClipboardCheck, color: 'bg-purple-50 text-purple-700', path: '/attendance' },
    { label: 'Pending Enrollments', value: s?.pendingEnrollments, icon: UserPlus, color: 'bg-orange-50 text-orange-700', path: '/guards?status=pending' },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading dashboard...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Black Belt - GuardSync Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, path }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className={`rounded-xl p-4 ${color} text-left hover:opacity-90 transition-opacity cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="w-5 h-5 opacity-70" />
            </div>
            <p className="text-2xl font-bold">{value ?? '-'}</p>
            <p className="text-sm opacity-70">{label}</p>
          </button>
        ))}
      </div>

      {/* Guard Status Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Guard Status Overview</h2>
        <div className="flex gap-6 items-center">
          <div className="flex-1">
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden flex">
              {s?.totalGuards > 0 && (
                <>
                  <div className="bg-green-500 h-full transition-all" style={{ width: `${((s?.onlineGuards || 0) / s.totalGuards) * 100}%` }} />
                  <div className="bg-amber-400 h-full transition-all" style={{ width: `${((s?.idleGuards || 0) / s.totalGuards) * 100}%` }} />
                  <div className="bg-red-300 h-full transition-all" style={{ width: `${((s?.offlineGuards || 0) / s.totalGuards) * 100}%` }} />
                </>
              )}
            </div>
          </div>red
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" />Online</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" />Idle</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300" />Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
