import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, downloadCSV } from '@/lib/utils';
import { DollarSign, Download, RefreshCw, FileText, Printer, X } from 'lucide-react';

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

  const [slipRecord, setSlipRecord] = useState<any>(null);

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
    <>
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
                      <div className="flex items-center gap-2">
                      {r.status === 'draft' && (
                        <button onClick={() => approveMut.mutate(r.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">Approve</button>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => markPaidMut.mutate(r.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium">Mark Paid</button>
                      )}
                      <button
                        onClick={() => setSlipRecord(r)}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500"
                      >
                        <FileText className="w-3 h-3" /> PDF
                      </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {slipRecord && (
      <PayslipModal record={slipRecord} onClose={() => setSlipRecord(null)} />
    )}
    </>
  );
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function generatePayslipHTML(r: any): string {
  const monthName = MONTH_NAMES[(r.month || 1) - 1];
  const status = (r.status || 'draft').toUpperCase();
  const statusColor = r.status === 'paid' ? '#16a34a' : r.status === 'approved' ? '#2563eb' : '#6b7280';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip – ${r.guard_name} – ${monthName} ${r.year}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:40px}
  .slip{max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
  .header{background:#111;color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start}
  .header h1{font-size:20px;font-weight:700;letter-spacing:.5px}
  .header p{font-size:12px;color:#9ca3af;margin-top:4px}
  .badge{background:#fff;color:#111;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.5px}
  .body{padding:28px 32px}
  .section{margin-bottom:24px}
  .section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:10px;border-bottom:1px solid #f3f4f6;padding-bottom:6px}
  .row{display:flex;justify-content:space-between;font-size:13.5px;padding:6px 0;border-bottom:1px solid #f9fafb}
  .row .label{color:#374151}
  .row .value{font-weight:500;color:#111}
  .total-row{display:flex;justify-content:space-between;padding:12px 0;font-size:15px;font-weight:700;border-top:2px solid #e5e7eb;margin-top:4px}
  .status-row{display:flex;justify-content:space-between;align-items:center;padding:14px 32px;background:#f9fafb;border-top:1px solid #e5e7eb}
  .status-label{font-size:12px;color:#6b7280}
  .status-value{font-size:13px;font-weight:700;padding:4px 14px;border-radius:20px;background:${statusColor}18;color:${statusColor}}
  .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:28px}
  @media print{body{padding:0}.slip{border:none;border-radius:0}}
</style></head><body>
<div class="slip">
  <div class="header">
    <div>
      <h1>Black Belt GuardSync</h1>
      <p>PAYSLIP &nbsp;·&nbsp; ${monthName.toUpperCase()} ${r.year}</p>
    </div>
    <span class="badge">${status}</span>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Employee Details</div>
      <div class="row"><span class="label">Name</span><span class="value">${r.guard_name || '—'}</span></div>
      <div class="row"><span class="label">Employee ID</span><span class="value">${r.employee_id || '—'}</span></div>
      <div class="row"><span class="label">Site</span><span class="value">${r.site_name || '—'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Earnings</div>
      <div class="row"><span class="label">Days Worked</span><span class="value">${r.total_days_worked} days</span></div>
      <div class="row"><span class="label">Daily Rate</span><span class="value">₹${Number(r.daily_rate).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Gross Pay</span><span class="value">₹${Number(r.gross_pay).toLocaleString('en-IN')}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Deductions</div>
      <div class="row"><span class="label">Total Deductions</span><span class="value">${r.deductions > 0 ? '−₹' + Number(r.deductions).toLocaleString('en-IN') : '—'}</span></div>
    </div>
    <div class="total-row"><span>Net Pay</span><span>₹${Number(r.net_pay).toLocaleString('en-IN')}</span></div>
  </div>
  <div class="status-row">
    <span class="status-label">Payment Status</span>
    <span class="status-value">${status}</span>
  </div>
</div>
<div class="footer">Generated by Black Belt GuardSync &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
</body></html>`;
}

function PayslipModal({ record, onClose }: { record: any; onClose: () => void }) {
  const monthName = MONTH_NAMES[(record.month || 1) - 1];

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=750,height=700');
    if (!w) return;
    w.document.write(generatePayslipHTML(record));
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const statusColor =
    record.status === 'paid' ? 'bg-green-100 text-green-800' :
    record.status === 'approved' ? 'bg-blue-100 text-blue-800' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payslip Preview</h2>
            <p className="text-xs text-gray-500">{monthName} {record.year}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Payslip preview card */}
        <div className="px-6 py-5 space-y-4">
          {/* Guard info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900 text-lg">{record.guard_name}</p>
              <p className="text-sm text-gray-500">{record.employee_id || 'No Employee ID'} &nbsp;·&nbsp; {record.site_name || 'No site'}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}>
              {record.status}
            </span>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-50 rounded-xl divide-y text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-gray-600">Days Worked</span>
              <span className="font-medium">{record.total_days_worked} days</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-gray-600">Daily Rate</span>
              <span className="font-medium">₹{Number(record.daily_rate).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-gray-600">Gross Pay</span>
              <span className="font-medium">₹{Number(record.gross_pay).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-gray-600">Deductions</span>
              <span className={record.deductions > 0 ? 'font-medium text-red-600' : 'text-gray-400'}>
                {record.deductions > 0 ? `−₹${Number(record.deductions).toLocaleString('en-IN')}` : '—'}
              </span>
            </div>
          </div>

          {/* Net pay */}
          <div className="flex justify-between items-center bg-gray-900 text-white rounded-xl px-4 py-3">
            <span className="font-semibold">Net Pay</span>
            <span className="text-xl font-bold">₹{Number(record.net_pay).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
