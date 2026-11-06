import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, cn, formatDate } from '@/lib/utils';
import { CalendarOff, Check, X } from 'lucide-react';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
] as const;

const TYPE_LABEL: Record<string, string> = { casual: 'Casual', sick: 'Sick', earned: 'Earned', other: 'Other' };
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function dayCount(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}

export default function LeavePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>('pending');
  const [deciding, setDeciding] = useState<{ row: any; status: 'approved' | 'rejected' } | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave', tab],
    queryFn: () => api(`/leave${tab ? `?status=${tab}` : ''}`),
  });
  const { data: summaryRes } = useQuery({ queryKey: ['leave-summary'], queryFn: () => api('/leave/summary') });
  const summary = summaryRes?.data || { pending: 0, onLeaveToday: 0 };
  const rows: any[] = data?.data || [];

  const decide = useMutation({
    mutationFn: () => api(`/leave/${deciding!.row.id}/decision`, { method: 'PUT', body: JSON.stringify({ status: deciding!.status, note: note || undefined }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      qc.invalidateQueries({ queryKey: ['leave-summary'] });
      setDeciding(null); setNote('');
    },
    onError: (e: any) => alert(e.message),
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave</h1>
        <p className="text-sm text-gray-500">Requests submitted by guards from the guard app</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Awaiting decision</p>
          <p className={cn('text-2xl font-bold', summary.pending ? 'text-amber-600' : 'text-gray-900')}>{summary.pending}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">On leave today</p>
          <p className="text-2xl font-bold text-gray-900">{summary.onLeaveToday}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b px-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px', tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}{t.key === 'pending' && summary.pending ? ` (${summary.pending})` : ''}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="px-4 py-10 text-center text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <CalendarOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {tab === 'pending' ? 'No requests waiting for a decision' : 'No leave requests'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(r => (
              <div key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.guard_name}</span>
                    <span className="text-xs text-gray-400">{r.employee_id}</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_STYLE[r.status])}>{r.status}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">
                    <strong>{TYPE_LABEL[r.leave_type] || r.leave_type}</strong> · {formatDate(r.start_date)}
                    {r.end_date !== r.start_date && <> – {formatDate(r.end_date)}</>}
                    <span className="text-gray-500"> ({dayCount(r.start_date, r.end_date)} day{dayCount(r.start_date, r.end_date) === 1 ? '' : 's'})</span>
                    {r.site_name && <span className="text-gray-500"> · {r.site_name}</span>}
                  </p>
                  {r.reason && <p className="text-sm text-gray-500 mt-0.5">"{r.reason}"</p>}
                  {r.reviewed_by_name && (
                    <p className="text-xs text-gray-400 mt-1">{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.reviewed_by_name}{r.review_note ? `: ${r.review_note}` : ''}</p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setDeciding({ row: r, status: 'rejected' }); setNote(''); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><X className="w-4 h-4" /> Reject</button>
                    <button onClick={() => { setDeciding({ row: r, status: 'approved' }); setNote(''); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"><Check className="w-4 h-4" /> Approve</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deciding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !decide.isPending && setDeciding(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg">{deciding.status === 'approved' ? 'Approve' : 'Reject'} leave for {deciding.row.guard_name}?</h3>
            <p className="text-sm text-gray-500 mt-1">
              {TYPE_LABEL[deciding.row.leave_type]} leave, {formatDate(deciding.row.start_date)}
              {deciding.row.end_date !== deciding.row.start_date && <> – {formatDate(deciding.row.end_date)}</>}
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500}
              placeholder="Note to the guard (optional)" className="input mt-4" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeciding(null)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => decide.mutate()} disabled={decide.isPending}
                className={cn('flex-1 py-2 text-white rounded-lg disabled:opacity-50', deciding.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}>
                {decide.isPending ? 'Saving…' : deciding.status === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
