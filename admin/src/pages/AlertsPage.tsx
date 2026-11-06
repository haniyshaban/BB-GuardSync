import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, formatDateTime } from '@/lib/utils';
import { Bell, Check, X } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  sleep: 'Sleep', shortage: 'Shortage', sos: 'SOS', incident: 'Incident',
  overtime: 'Overtime', face_fail: 'Face fail', low_battery: 'Low battery', offline: 'Offline',
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', status, type],
    queryFn: () => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (type) p.set('type', type);
      return api(`/alerts?${p}`);
    },
    refetchInterval: 30000,
  });

  const ackMut = useMutation({
    mutationFn: (id: number) => api(`/alerts/${id}/acknowledge`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const resolveMut = useMutation({
    mutationFn: (id: number) => api(`/alerts/${id}/resolve`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const alerts = data?.data || [];
  const sevDot = (sev: string) => sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'medium' ? 'bg-amber-400' : 'bg-gray-400';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bell className="w-6 h-6" /> Alerts</h1>
        <p className="text-sm text-gray-500">Operational notifications (sleep, shortage, SOS, battery, offline)</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="">All</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">No alerts</div>
        ) : alerts.map((a: any) => (
          <div key={a.id} className="px-4 py-3 flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sevDot(a.severity)}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900">{a.message}</div>
              <div className="text-xs text-gray-400">
                <span className="uppercase tracking-wide">{TYPE_LABELS[a.type] || a.type}</span>
                {' · '}{a.site_name || a.guard_name || '—'}{' · '}{formatDateTime(a.created_at)}
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'active' ? 'bg-red-100 text-red-700' : a.status === 'acknowledged' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
            {a.status === 'active' && (
              <button onClick={() => ackMut.mutate(a.id)} title="Acknowledge" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><Check className="w-4 h-4" /></button>
            )}
            {a.status !== 'resolved' && (
              <button onClick={() => resolveMut.mutate(a.id)} title="Resolve" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><X className="w-4 h-4" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
