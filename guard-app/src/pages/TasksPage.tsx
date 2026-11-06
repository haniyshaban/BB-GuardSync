import { useEffect, useState } from 'react';
import { guardApi } from '@/services/api';
import { ClipboardList, Check, Play } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await guardApi.getMyTasks();
      setTasks(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const update = async (id: number, status: string) => {
    setBusy(id);
    try {
      let note: string | undefined;
      if (status === 'done') note = prompt('Completion note (optional)') || undefined;
      await guardApi.updateTaskStatus(id, status, note);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(null); }
  };

  const priorityColor: Record<string, string> = {
    low: 'text-gray-500', normal: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600',
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4"><ClipboardList className="w-5 h-5" /> My Tasks</h1>
      {loading ? <p className="text-gray-500 text-center py-8">Loading…</p>
      : tasks.length === 0 ? <p className="text-gray-500 text-center py-8">No tasks assigned.</p>
      : (
        <div className="space-y-3">
          {tasks.map(t => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  {t.description && <p className="text-sm text-gray-600 mt-0.5">{t.description}</p>}
                  <p className={`text-xs mt-1 font-medium ${priorityColor[t.priority]}`}>
                    {t.priority.toUpperCase()}{t.site_name ? ` · ${t.site_name}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${t.status === 'done' || t.status === 'verified' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              {['open', 'in_progress'].includes(t.status) && (
                <div className="flex gap-2 mt-3">
                  {t.status === 'open' && (
                    <button onClick={() => update(t.id, 'in_progress')} disabled={busy === t.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50"><Play className="w-4 h-4" /> Start</button>
                  )}
                  <button onClick={() => update(t.id, 'done')} disabled={busy === t.id}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"><Check className="w-4 h-4" /> Mark done</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
