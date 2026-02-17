import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';

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

  useEffect(() => {
    if (configRes?.data) {
      const c = configRes.data;
      setForm({
        locationUpdateIntervalMins: c.location_update_interval_mins,
        faceChecksPerDayMin: c.face_checks_per_day_min,
        faceChecksPerDayMax: c.face_checks_per_day_max,
        dataRetentionDays: c.data_retention_days,
        idleThresholdMins: c.idle_threshold_mins,
        idleDistanceMeters: c.idle_distance_meters,
      });
    }
  }, [configRes]);

  const saveMut = useMutation({
    mutationFn: () => api('/config', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config'] }); alert('Settings saved!'); },
  });

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
                className="w-full px-3 py-2 border rounded-lg" min={5} max={120} />
              <p className="text-xs text-gray-400 mt-1">How often guards send GPS location during shift</p>
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

        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saveMut.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
