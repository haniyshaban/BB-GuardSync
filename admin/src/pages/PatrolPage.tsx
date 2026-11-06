import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatDateTime } from '@/lib/utils';
import { Route } from 'lucide-react';
import { PatrolCheckpointsEditor } from '@/components/SiteMapEditors';

export default function PatrolPage() {
  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const sites = sitesRes?.data || [];
  const [siteId, setSiteId] = useState('');
  const activeSite = siteId || (sites[0]?.id ? String(sites[0].id) : '');

  // Full site record (with geofence polygon) so the map can frame the site and draw its fence.
  const { data: siteRes } = useQuery({
    queryKey: ['site', activeSite],
    queryFn: () => api(`/sites/${activeSite}`),
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

  const site = siteRes?.data;
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

      {/* Patrol route map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Patrol route{site ? ` · ${site.name}` : ''}</h2>
          {site && <Link to={`/sites/${site.id}/manage`} className="text-sm text-gray-500 hover:text-gray-900">Edit geofence →</Link>}
        </div>
        {site
          ? <PatrolCheckpointsEditor key={site.id} site={site} siteId={String(site.id)} />
          : <div className="px-4 py-12 text-center text-gray-500 text-sm">{sites.length ? 'Loading…' : 'Add a site first to set up patrol checkpoints.'}</div>}
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
  );
}
