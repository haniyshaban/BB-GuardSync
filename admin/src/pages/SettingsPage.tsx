import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: configRes, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => api('/config'),
  });

  const [form, setForm] = useState({
    locationUpdateIntervalMins: 30,
    faceChecksPerDayMin: 2,
    faceChecksPerDayMax: 4,
    dataRetentionDays: 30,
    idleThresholdMins: 35,
    idleDistanceMeters: 50,
  });

  const [originalForm, setOriginalForm] = useState(form);
  const [showConfirm, setShowConfirm] = useState(false);

  // Change password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const changePwMut = useMutation({
    mutationFn: () => api('/staff/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    }),
    onSuccess: () => {
      setPwSuccess('Password changed successfully!');
      setPwError('');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err: any) => {
      setPwError(err.message || 'Failed to change password');
      setPwSuccess('');
    },
  });

  const handleChangePw = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    changePwMut.mutate();
  };

  useEffect(() => {
    if (configRes?.data) {
      const c = configRes.data;
      const newForm = {
        locationUpdateIntervalMins: c.location_update_interval_mins,
        faceChecksPerDayMin: c.face_checks_per_day_min,
        faceChecksPerDayMax: c.face_checks_per_day_max,
        dataRetentionDays: c.data_retention_days,
        idleThresholdMins: c.idle_threshold_mins,
        idleDistanceMeters: c.idle_distance_meters,
      };
      setForm(newForm);
      setOriginalForm(newForm);
    }
  }, [configRes]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
  const isGpsIntervalValid = form.locationUpdateIntervalMins >= 10;

  const saveMut = useMutation({
    mutationFn: () => api('/config', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['config'] }); 
      setShowConfirm(false);
      alert('Settings saved successfully!'); 
    },
  });

  const handleSaveClick = () => {
    if (hasChanges) {
      setShowConfirm(true);
    }
  };

  const handleConfirmSave = () => {
    saveMut.mutate();
  };

  if (isLoading) return <p className="text-gray-500 py-8">Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">System configuration for Black Belt - GuardSync</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Location Tracking
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GPS Update Interval (minutes)</label>
              <input type="number" value={form.locationUpdateIntervalMins}
                onChange={(e) => setForm({ ...form, locationUpdateIntervalMins: Number(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg ${!isGpsIntervalValid ? 'border-red-500 focus:ring-red-500' : ''}`}
                min={10} max={120} />
              {!isGpsIntervalValid && (
                <p className="text-xs text-red-600 mt-1 font-medium">⚠️ Minimum 10 minutes required to avoid excessive data usage</p>
              )}
              {isGpsIntervalValid && (
                <p className="text-xs text-gray-400 mt-1">How often guards send GPS location during shift</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Retention (days)</label>
              <input type="number" value={form.dataRetentionDays}
                onChange={(e) => setForm({ ...form, dataRetentionDays: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg" min={7} max={365} />
              <p className="text-xs text-gray-400 mt-1">Location data older than this is archived monthly</p>
            </div>
          </div>
        </div>

        <hr />

        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Idle Detection</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idle Threshold (minutes)</label>
              <input type="number" value={form.idleThresholdMins}
                onChange={(e) => setForm({ ...form, idleThresholdMins: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg" min={10} max={120} />
              <p className="text-xs text-gray-400 mt-1">Mark idle if no location update within this time</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idle Distance (meters)</label>
              <input type="number" value={form.idleDistanceMeters}
                onChange={(e) => setForm({ ...form, idleDistanceMeters: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg" min={10} max={500} />
              <p className="text-xs text-gray-400 mt-1">Mark idle if guard moved less than this between pings</p>
            </div>
          </div>
        </div>

        <hr />

        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Face Detection Checks</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Checks per Day</label>
              <input type="number" value={form.faceChecksPerDayMin}
                onChange={(e) => setForm({ ...form, faceChecksPerDayMin: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg" min={0} max={10} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Checks per Day</label>
              <input type="number" value={form.faceChecksPerDayMax}
                onChange={(e) => setForm({ ...form, faceChecksPerDayMax: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg" min={1} max={10} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Random face verification checks are scheduled between these min/max values each day when a guard clocks in</p>
        </div>

        <button onClick={handleSaveClick} disabled={!hasChanges || !isGpsIntervalValid || saveMut.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
          <Save className="w-4 h-4" /> {saveMut.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Change Password
        </h2>
        <form onSubmit={handleChangePw} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-600">{pwSuccess}</p>}
          <button type="submit" disabled={changePwMut.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-opacity">
            <KeyRound className="w-4 h-4" /> {changePwMut.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Confirm Settings Update</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to save these settings? This will affect all guards and tracking behavior across the system.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={saveMut.isPending}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button 
                onClick={handleConfirmSave}
                disabled={saveMut.isPending}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {saveMut.isPending ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
