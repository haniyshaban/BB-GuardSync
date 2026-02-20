import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { guardApi } from '@/services/api';
import FaceCapture from '@/components/FaceCapture';
import { LogOut, Phone, Mail, Building2, Clock, DollarSign, User, ScanFace, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  const handleFaceEnrolled = async (descriptor: number[]) => {
    setFaceEnrollOpen(false);
    setEnrollError('');
    try {
      await guardApi.updateFace(descriptor);
      updateUser({ hasFaceDescriptor: true });
      setEnrollSuccess(true);
    } catch (err: any) {
      setEnrollError(err.message || 'Failed to save face data. Please try again.');
    }
  };

  if (faceEnrollOpen) {
    return (
      <FaceCapture
        title="Face Enrollment"
        instruction="Your face will be used to verify your identity when clocking in"
        onCapture={handleFaceEnrolled}
        onCancel={() => setFaceEnrollOpen(false)}
      />
    );
  }

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

      {/* Face Enrollment Card */}
      {enrollSuccess ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Face Enrolled Successfully</p>
            <p className="text-xs text-green-600">Your identity will be verified on clock-in</p>
          </div>
        </div>
      ) : user?.hasFaceDescriptor ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-green-800 text-sm">Face Data Enrolled</p>
            <p className="text-xs text-green-600">Identity verification active</p>
          </div>
          <button
            onClick={() => { setEnrollSuccess(false); setFaceEnrollOpen(true); }}
            className="text-xs text-green-700 underline"
          >
            Re-scan
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Face Not Enrolled</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You need to enroll your face to enable identity verification during clock-in and duty checks.
              </p>
            </div>
          </div>
          {enrollError && <p className="text-red-600 text-xs mb-2">{enrollError}</p>}
          <button
            onClick={() => { setEnrollError(''); setFaceEnrollOpen(true); }}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-amber-700 transition-colors"
          >
            <ScanFace className="w-4 h-4" />
            Complete Face Scan
          </button>
        </div>
      )}

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
