import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, formatDateTime } from '@/lib/utils';
import { MapPin, Plus, Trash2, Route } from 'lucide-react';

export default function PatrolPage() {
  const qc = useQueryClient();
  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const sites = sitesRes?.data || [];
  const [siteId, setSiteId] = useState('');
  const activeSite = siteId || (sites[0]?.id ? String(sites[0].id) : '');
  const [form, setForm] = useState({ label: '', code: '', lat: '', lng: '', radiusMeters: 50 });

  const { data: cpRes } = useQuery({
    queryKey: ['checkpoints', activeSite],
    queryFn: () => api(`/patrol/sites/${activeSite}/checkpoints`),
    enabled: !!activeSite,
  });
  const { data: covRes } = useQuery({
    queryKey: ['coverage', activeSite],
    queryFn: () => api(`/patrol/coverage/${activeSite}`),
    enabled: !!activeSite,
  });
  const { data: scansRes } = useQuery({
    queryKey: ['scans', activeSite],
    queryFn: () => api(`/patrol/scans?siteId=${activeSite}`),
    enabled: !!activeSite,
  });

  const createMut = useMutation({
    mutationFn: () => api(`/patrol/sites/${activeSite}/checkpoints`, { method: 'POST', body: JSON.stringify({ ...form, lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checkpoints'] }); qc.invalidateQueries({ queryKey: ['coverage'] }); setForm({ label: '', code: '', lat: '', lng: '', radiusMeters: 50 }); },
    onError: (e: any) => alert(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api(`/patrol/checkpoints/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checkpoints'] }); qc.invalidateQueries({ queryKey: ['coverage'] }); },
  });

  const checkpoints = cpRes?.data || [];
  const cov = covRes?.data;
  const scans = scansRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Route className="w-6 h-6" /> Patrolling & Site Visits</h1>
          <p className="text-sm text-gray-500">Checkpoints, GPS-verified scans and route history</p>
        </div>
        <select value={activeSite} onChange={e => setSiteId(e.target.value)} className="input max-w-[220px] bg-white">
          {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {cov && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Checkpoints</div><div className="text-2xl font-bold">{cov.totalCheckpoints}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Covered today</div><div className="text-2xl font-bold">{cov.covered}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Coverage</div><div className="text-2xl font-bold">{cov.totalCheckpoints ? Math.round(cov.covered / cov.totalCheckpoints * 100) : 0}%</div></div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Checkpoints */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-gray-800 flex items-center gap-2"><MapPin className="w-4 h-4" /> Checkpoints</div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {checkpoints.length === 0 ? <div className="px-4 py-6 text-center text-gray-500 text-sm">No checkpoints</div>
            : checkpoints.map((c: any) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.label} {c.code && <span className="text-gray-400">({c.code})</span>}</div>
                  <div className="text-xs text-gray-400">{c.lat != null ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} · ${c.radius_meters}m` : 'no GPS'}{c.last_scan_today ? ' · ✓ scanned today' : ''}</div>
                </div>
                <button onClick={() => delMut.mutate(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {/* Add checkpoint */}
          <div className="p-3 border-t bg-gray-50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="input" />
              <input placeholder="Code / QR (optional)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="Lat" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} className="input" />
              <input placeholder="Lng" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} className="input" />
              <input type="number" placeholder="Radius m" value={form.radiusMeters} onChange={e => setForm({ ...form, radiusMeters: Number(e.target.value) })} className="input" />
            </div>
            <button onClick={() => createMut.mutate()} disabled={!form.label || !activeSite || createMut.isPending} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add checkpoint</button>
          </div>
        </div>

        {/* Scan history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-gray-800">Recent scans</div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {scans.length === 0 ? <div className="px-4 py-6 text-center text-gray-500 text-sm">No scans yet</div>
            : scans.map((s: any) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-900"><span className="font-medium">{s.guard_name}</span> → {s.checkpoint_label}</div>
                  <div className="text-xs text-gray-400">{formatDateTime(s.scanned_at)}{s.distance_meters != null ? ` · ${s.distance_meters}m` : ''}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.verified ? 'verified' : 'out of range'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
