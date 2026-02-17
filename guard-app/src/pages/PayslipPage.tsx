import { useState, useEffect } from 'react';
import { guardApi } from '@/services/api';
import { DollarSign } from 'lucide-react';

export default function PayslipPage() {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    guardApi.getPayroll().then(res => {
      setPayroll(res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const monthName = (m: number) =>
    new Date(2000, m - 1).toLocaleString('en', { month: 'long' });

  return (
    <div className="px-4 pt-6 safe-top">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payslips</h1>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading payslips...</p>
      ) : payroll.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No payslips yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payroll.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {monthName(p.month)} {p.year}
                  </h3>
                  <p className="text-xs text-gray-500">{p.total_days_worked} days worked</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  p.status === 'paid' ? 'bg-green-100 text-green-800' :
                  p.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-600'
                }`}>{p.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Rate/Day</p>
                  <p className="font-medium">₹{p.daily_rate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gross</p>
                  <p className="font-medium">₹{p.gross_pay?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Pay</p>
                  <p className="font-bold text-green-700">₹{p.net_pay?.toLocaleString()}</p>
                </div>
              </div>

              {p.deductions > 0 && (
                <p className="text-xs text-red-500 mt-1">Deductions: ₹{p.deductions}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
