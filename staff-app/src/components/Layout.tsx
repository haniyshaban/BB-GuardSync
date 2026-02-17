import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, LogOut } from 'lucide-react';
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
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg leading-tight">Black Belt GuardSync</h1>
          <p className="text-xs text-slate-400">Staff Portal</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 hidden sm:block">{staff?.name}</span>
          <button onClick={logout} className="p-2 rounded hover:bg-slate-700 transition" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

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
