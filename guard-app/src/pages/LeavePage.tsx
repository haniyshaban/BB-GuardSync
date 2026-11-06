import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardApi } from '@/services/api';
import { ArrowLeft, CalendarOff, Plus, X } from 'lucide-react';

const TYPES = [
  { key: 'casual', label: 'Casual' },
  { key: 'sick', label: 'Sick' },
  { key: 'earned', label: 'Earned' },
  { key: 'other', label: 'Other' },
];
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const today = () => new Date().toISOString().split('T')[0];
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

export default function LeavePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'casual', startDate: today(), endDate: today(), reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await guardApi.getMyLeave();
      setRequests(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setError('');
    if (form.endDate < form.startDate) { setError('End date cannot be before start date'); return; }
    setSaving(true);
    try {
      await guardApi.applyLeave({ ...form, reason: form.reason.trim() || undefined });
      setShowForm(false);
      setForm({ leaveType: 'casual', startDate: today(), endDate: today(), reason: '' });
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not submit');
    } finally { setSaving(false); }
  };

  const cancel = async (id: number) => {
    if (!confirm('Cancel this leave request?')) return;
    try { await guardApi.cancelLeave(id); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Leave</h1>
        <button onClick={() => { setShowForm(true); setError(''); }} className="flex items-center gap-1 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Apply
        </button>
      </div>

      {loading ? <p className="text-gray-500 text-center py-8">Loading…</p>
      : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CalendarOff className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No leave requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 capitalize">{r.leave_type} leave</p>
                  <p className="text-sm text-gray-600">
                    {fmt(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmt(r.end_date)}` : ''} · {days(r.start_date, r.end_date)} day{days(r.start_date, r.end_date) === 1 ? '' : 's'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
              </div>
              {r.reason && <p className="text-sm text-gray-500 mt-1">{r.reason}</p>}
              {r.review_note && <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg px-3 py-2">Supervisor: {r.review_note}</p>}
              {r.status === 'pending' && (
                <button onClick={() => cancel(r.id)} className="mt-2 text-sm text-red-600 font-medium">Cancel request</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Apply for leave</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {TYPES.map(t => (
                <button key={t.key} onClick={() => setForm({ ...form, leaveType: t.key })}
                  className={`py-2 rounded-lg text-sm font-medium ${form.leaveType === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{t.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="text-xs text-gray-500">From
                <input type="date" min={today()} value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">To
                <input type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </label>
            </div>
            <textarea placeholder="Reason (optional)" rows={3} maxLength={500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button onClick={submit} disabled={saving} className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold disabled:opacity-60">
              {saving ? 'Submitting…' : `Submit · ${days(form.startDate, form.endDate)} day${days(form.startDate, form.endDate) === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
