import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDate, formatDateTime, downloadCSV } from '@/lib/utils';
import { Download, Filter } from 'lucide-react';

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [siteId, setSiteId] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: sitesRes } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api('/sites'),
  });

  const { data: attendanceRes, isLoading } = useQuery({
    queryKey: ['attendance', dateFrom, dateTo, siteId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (siteId) params.set('siteId', siteId);
      params.set('limit', '100');
      return api(`/attendance?${params}`);
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (siteId) params.set('siteId', siteId);

      const token = localStorage.getItem('bb_token');
      const res = await fetch(`/api/attendance/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const csv = await res.text();
      downloadCSV(csv, `attendance-${dateFrom}-to-${dateTo}.csv`);
    } catch (err) {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const records = attendanceRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">{attendanceRes?.total || 0} records</p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
          <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Sites</option>
            {(sitesRes?.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Clock In</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Clock Out</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No records found</td></tr>
              ) : (
                records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.guard_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.site_name || '—'}</td>
                    <td className="px-4 py-3">{r.clock_in ? formatDateTime(r.clock_in) : '—'}</td>
                    <td className="px-4 py-3">{r.clock_out ? formatDateTime(r.clock_out) : <span className="text-amber-600">Active</span>}</td>
                    <td className="px-4 py-3">{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
