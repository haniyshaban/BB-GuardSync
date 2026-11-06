import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, formatTime } from '@/lib/utils';
import { Radio, AlertTriangle, Users, Battery, ShieldAlert, Siren, RefreshCw, MapPinOff } from 'lucide-react';

function Tile({ icon: Icon, label, value, tone = 'default' }: any) {
  const tones: Record<string, string> = {
    default: 'bg-white text-gray-900',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    ok: 'bg-green-50 text-green-700 border-green-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-70"><Icon className="w-4 h-4" />{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function CommandCentrePage() {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['command-live'],
    queryFn: () => api('/command/live'),
    refetchInterval: 20000, // live refresh every 20s
  });

  const scanMut = useMutation({
    mutationFn: () => api('/command/scan-shortages', { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['command-live'] }),
  });

  const d = data?.data;
  const s = d?.summary || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Radio className="w-6 h-6 text-green-600" /> 24×7 Command Centre</h1>
          <p className="text-sm text-gray-500">
            {isLoading ? 'Loading…' : `Live · updated ${dataUpdatedAt ? formatTime(new Date(dataUpdatedAt).toISOString()) : ''}`}
          </p>
        </div>
        <button onClick={() => scanMut.mutate()} disabled={scanMut.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
          <RefreshCw className="w-4 h-4" /> Scan shortages
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Tile icon={Users} label="On duty" value={s.onDuty ?? '—'} tone="ok" />
        <Tile icon={Users} label="Online" value={s.online ?? '—'} />
        <Tile icon={Users} label="Idle" value={s.idle ?? '—'} tone={s.idle ? 'warn' : 'default'} />
        <Tile icon={MapPinOff} label="Off-site" value={s.offsite ?? '—'} tone={s.offsite ? 'danger' : 'default'} />
        <Tile icon={ShieldAlert} label="Shortage" value={s.totalShortage ?? '—'} tone={s.totalShortage ? 'danger' : 'ok'} />
        <Tile icon={Siren} label="Open SOS" value={s.openSos ?? '—'} tone={s.openSos ? 'danger' : 'default'} />
        <Tile icon={AlertTriangle} label="Active alerts" value={s.activeAlerts ?? '—'} tone={s.criticalAlerts ? 'danger' : s.activeAlerts ? 'warn' : 'default'} />
        <Tile icon={Battery} label="Low battery" value={s.lowBattery ?? '—'} tone={s.lowBattery ? 'warn' : 'default'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Site board */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-gray-800">Site deployment</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Site</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Active shift</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Req</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">On duty</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Short</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(d?.sites || []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No sites</td></tr>
                ) : d.sites.map((site: any) => (
                  <tr key={site.site_id} className={site.shortage ? 'bg-red-50' : ''}>
                    <td className="px-4 py-2 font-medium text-gray-900">{site.site_name}</td>
                    <td className="px-4 py-2 text-gray-600">{site.activeShifts?.join(', ') || <span className="text-gray-400">none</span>}</td>
                    <td className="px-4 py-2 text-center">{site.required}</td>
                    <td className="px-4 py-2 text-center">{site.onDuty}</td>
                    <td className={`px-4 py-2 text-center font-semibold ${site.shortage ? 'text-red-600' : 'text-green-600'}`}>{site.shortage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-gray-800">Recent alerts</div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {(d?.recentAlerts || []).length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">No active alerts</div>
            ) : d.recentAlerts.map((a: any) => (
              <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'}`} />
                <div className="min-w-0">
                  <div className="text-sm text-gray-800">{a.message}</div>
                  <div className="text-xs text-gray-400">{a.site_name || a.guard_name || ''} · {formatTime(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live roster */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-gray-800">On-duty roster ({d?.roster?.length || 0})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Guard</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Site</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Battery</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Last ping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(d?.roster || []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No guards on duty</td></tr>
              ) : d.roster.map((g: any) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-2 text-gray-600">{g.site_name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.offsite ? 'bg-purple-100 text-purple-800' : g.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {g.offsite ? `off-site${g.distanceFromSite != null ? ` · ${g.distanceFromSite}m` : ''}` : g.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{g.battery == null ? '—' : <span className={g.battery <= 15 ? 'text-red-600 font-medium' : ''}>{g.battery}%</span>}</td>
                  <td className="px-4 py-2 text-gray-500">{g.lastPing ? formatTime(g.lastPing) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
