import { useEffect, useState } from 'react';
import { guardApi } from '@/services/api';
import { getPosition } from '@/services/geo';
import { MapPin, CheckCircle2, Circle } from 'lucide-react';

export default function PatrolPage() {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const res = await guardApi.getMyCheckpoints();
      setCheckpoints(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const scan = async (cp: any) => {
    setScanning(cp.id);
    setMsg('');
    try {
      const { lat, lng } = await getPosition();
      const res = await guardApi.scanCheckpoint({ checkpointId: cp.id, lat, lng });
      setMsg(res.message || 'Scanned');
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Scan failed');
    } finally {
      setScanning(null);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1"><MapPin className="w-5 h-5" /> Patrol Checkpoints</h1>
      <p className="text-sm text-gray-500 mb-4">Tap a checkpoint when you reach it. Your GPS verifies the scan.</p>

      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm text-center">{msg}</div>}

      {loading ? <p className="text-gray-500 text-center py-8">Loading…</p>
      : checkpoints.length === 0 ? <p className="text-gray-500 text-center py-8">No checkpoints at your site.</p>
      : (
        <div className="space-y-3">
          {checkpoints.map(cp => {
            const done = !!cp.last_scan_today;
            return (
              <button key={cp.id} onClick={() => scan(cp)} disabled={scanning === cp.id}
                className={`w-full text-left bg-white rounded-xl border p-4 flex items-center gap-3 active:scale-[0.99] transition-transform ${done ? 'border-green-200' : ''}`}>
                {done ? <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" /> : <Circle className="w-6 h-6 text-gray-300 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{cp.label}</p>
                  <p className="text-xs text-gray-400">{cp.code ? `Code ${cp.code} · ` : ''}{done ? 'Scanned today' : 'Not scanned'}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">{scanning === cp.id ? '…' : done ? 'Re-scan' : 'Scan'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
