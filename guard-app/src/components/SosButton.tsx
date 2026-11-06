import { useState } from 'react';
import { guardApi } from '@/services/api';
import { getPosition } from '@/services/geo';
import { Siren, X, AlertTriangle } from 'lucide-react';

export default function SosButton() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<'sos' | 'incident'>('sos');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');

  const submit = async () => {
    setSending(true);
    try {
      const { lat, lng } = await getPosition();
      if (mode === 'sos') {
        await guardApi.sendSos(lat, lng, desc || undefined);
      } else {
        await guardApi.reportIncident({ category: category || 'General', description: desc, lat, lng, severity: 'medium' });
      }
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setDesc(''); setCategory(''); }, 1800);
    } catch (e: any) {
      alert(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating SOS button */}
      <button
        onClick={() => { setMode('sos'); setOpen(true); }}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="SOS"
      >
        <Siren className="w-7 h-7" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => !sending && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            {sent ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3"><Siren className="w-7 h-7" /></div>
                <p className="font-semibold text-gray-900">{mode === 'sos' ? 'SOS sent' : 'Incident reported'}</p>
                <p className="text-sm text-gray-500">Your supervisor has been alerted.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {mode === 'sos' ? <><Siren className="w-5 h-5 text-red-600" /> Emergency SOS</> : <><AlertTriangle className="w-5 h-5 text-amber-600" /> Report Incident</>}
                  </h3>
                  <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <div className="flex gap-2 mb-3">
                  <button onClick={() => setMode('sos')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'sos' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>SOS</button>
                  <button onClick={() => setMode('incident')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'incident' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Incident</button>
                </div>

                {mode === 'incident' && (
                  <input placeholder="Category (e.g. Trespass, Fire)" value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2" />
                )}
                <textarea placeholder={mode === 'sos' ? 'Optional note…' : 'What happened?'} value={desc} onChange={e => setDesc(e.target.value)}
                  rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />

                <button onClick={submit} disabled={sending}
                  className={`w-full py-3 rounded-lg text-white font-semibold disabled:opacity-60 ${mode === 'sos' ? 'bg-red-600' : 'bg-amber-500'}`}>
                  {sending ? 'Sending…' : mode === 'sos' ? 'Send SOS now' : 'Submit report'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Your current location will be attached.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
