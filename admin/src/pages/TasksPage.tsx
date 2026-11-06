import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, formatDateTime } from '@/lib/utils';
import { ClipboardList, Plus, X, Check } from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700', urgent: 'bg-red-100 text-red-700',
};
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700', verified: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-gray-100 text-gray-400',
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', guardId: '', siteId: '', priority: 'normal', dueAt: '' });

  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const { data: guardsRes } = useQuery({ queryKey: ['guards-active'], queryFn: () => api('/guards?status=active') });
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () => api(`/tasks${statusFilter ? `?status=${statusFilter}` : ''}`),
  });

  const createMut = useMutation({
    mutationFn: () => api('/tasks', { method: 'POST', body: JSON.stringify({ ...form, guardId: form.guardId ? Number(form.guardId) : null, siteId: form.siteId ? Number(form.siteId) : null, dueAt: form.dueAt || null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowNew(false); setForm({ title: '', description: '', guardId: '', siteId: '', priority: 'normal', dueAt: '' }); },
    onError: (e: any) => alert(e.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => api(`/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const tasks = data?.data || [];
  const guards = guardsRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Tasks</h1>
          <p className="text-sm text-gray-500">Assign and verify field tasks</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"><Plus className="w-4 h-4" /> New task</button>
      </div>

      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input max-w-[180px] bg-white">
        <option value="">All statuses</option>
        {['open', 'in_progress', 'done', 'verified', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading ? <div className="px-4 py-8 text-center text-gray-500">Loading…</div>
        : tasks.length === 0 ? <div className="px-4 py-8 text-center text-gray-500">No tasks</div>
        : tasks.map((t: any) => (
          <div key={t.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                </div>
                {t.description && <p className="text-sm text-gray-600 mt-0.5">{t.description}</p>}
                <div className="text-xs text-gray-400 mt-1">
                  {t.guard_name ? `👤 ${t.guard_name}` : 'Unassigned'}{t.site_name ? ` · ${t.site_name}` : ''}{t.due_at ? ` · due ${formatDateTime(t.due_at)}` : ''}
                </div>
                {t.completion_note && <div className="text-xs text-green-700 mt-1">✓ {t.completion_note}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {t.status === 'done' && <button onClick={() => statusMut.mutate({ id: t.id, status: 'verified' })} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"><Check className="w-3 h-3" /> Verify</button>}
                {['open', 'in_progress'].includes(t.status) && <button onClick={() => statusMut.mutate({ id: t.id, status: 'cancelled' })} className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200">Cancel</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg">New task</h3><button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Assign guard</label>
                  <select value={form.guardId} onChange={e => setForm({ ...form, guardId: e.target.value })} className="input bg-white"><option value="">—</option>{guards.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
                  <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })} className="input bg-white"><option value="">—</option>{(sitesRes?.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="input bg-white">{['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Due</label><input type="datetime-local" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} className="input" /></div>
              </div>
              <button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending} className="w-full py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">Create task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
