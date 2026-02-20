import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDate, formatTime, statusBadge } from '@/lib/utils';
import { CalendarDays, Download } from 'lucide-react';

export default function AttendancePage() {
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', dateFilter],
    queryFn: () => api(`/attendance?date=${dateFilter}&limit=100`),
  });

  const records = data?.data ?? [];

  const exportCSV = async () => {
    try {
      const base = (import.meta.env.VITE_API_URL as string) || '/api';
      const res = await fetch(`${base}/attendance/export?dateFrom=${dateFilter}&dateTo=${dateFilter}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('bb_staff_token')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${dateFilter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Attendance</h2>
        <button onClick={exportCSV} className="flex items-center gap-1 text-sm bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No attendance records for this date</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.guard_name}</p>
                  <p className="text-xs text-gray-500">{r.site_name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(r.clock_out ? 'offline' : 'online')}`}>
                  {r.clock_out ? 'Completed' : 'On Duty'}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div>
                  <p className="text-gray-400">Clock In</p>
                  <p className="font-medium text-gray-700">{formatTime(r.clock_in)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Clock Out</p>
                  <p className="font-medium text-gray-700">{r.clock_out ? formatTime(r.clock_out) : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Hours</p>
                  <p className="font-medium text-gray-700">{r.total_hours ? `${r.total_hours}h` : '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
