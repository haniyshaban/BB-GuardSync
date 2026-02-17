import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Building2, ClipboardCheck,
  DollarSign, Settings, LogOut, X,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/guards', icon: Users, label: 'Guards' },
  { to: '/sites', icon: Building2, label: 'Sites' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/payroll', icon: DollarSign, label: 'Payroll' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Black Belt Logo" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold">Black Belt</h1>
            <p className="text-xs text-gray-400">GuardSync Admin</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-800 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white text-gray-900' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
          <button onClick={logout} className="p-2 hover:bg-gray-800 rounded-lg" title="Logout">
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
