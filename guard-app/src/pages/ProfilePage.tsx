import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Phone, Mail, Building2, Clock, DollarSign, User } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="px-4 pt-6 safe-top">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
          <p className="text-sm text-gray-500">{user?.employee_id || 'No Employee ID'}</p>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border divide-y">
        <DetailRow icon={<Phone className="w-5 h-5" />} label="Phone" value={user?.phone || '—'} />
        <DetailRow icon={<Mail className="w-5 h-5" />} label="Email" value={user?.email || '—'} />
        <DetailRow icon={<Building2 className="w-5 h-5" />} label="Site" value={user?.siteName || 'Not assigned'} />
        <DetailRow icon={<Clock className="w-5 h-5" />} label="Shift" value={user?.shiftLabel || 'Not assigned'} />
        <DetailRow icon={<DollarSign className="w-5 h-5" />} label="Daily Rate" value={`₹${user?.daily_rate || 0}`} />
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors">
        <LogOut className="w-5 h-5" /> Logout
      </button>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-gray-400">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
