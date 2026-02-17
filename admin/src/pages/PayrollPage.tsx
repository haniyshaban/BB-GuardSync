import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, downloadCSV } from '@/lib/utils';
import { DollarSign, Download, RefreshCw } from 'lucide-react';

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const qc = useQueryClient();

  const { data: payrollRes, isLoading } = useQuery({
    queryKey: ['payroll', month, year],
    queryFn: () => api(`/payroll?month=${month}&year=${year}`),
  });

  const generateMut = useMutation({
    mutationFn: () => api('/payroll/generate', { method: 'POST', body: JSON.stringify({ month, year }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll'] }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => api(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll'] }),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: number) => api(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'paid' }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll'] }),
  });

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('bb_token');
      const res = await fetch(`/api/payroll/export/${month}/${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const csv = await res.text();
      downloadCSV(csv, `payroll-${month}-${year}.csv`);
    } catch { alert('Export failed'); }
  };

  const records = payrollRes?.data || [];
  const totalGross = records.reduce((s: number, r: any) => s + (r.gross_pay || 0), 0);
  const totalNet = records.reduce((s: number, r: any) => s + (r.net_pay || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500">{records.length} records for {month}/{year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${generateMut.isPending ? 'animate-spin' : ''}`} />
            {generateMut.isPending ? 'Generating...' : 'Generate Payroll'}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg bg-white text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg bg-white text-sm">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Guards</p>
            <p className="text-xl font-bold">{records.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Gross Pay</p>
            <p className="text-xl font-bold">₹{totalGross.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Net Pay</p>
            <p className="text-xl font-bold text-green-700">₹{totalNet.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Days</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Rate/Day</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Gross</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Deductions</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net Pay</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No payroll records. Click "Generate Payroll" to create.</td></tr>
              ) : (
                records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.guard_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.site_name || '—'}</td>
                    <td className="px-4 py-3 text-right">{r.total_days_worked}</td>
                    <td className="px-4 py-3 text-right">₹{r.daily_rate}</td>
                    <td className="px-4 py-3 text-right">₹{r.gross_pay?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">{r.deductions > 0 ? `₹${r.deductions}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{r.net_pay?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        r.status === 'paid' ? 'bg-green-100 text-green-800' :
                        r.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'draft' && (
                        <button onClick={() => approveMut.mutate(r.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">Approve</button>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => markPaidMut.mutate(r.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium">Mark Paid</button>
                      )}
                    </td>
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
