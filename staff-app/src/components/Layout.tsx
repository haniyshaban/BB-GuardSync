import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/guards', icon: Users, label: 'Guards' },
  { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { staff, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-800 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-bold text-lg leading-tight">Black Belt GuardSync</h1>
            <p className="text-xs text-slate-400">Staff Portal</p>
          </div>
          <button onClick={logout} className="p-2 rounded hover:bg-slate-700 transition" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-slate-700 pt-2">
          <p className="text-sm font-medium text-white">{staff?.name}</p>
          {staff?.site_name && (
            <p className="text-xs text-slate-400">{staff.site_name}</p>
          )}
        </div>
      </header>

      {/* Stale Token Warning */}
      {staff?.tokenStale && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800 flex-1">{staff.message}</p>
            <button
              onClick={logout}
              className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4 sm:p-6 pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2 safe-bottom z-50">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 text-xs px-3 py-1 rounded-lg transition',
                isActive ? 'text-slate-800 font-semibold' : 'text-gray-400')
            }
          >
            <l.icon className="w-5 h-5" />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
