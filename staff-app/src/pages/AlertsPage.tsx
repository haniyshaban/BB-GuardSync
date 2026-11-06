import { useEffect, useState, useCallback } from 'react';
import { api, formatTime } from '@/lib/utils';
import { Bell, Siren, Check } from 'lucide-react';

export default function AlertsPage() {
  const [tab, setTab] = useState<'alerts' | 'incidents'>('alerts');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([
        api('/alerts?status=active'),
        api('/incidents?status=open'),
      ]);
      setAlerts(a.data || []);
      setIncidents(i.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const ackAlert = async (id: number) => { await api(`/alerts/${id}/acknowledge`, { method: 'PUT' }); load(); };
  const ackIncident = async (id: number) => { await api(`/incidents/${id}/acknowledge`, { method: 'PUT' }); load(); };

  const sevDot = (s: string) => s === 'critical' ? 'bg-red-500' : s === 'high' ? 'bg-orange-500' : s === 'medium' ? 'bg-amber-400' : 'bg-gray-400';

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4"><Bell className="w-5 h-5" /> Alerts & SOS</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('alerts')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'alerts' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Alerts ({alerts.length})</button>
        <button onClick={() => setTab('incidents')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'incidents' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Incidents ({incidents.length})</button>
      </div>

      {loading ? <p className="text-gray-500 text-center py-8">Loading…</p>
      : tab === 'alerts' ? (
        <div className="bg-white rounded-xl border divide-y divide-gray-100">
          {alerts.length === 0 ? <div className="px-4 py-8 text-center text-gray-500">No active alerts</div>
          : alerts.map(a => (
            <div key={a.id} className="px-4 py-3 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sevDot(a.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900">{a.message}</div>
                <div className="text-xs text-gray-400">{a.site_name || a.guard_name || '—'} · {formatTime(a.created_at)}</div>
              </div>
              <button onClick={() => ackAlert(a.id)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><Check className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y divide-gray-100">
          {incidents.length === 0 ? <div className="px-4 py-8 text-center text-gray-500">No open incidents</div>
          : incidents.map(i => (
            <div key={i.id} className={`px-4 py-3 flex items-start gap-3 ${i.type === 'sos' ? 'bg-red-50' : ''}`}>
              {i.type === 'sos' && <Siren className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{i.type === 'sos' ? 'SOS' : (i.category || 'Incident')} · {i.guard_name}</div>
                {i.description && <div className="text-sm text-gray-600">{i.description}</div>}
                <div className="text-xs text-gray-400">{i.site_name || ''} · {formatTime(i.created_at)}
                  {i.lat != null && <a className="ml-2 text-blue-500 underline" href={`https://maps.google.com/?q=${i.lat},${i.lng}`} target="_blank" rel="noreferrer">map</a>}
                </div>
              </div>
              <button onClick={() => ackIncident(i.id)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><Check className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
