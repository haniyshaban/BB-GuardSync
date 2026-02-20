import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, statusBadge } from '@/lib/utils';
import { Users, UserCheck, Clock, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api('/stats/dashboard'),
    refetchInterval: 30_000,
  });

  const s = stats?.data;

  const cards = [
    { label: 'Total Guards', value: s?.totalGuards ?? '-', icon: Users, color: 'bg-blue-500', to: '/guards' },
    { label: 'Online Now', value: s?.onlineGuards ?? '-', icon: UserCheck, color: 'bg-green-500', to: '/guards?status=online' },
    { label: 'Idle', value: s?.idleGuards ?? '-', icon: Clock, color: 'bg-yellow-500', to: '/guards?status=idle' },
    { label: 'Pending Enrollment', value: s?.pendingEnrollments ?? '-', icon: AlertCircle, color: 'bg-orange-500', to: '/guards?approval=pending' },
  ];

  // recent attendance
  const { data: attn } = useQuery({
    queryKey: ['recent-attendance'],
    queryFn: () => api('/attendance?limit=10'),
    refetchInterval: 60_000,
  });

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Dashboard</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map(c => (
          <button
            key={c.label}
            onClick={() => navigate(c.to)}
            className="bg-white rounded-xl border p-4 flex items-start gap-3 text-left hover:shadow-md hover:border-slate-300 active:scale-95 transition-all cursor-pointer"
          >
            <div className={`${c.color} p-2 rounded-lg text-white shrink-0`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Today status bar */}
      {s && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Guard Status Overview</h3>
          <div className="flex rounded-full overflow-hidden h-4">
            {(s.onlineGuards ?? 0) > 0 && (
              <div className="bg-green-500" style={{ width: `${((s.onlineGuards / s.totalGuards) * 100)}%` }} title={`${s.onlineGuards} online`} />
            )}
            {(s.idleGuards ?? 0) > 0 && (
              <div className="bg-yellow-400" style={{ width: `${((s.idleGuards / s.totalGuards) * 100)}%` }} title={`${s.idleGuards} idle`} />
            )}
            {(s.offlineGuards ?? 0) > 0 && (
              <div className="bg-gray-300" style={{ width: `${((s.offlineGuards / s.totalGuards) * 100)}%` }} title={`${s.offlineGuards} offline`} />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Online</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Idle</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Offline</span>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-xl border">
        <h3 className="text-sm font-semibold text-gray-700 px-4 pt-4 pb-2">Recent Activity</h3>
        {(attn?.data?.length ?? 0) === 0 ? (
          <p className="text-gray-400 text-sm px-4 pb-4">No recent activity</p>
        ) : (
          <div className="divide-y">
            {attn.data.slice(0, 8).map((a: any) => (
              <div key={a.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.guard_name}</p>
                  <p className="text-xs text-gray-500">{a.site_name}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(a.clock_out ? 'offline' : 'online')}`}>
                    {a.clock_out ? 'Clocked Out' : 'On Duty'}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
