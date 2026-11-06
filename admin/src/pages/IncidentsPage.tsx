import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, formatDateTime } from '@/lib/utils';
import { AlertOctagon, Siren, Check, CheckCheck } from 'lucide-react';

const SEV_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};

export default function IncidentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', status, type],
    queryFn: () => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (type) p.set('type', type);
      return api(`/incidents?${p}`);
    },
    refetchInterval: 30000,
  });

  const ackMut = useMutation({
    mutationFn: (id: number) => api(`/incidents/${id}/acknowledge`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
  const resolveMut = useMutation({
    mutationFn: (id: number) => api(`/incidents/${id}/resolve`, { method: 'PUT', body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const incidents = data?.data || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><AlertOctagon className="w-6 h-6" /> Incidents & SOS</h1>
        <p className="text-sm text-gray-500">Field incident reports and panic alerts</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input bg-white"><option value="">All</option>{['open', 'acknowledged', 'resolved'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="input bg-white"><option value="">All</option><option value="incident">Incident</option><option value="sos">SOS</option></select></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading ? <div className="px-4 py-8 text-center text-gray-500">Loading…</div>
        : incidents.length === 0 ? <div className="px-4 py-8 text-center text-gray-500">No incidents</div>
        : incidents.map((i: any) => (
          <div key={i.id} className={`px-4 py-3 flex items-start gap-3 ${i.type === 'sos' && i.status === 'open' ? 'bg-red-50' : ''}`}>
            {i.type === 'sos' ? <Siren className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" /> : <AlertOctagon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{i.type === 'sos' ? 'SOS' : (i.category || 'Incident')}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLORS[i.severity]}`}>{i.severity}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.status === 'open' ? 'bg-red-100 text-red-700' : i.status === 'acknowledged' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{i.status}</span>
              </div>
              {i.description && <p className="text-sm text-gray-600 mt-0.5">{i.description}</p>}
              <div className="text-xs text-gray-400 mt-1">
                {i.guard_name || '—'}{i.site_name ? ` · ${i.site_name}` : ''} · {formatDateTime(i.created_at)}
                {i.lat != null && <a className="ml-2 text-blue-500 underline" href={`https://maps.google.com/?q=${i.lat},${i.lng}`} target="_blank" rel="noreferrer">map</a>}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {i.status === 'open' && <button onClick={() => ackMut.mutate(i.id)} title="Acknowledge" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><Check className="w-4 h-4" /></button>}
              {i.status !== 'resolved' && <button onClick={() => resolveMut.mutate(i.id)} title="Resolve" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><CheckCheck className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
