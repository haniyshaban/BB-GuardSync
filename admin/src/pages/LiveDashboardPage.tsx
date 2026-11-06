import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatTime, cn } from '@/lib/utils';
import LiveMap, { STATUS_COLORS, guardStatusLabel, type Focus, type MapGuard } from '@/components/LiveMap';
import { Users, ShieldCheck, MapPinOff, Moon, Bell, Siren, BatteryLow, ChevronRight, UserPlus, CheckCircle2, ArrowUpRight } from 'lucide-react';

type Filter = 'all' | 'out' | 'inactive';

export default function LiveDashboardPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [siteId, setSiteId] = useState(params.get('site') || '');
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<'guards' | 'sites'>('guards');
  const [focus, setFocus] = useState<Focus>(null);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['command-live'],
    queryFn: () => api('/command/live'),
    refetchInterval: 20000,
  });

  const d = data?.data;
  const summary = d?.summary || {};
  const sites: any[] = d?.sites || [];
  const lowBat: number = d?.lowBatteryThreshold ?? 15;

  // Everything below is scoped to the selected site.
  const roster: MapGuard[] = useMemo(
    () => (d?.roster || []).filter((g: any) => !siteId || String(g.site_id) === siteId),
    [d, siteId],
  );
  const sos = useMemo(
    () => (d?.sos || []).filter((s: any) => !siteId || String(s.site_id) === siteId),
    [d, siteId],
  );
  const fences = useMemo(
    () => sites
      .filter(s => s.geofence_enabled && (!siteId || String(s.site_id) === siteId))
      .map(s => ({
        id: s.site_id, name: s.site_name, lat: s.lat, lng: s.lng, radius: s.geofence_radius_m || 150,
        points: s.geofence_type === 'polygon' ? (s.geofence_polygon || []).map((p: any) => [p.lat, p.lng] as [number, number]) : undefined,
      }))
      .filter(f => (f.points && f.points.length >= 3) || (f.lat != null && f.lng != null)),
    [sites, siteId],
  );

  const out = roster.filter(g => g.offsite);
  const inactive = roster.filter(g => !g.offsite && g.status === 'idle');
  const lowBattery = roster.filter(g => g.battery != null && g.battery <= lowBat);
  const visible = filter === 'out' ? out : filter === 'inactive' ? inactive : roster;

  // Zoom to a pin and open its popup. `marker` is the LiveMap pin id ('g-<guardId>' or 'sos-<id>').
  const flyTo = (lat?: number | null, lng?: number | null, marker?: string) => {
    if (lat == null || lng == null) return;
    // A stat filter may be hiding this guard's pin: show everyone again.
    if (marker?.startsWith('g-') && !visible.some(g => `g-${g.id}` === marker)) setFilter('all');
    setFocus({ lat, lng, marker, key: Date.now() });
  };

  // "Needs attention": the few things a supervisor should act on now, most urgent first.
  // `link` opens the matching entry on the Incidents or Alerts page.
  const attention = [
    ...sos.map((s: any) => ({ key: `sos-${s.id}`, tone: 'sos', icon: Siren, title: `SOS from ${s.guard_name}`, sub: `${s.site_name || ''} · ${formatTime(s.created_at)}`, lat: s.lat, lng: s.lng, marker: `sos-${s.id}`, link: `/incidents?id=${s.id}` })),
    ...out.map(g => ({ key: `out-${g.id}`, tone: 'out', icon: MapPinOff, title: `${g.name} is out of location`, sub: `${g.distanceFromSite ?? '?'} m from ${g.site_name}`, lat: g.lat, lng: g.lng, marker: `g-${g.id}`, link: `/alerts?type=offsite&guard=${g.id}` })),
    ...lowBattery.map(g => ({ key: `bat-${g.id}`, tone: 'warn', icon: BatteryLow, title: `${g.name}: battery ${g.battery}%`, sub: g.site_name || '', lat: g.lat, lng: g.lng, marker: `g-${g.id}`, link: `/alerts?type=low_battery&guard=${g.id}` })),
    ...inactive.map(g => ({ key: `ina-${g.id}`, tone: 'muted', icon: Moon, title: `${g.name} is inactive`, sub: `No movement or GPS since ${g.lastPing ? formatTime(g.lastPing) : '—'}`, lat: g.lat, lng: g.lng, marker: `g-${g.id}`, link: `/alerts?guard=${g.id}` })),
  ];

  const siteName = siteId ? sites.find(s => String(s.site_id) === siteId)?.site_name : null;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Dashboard</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {isLoading ? 'Loading…' : `Live · updated ${dataUpdatedAt ? formatTime(new Date(dataUpdatedAt).toISOString()) : ''}`}
          </p>
        </div>
        <select value={siteId} onChange={e => { setSiteId(e.target.value); setFilter('all'); setFocus(null); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[220px]">
          <option value="">All sites ({sites.length})</option>
          {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
        </select>
      </div>

      {summary.pendingEnrollments > 0 && (
        <Link to="/guards?status=pending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 text-blue-800 text-sm hover:bg-blue-100">
          <UserPlus className="w-4 h-4" />
          {summary.pendingEnrollments} guard enrollment{summary.pendingEnrollments === 1 ? '' : 's'} waiting for approval
          <ChevronRight className="w-4 h-4 ml-auto" />
        </Link>
      )}

      {/* Stat cards: the middle three also filter the map and list */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Users} label="Total guards" value={summary.totalGuards} iconBg="bg-gray-900" />
        <Stat icon={ShieldCheck} label="On duty" value={roster.length} iconBg="bg-green-600"
          active={filter === 'all'} onClick={() => setFilter('all')} />
        <Stat icon={MapPinOff} label="Out of location" value={out.length} iconBg="bg-purple-600"
          alert={out.length > 0} active={filter === 'out'} onClick={() => setFilter(filter === 'out' ? 'all' : 'out')} />
        <Stat icon={Moon} label="Inactive" value={inactive.length} iconBg="bg-amber-500"
          active={filter === 'inactive'} onClick={() => setFilter(filter === 'inactive' ? 'all' : 'inactive')} />
        <Stat icon={Bell} label="Active alerts" value={summary.activeAlerts} iconBg="bg-red-600"
          alert={summary.activeAlerts > 0} to="/alerts" sub={sos.length ? `${sos.length} SOS` : undefined} />
      </div>

      {/* Map + attention panel */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">
              Live tracking{siteName ? ` · ${siteName}` : ''}
              {filter !== 'all' && <span className="ml-2 text-xs font-normal text-gray-500">(showing {filter === 'out' ? 'out of location' : 'inactive'} only)</span>}
            </h2>
            <div className="hidden md:flex gap-3 text-xs text-gray-600">
              <Legend color={STATUS_COLORS.active} label="Active" />
              <Legend color={STATUS_COLORS.inactive} label="Inactive" />
              <Legend color={STATUS_COLORS.out} label="Out of location" />
              <Legend color={STATUS_COLORS.sos} label="SOS" />
              <Legend color={STATUS_COLORS.fence} label="Geofence" ring />
            </div>
          </div>
          <LiveMap guards={visible} fences={fences} sos={sos} focus={focus} fitKey={`${siteId}|${filter}|${d ? 1 : 0}`} height={520} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 flex flex-col max-h-[577px]">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Needs attention</h2>
            {attention.length > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">{attention.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {attention.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                <p className="font-medium text-gray-700">All clear</p>
                <p className="text-sm">Every on-duty guard is active and inside their site.</p>
              </div>
            ) : attention.map(a => (
              <div key={a.key} className="flex items-center hover:bg-gray-50">
                <button onClick={() => flyTo(a.lat, a.lng, a.marker)} title={a.lat != null ? 'Show on map' : 'No GPS position yet'}
                  className="flex-1 min-w-0 text-left pl-4 pr-2 py-3 flex gap-3 items-start">
                  <span className={cn('mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', TONES[a.tone])}>
                    <a.icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">{a.title}</span>
                    <span className="block text-xs text-gray-500 truncate">{a.sub}</span>
                  </span>
                </button>
                <button onClick={() => navigate(a.link)}
                  className="mr-3 flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:border-gray-400 hover:text-gray-900">
                  Go to alert <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guards / Sites tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b px-2">
          <TabBtn active={tab === 'guards'} onClick={() => setTab('guards')}>Guards on duty ({visible.length})</TabBtn>
          <TabBtn active={tab === 'sites'} onClick={() => setTab('sites')}>Sites ({sites.length})</TabBtn>
        </div>
        <div className="overflow-x-auto">
          {tab === 'guards' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Guard</th>
                  <th className="text-left px-4 py-2 font-medium">Site</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Battery</th>
                  <th className="text-left px-4 py-2 font-medium">Last GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No guards to show</td></tr>
                ) : visible.map(g => (
                  <tr key={g.id} onClick={() => flyTo(g.lat, g.lng, `g-${g.id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{g.site_name || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge g={g} /></td>
                    <td className={cn('px-4 py-2.5', g.battery != null && g.battery <= lowBat ? 'text-red-600 font-medium' : 'text-gray-700')}>
                      {g.battery == null ? '—' : `${g.battery}%`}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{g.lastPing ? formatTime(g.lastPing) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Site</th>
                  <th className="text-left px-4 py-2 font-medium">Current shift</th>
                  <th className="text-left px-4 py-2 font-medium">On duty</th>
                  <th className="text-left px-4 py-2 font-medium">Geofence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sites.map(s => (
                  <tr key={s.site_id} onClick={() => { setSiteId(String(s.site_id)); setFilter('all'); setTab('guards'); }} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.site_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.activeShifts?.join(', ') || <span className="text-gray-400">No shift now</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className={s.shortage ? 'text-red-600 font-medium' : 'text-gray-900'}>{s.onDuty}{s.required ? ` / ${s.required}` : ''}</span>
                      {s.shortage > 0 && <span className="ml-2 text-xs text-red-600">{s.shortage} short</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{s.geofence_enabled ? (s.geofence_type === 'polygon' ? 'Custom area' : `${s.geofence_radius_m || 150} m`) : <span className="text-amber-600">Not set</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  sos: 'bg-red-100 text-red-600',
  out: 'bg-purple-100 text-purple-600',
  warn: 'bg-amber-100 text-amber-600',
  muted: 'bg-gray-100 text-gray-500',
};

function Stat({ icon: Icon, label, value, iconBg, active, alert, onClick, to, sub }: {
  icon: any; label: string; value: any; iconBg: string; active?: boolean; alert?: boolean; onClick?: () => void; to?: string; sub?: string;
}) {
  const body = (
    <>
      <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0', iconBg)}><Icon className="w-5 h-5" /></span>
      <span className="text-right">
        <span className="block text-xs text-gray-500">{label}</span>
        <span className={cn('block text-2xl font-bold', alert ? 'text-red-600' : 'text-gray-900')}>{value ?? '—'}</span>
        {sub && <span className="block text-xs text-red-600 font-medium">{sub}</span>}
      </span>
    </>
  );
  const cls = cn('flex items-center justify-between gap-3 p-4 bg-white rounded-xl border text-left transition',
    active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200',
    (onClick || to) && 'hover:border-gray-400 cursor-pointer');
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

function StatusBadge({ g }: { g: MapGuard }) {
  const label = guardStatusLabel(g);
  const cls = g.offsite ? 'bg-purple-100 text-purple-800' : g.status === 'idle' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {label}{g.offsite && g.distanceFromSite != null ? ` · ${g.distanceFromSite} m` : ''}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={onClick} className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px', active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700')}>
      {children}
    </button>
  );
}

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span style={ring
        ? { width: 10, height: 10, borderRadius: '50%', border: `1.5px dashed ${color}`, display: 'inline-block' }
        : { width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
