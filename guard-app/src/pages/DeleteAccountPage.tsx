import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { guardApi } from '@/services/api';
import { Trash2, LogIn, CheckCircle } from 'lucide-react';

export default function DeleteAccountPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [deleteNameInput, setDeleteNameInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Deleted</h2>
          <p className="text-sm text-gray-500">
            Your account and all associated data have been permanently deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-sm mx-auto pt-8">

        {/* Info card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Delete Your Account</h1>
              <p className="text-xs text-gray-500">Black Belt GuardSync</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            You can permanently delete your GuardSync account and all associated data.
            This action is immediate and cannot be undone.
          </p>

          <p className="text-sm font-semibold text-gray-700 mb-2">The following data will be deleted:</p>
          <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
            <li>Account and identity information</li>
            <li>Facial descriptor data</li>
            <li>Attendance and clock-in/clock-out records</li>
            <li>Location history</li>
            <li>Face verification check records</li>
            <li>Payroll records</li>
          </ul>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-4">
            <p className="font-semibold text-gray-700 mb-1">How to delete via the app:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open the Black Belt GuardSync app</li>
              <li>Go to the <strong>Profile</strong> tab</li>
              <li>Tap your name or profile icon</li>
              <li>Scroll to <strong>Danger Zone</strong></li>
              <li>Tap <strong>"Delete My Account &amp; Data"</strong></li>
            </ol>
          </div>

          <p className="text-xs text-gray-400">
            You may also email us at{' '}
            <a
              href="mailto:privacy@blackbelt-guardsync.com"
              className="underline text-gray-500"
            >
              privacy@blackbelt-guardsync.com
            </a>{' '}
            to request deletion.
          </p>
        </div>

        {/* Action card */}
        {isAuthenticated ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-1">Logged in as</p>
            <p className="text-base font-bold text-gray-900 mb-4">{user?.name}</p>

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
                onClick={() => navigate('/profile')}
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
                    setDeleted(true);
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
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-600 mb-4">
              Log in to delete your account directly from this page.
            </p>
            <button
              onClick={() => navigate('/login', { state: { returnTo: '/delete-account' } })}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800"
            >
              <LogIn className="w-4 h-4" />
              Log In to Delete Account
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
