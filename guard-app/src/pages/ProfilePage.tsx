import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { guardApi } from '@/services/api';
import FaceCapture from '@/components/FaceCapture';
import BiometricConsent from '@/components/BiometricConsent';
import {
  LogOut, Phone, Mail, Building2, Clock, DollarSign, User, ScanFace,
  CheckCircle, AlertTriangle, Trash2, X, ChevronRight, CalendarDays, ShieldCheck,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [faceConsentOpen, setFaceConsentOpen] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  // User detail modal
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Delete flow
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openUserDetail = async () => {
    setUserDetailOpen(true);
    setAttendanceLoading(true);
    try {
      const res = await guardApi.getAttendance(1);
      setRecentAttendance((res.data || []).slice(0, 5));
    } catch {
      setRecentAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const openDeleteConfirm = () => {
    setDeleteNameInput('');
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

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

  if (faceConsentOpen) {
    return (
      <BiometricConsent
        onAccept={() => { setFaceConsentOpen(false); setFaceEnrollOpen(true); }}
        onDecline={() => setFaceConsentOpen(false)}
      />
    );
  }

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
    <div className="px-4 pt-6 safe-top pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Clickable Avatar / Name card */}
      <button
        onClick={openUserDetail}
        className="w-full flex items-center gap-4 mb-6 bg-white rounded-2xl border p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
      >
        <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{user?.name}</h2>
          <p className="text-sm text-gray-500">{user?.employee_id || 'No Employee ID'}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </button>

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
            onClick={() => { setEnrollSuccess(false); setFaceConsentOpen(true); }}
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
            onClick={() => { setEnrollError(''); setFaceConsentOpen(true); }}
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

      {/* ── User Detail Bottom Sheet ── */}
      {userDetailOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setUserDetailOpen(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Account Details</h3>
              <button
                onClick={() => setUserDetailOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Identity header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{user?.name}</p>
                  <p className="text-sm text-gray-500">
                    {user?.employee_id ? `ID: ${user.employee_id}` : 'No Employee ID'}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                    user?.approval_status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {user?.approval_status}
                  </span>
                </div>
              </div>

              {/* Contact & assignment */}
              <div className="bg-gray-50 rounded-xl divide-y">
                <ModalRow icon={<Phone className="w-4 h-4" />} label="Phone" value={user?.phone || '—'} />
                <ModalRow icon={<Mail className="w-4 h-4" />} label="Email" value={user?.email || '—'} />
                <ModalRow icon={<Building2 className="w-4 h-4" />} label="Site" value={user?.siteName || 'Not assigned'} />
                <ModalRow icon={<Clock className="w-4 h-4" />} label="Shift" value={user?.shiftLabel || 'Not assigned'} />
                <ModalRow icon={<DollarSign className="w-4 h-4" />} label="Daily Rate" value={`₹${user?.daily_rate || 0}`} />
                <ModalRow
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="Face Data"
                  value={user?.hasFaceDescriptor ? 'Enrolled ✓' : 'Not enrolled'}
                />
              </div>

              {/* Recent Attendance */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-700">Recent Clock-In History</p>
                </div>
                {attendanceLoading ? (
                  <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
                ) : recentAttendance.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No attendance records yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentAttendance.map((rec: any) => (
                      <div key={rec.id} className="bg-gray-50 rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">{rec.date}</p>
                          {rec.hours_worked != null && (
                            <span className="text-xs text-gray-500">{Number(rec.hours_worked).toFixed(1)} hrs</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>
                            In:{' '}
                            {rec.clock_in
                              ? new Date(rec.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </span>
                          <span>
                            Out:{' '}
                            {rec.clock_out
                              ? new Date(rec.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-green-600 font-medium">Active</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="border border-red-100 bg-red-50/40 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Trash2 className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Danger Zone</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setUserDetailOpen(false); openDeleteConfirm(); }}
                  className="w-full py-2.5 rounded-lg border border-red-300 text-red-600 bg-white font-semibold text-sm hover:bg-red-50 transition-colors"
                >
                  Delete My Account & Data
                </button>
              </div>

              <div className="h-2" />
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Account?</h3>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              This will permanently delete your account and all associated data, including:
            </p>
            <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-0.5">
              <li>Attendance records</li>
              <li>Location history</li>
              <li>Face verification data</li>
              <li>Payroll records</li>
            </ul>

            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Type your name to confirm:</p>
              <p className="text-xs font-mono text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 mb-2 select-all">
                {user?.name}
              </p>
              <input
                type="text"
                value={deleteNameInput}
                onChange={(e) => setDeleteNameInput(e.target.value)}
                placeholder="Enter your name exactly"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            {deleteError && <p className="text-red-600 text-sm mb-3">{deleteError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirmOpen(false); setDeleteError(''); setDeleteNameInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-semibold text-sm text-gray-700 hover:bg-gray-50"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteLoading(true);
                  setDeleteError('');
                  try {
                    await guardApi.deleteAccount();
                    logout();
                  } catch (err: any) {
                    setDeleteError(err.message || 'Deletion failed. Please try again.');
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                disabled={deleteLoading || deleteNameInput.trim() !== user?.name}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-gray-400">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
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
