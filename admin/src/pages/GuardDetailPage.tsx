import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, statusColor, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Phone, Mail, Building2, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function GuardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'attendance' | 'payroll'>('attendance');
  const [showDeleteGuard, setShowDeleteGuard] = useState(false);

  const { data: guardRes, isLoading } = useQuery({
    queryKey: ['guard', id],
    queryFn: () => api(`/guards/${id}`),
  });

  const { data: attendanceRes } = useQuery({
    queryKey: ['guard-attendance', id],
    queryFn: () => api(`/attendance?guardId=${id}&limit=30`),
    enabled: tab === 'attendance',
  });

  const { data: payrollRes } = useQuery({
    queryKey: ['guard-payroll', id],
    queryFn: () => api(`/payroll?guardId=${id}`),
    enabled: tab === 'payroll',
  });

  const deleteGuardMut = useMutation({
    mutationFn: () => api(`/guards/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guards'] });
      navigate('/guards');
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><p className="text-gray-500">Loading...</p></div>;

  const guard = guardRes?.data;
  if (!guard) return <div className="text-center py-12"><p>Guard not found</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/guards')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{guard.name}</h1>
          <p className="text-sm text-gray-500">{guard.employee_id || 'No Employee ID'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(guard.approval_status)}`}>
          {guard.approval_status}
        </span>
        {guard.approval_status === 'active' && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(guard.status)}`}>
            {guard.status}
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Contact Information</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />{guard.phone}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />{guard.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />{guard.site_name || 'Not assigned'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />{guard.shift_label || 'No shift'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <DollarSign className="w-4 h-4" />₹{guard.daily_rate}/day
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Current Status</h2>
          <div className="text-sm text-gray-600">
            <p><strong>Clocked In:</strong> {guard.clocked_in ? 'Yes' : 'No'}</p>
            {guard.clock_in_time && <p><strong>Since:</strong> {formatDateTime(guard.clock_in_time)}</p>}
            <p><strong>Registered:</strong> {formatDate(guard.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {['attendance', 'payroll'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Clock In</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Clock Out</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(attendanceRes?.data || []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No attendance records</td></tr>
              ) : (
                (attendanceRes?.data || []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">{formatDate(a.date)}</td>
                    <td className="px-4 py-3">{a.clock_in ? formatDateTime(a.clock_in) : '—'}</td>
                    <td className="px-4 py-3">{a.clock_out ? formatDateTime(a.clock_out) : '—'}</td>
                    <td className="px-4 py-3">{a.hours_worked ? `${a.hours_worked}h` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Days Worked</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Gross Pay</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Net Pay</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(payrollRes?.data || []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No payroll records</td></tr>
              ) : (
                (payrollRes?.data || []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{`${p.month}/${p.year}`}</td>
                    <td className="px-4 py-3">{p.total_days_worked}</td>
                    <td className="px-4 py-3">₹{p.gross_pay?.toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">₹{p.net_pay?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.status === 'paid' ? 'bg-green-100 text-green-800' :
                        p.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Danger Zone</h3>
            <p className="text-sm text-red-700 mb-4">
              Deleting this guard will remove all associated attendance records, payroll data, and access credentials. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteGuard(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
            >
              Delete Guard
            </button>
          </div>
        </div>
      </div>

      {/* Delete Guard Confirmation */}
      {showDeleteGuard && (
        <DeleteGuardDialog
          guardName={guard.name}
          onClose={() => setShowDeleteGuard(false)}
          onConfirm={() => deleteGuardMut.mutate()}
        />
      )}
    </div>
  );
}

function DeleteGuardDialog({
  guardName,
  onClose,
  onConfirm,
}: {
  guardName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Guard</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This will permanently delete <strong>{guardName}</strong> and all associated data including attendance records and payroll history. This action cannot be undone.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Type <strong className="text-red-600">{guardName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter guard name"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (confirmText === guardName) {
                onConfirm();
              }
            }}
            disabled={confirmText !== guardName}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Guard
          </button>
        </div>
      </div>
    </div>
  );
}
