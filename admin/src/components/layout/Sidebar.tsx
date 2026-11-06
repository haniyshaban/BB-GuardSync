import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/utils';
import {
  Radio, Users, Building2, ClipboardCheck, Route, ClipboardList, AlertOctagon,
  Bell, Clock, DollarSign, Package, Eye, Settings, LogOut, X, CalendarOff,
} from 'lucide-react';

type Item = { to: string; icon: any; label: string; badge?: 'alerts' | 'leave' };

const sections: { title?: string; items: Item[] }[] = [
  { items: [{ to: '/', icon: Radio, label: 'Live Dashboard' }] },
  {
    title: 'Workforce',
    items: [
      { to: '/guards', icon: Users, label: 'Guards' },
      { to: '/sites', icon: Building2, label: 'Sites' },
      { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
      { to: '/leave', icon: CalendarOff, label: 'Leave', badge: 'leave' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/patrol', icon: Route, label: 'Patrols' },
      { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
      { to: '/incidents', icon: AlertOctagon, label: 'Incidents & SOS' },
      { to: '/alerts', icon: Bell, label: 'Alerts', badge: 'alerts' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/overtime', icon: Clock, label: 'Overtime' },
      { to: '/payroll', icon: DollarSign, label: 'Payroll' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/assets', icon: Package, label: 'Assets' },
      { to: '/clients', icon: Eye, label: 'Client Access' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { data: countRes } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api('/alerts/count'),
    refetchInterval: 30000,
  });
  const activeAlerts: number = countRes?.data?.active || 0;
  const { data: leaveRes } = useQuery({
    queryKey: ['leave-summary'],
    queryFn: () => api('/leave/summary'),
    refetchInterval: 60000,
  });
  const pendingLeave: number = leaveRes?.data?.pending || 0;
  const badgeCount = (b?: Item['badge']) => (b === 'alerts' ? activeAlerts : b === 'leave' ? pendingLeave : 0);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Black Belt Logo" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Black Belt</h1>
            <p className="text-xs text-gray-400">GuardSync Admin</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-800 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section, i) => (
          <div key={i} className={i > 0 ? 'mt-4' : ''}>
            {section.title && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{section.title}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-white text-gray-900' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="flex-1">{label}</span>
                  {badgeCount(badge) > 0 && (
                    <span className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-white text-[11px] font-semibold text-center ${badge === 'alerts' ? 'bg-red-600' : 'bg-amber-500'}`}>
                      {badgeCount(badge) > 99 ? '99+' : badgeCount(badge)}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button onClick={logout} className="p-2 hover:bg-gray-800 rounded-lg" title="Logout">
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
