import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDate, downloadCSV } from '@/lib/utils';
import { Clock, Download, AlertTriangle } from 'lucide-react';

export default function OvertimePage() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [siteId, setSiteId] = useState('');

  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['overtime', from, to, siteId],
    queryFn: () => {
      const p = new URLSearchParams({ from, to });
      if (siteId) p.set('siteId', siteId);
      return api(`/overtime?${p}`);
    },
  });

  const d = data?.data;
  const handleExport = async () => {
    try {
      const csv = await api<string>(`/overtime/export/${from}/${to}`);
      downloadCSV(csv, `overtime-${from}-to-${to}.csv`);
    } catch { alert('Export failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Clock className="w-6 h-6" /> Overtime Monitoring</h1>
          <p className="text-sm text-gray-500">Duty hours beyond {d?.dailyThreshold ?? 9}h/day threshold</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Sites</option>
            {(sitesRes?.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Total OT hours</div><div className="text-2xl font-bold">{d?.totalOtHours ?? '—'}</div></div>
        <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">OT records</div><div className="text-2xl font-bold">{d?.records?.length ?? '—'}</div></div>
        <div className="bg-amber-50 border-amber-200 rounded-xl border p-4"><div className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Abnormal OT</div><div className="text-2xl font-bold text-amber-700">{d?.abnormalCount ?? '—'}</div></div>
      </div>

      {/* Per-guard summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-gray-800">By guard</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Guard</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">OT days</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Abnormal</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Total OT (h)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
              : (d?.summary || []).length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No overtime in range</td></tr>
              : d.summary.map((g: any) => (
                <tr key={g.guard_id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{g.guard_name}</td>
                  <td className="px-4 py-2 text-center">{g.days}</td>
                  <td className="px-4 py-2 text-center">{g.abnormal_days ? <span className="text-amber-600 font-medium">{g.abnormal_days}</span> : 0}</td>
                  <td className="px-4 py-2 text-right font-semibold">{g.total_ot_hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed records */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-gray-800">Records</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Guard</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Site</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">OT</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(d?.records || []).length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">—</td></tr>
              : d.records.map((r: any) => (
                <tr key={r.id} className={r.abnormal ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-2">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.guard_name}</td>
                  <td className="px-4 py-2 text-gray-600">{r.site_name || '—'}</td>
                  <td className="px-4 py-2 text-right">{r.hours_worked?.toFixed?.(1) ?? r.hours_worked}</td>
                  <td className="px-4 py-2 text-right font-semibold text-amber-700">{r.overtime_hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
