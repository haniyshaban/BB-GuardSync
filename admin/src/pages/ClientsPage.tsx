import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { Eye, Plus, X, Building2, Trash2 } from 'lucide-react';

export default function ClientsPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [manageFor, setManageFor] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [addSiteId, setAddSiteId] = useState('');

  const { data: staffRes } = useQuery({ queryKey: ['staff'], queryFn: () => api('/staff') });
  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const clients = (staffRes?.data || []).filter((s: any) => s.role === 'client');

  const { data: clientSitesRes } = useQuery({
    queryKey: ['client-sites', manageFor?.id],
    queryFn: () => api(`/client/${manageFor.id}/sites`),
    enabled: !!manageFor,
  });

  const createMut = useMutation({
    mutationFn: () => api('/staff', { method: 'POST', body: JSON.stringify({ ...form, role: 'client' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setShowNew(false); setForm({ name: '', email: '', password: '', phone: '' }); },
    onError: (e: any) => alert(e.message),
  });
  const addSiteMut = useMutation({
    mutationFn: () => api(`/client/${manageFor.id}/sites`, { method: 'POST', body: JSON.stringify({ siteId: Number(addSiteId) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-sites'] }); setAddSiteId(''); },
    onError: (e: any) => alert(e.message),
  });
  const removeSiteMut = useMutation({
    mutationFn: (siteId: number) => api(`/client/${manageFor.id}/sites/${siteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-sites'] }),
  });

  const clientSites = clientSitesRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Eye className="w-6 h-6" /> Client Access</h1>
          <p className="text-sm text-gray-500">Read-only portals scoped to specific sites</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"><Plus className="w-4 h-4" /> New client</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {clients.length === 0 ? <div className="px-4 py-8 text-center text-gray-500">No client accounts</div>
        : clients.map((c: any) => (
          <div key={c.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{c.name}</div>
              <div className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
            </div>
            <button onClick={() => setManageFor(c)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"><Building2 className="w-3 h-3" /> Manage sites</button>
          </div>
        ))}
      </div>

      {showNew && (
        <Modal title="New client account" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
            <Field label="Password"><input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input" /></Field>
            <Field label="Phone (optional)"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
            <button onClick={() => createMut.mutate()} disabled={!form.name || !form.email || !form.password || createMut.isPending} className="w-full py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">Create</button>
          </div>
        </Modal>
      )}

      {manageFor && (
        <Modal title={`Sites for ${manageFor.name}`} onClose={() => setManageFor(null)}>
          <div className="space-y-3">
            <div className="space-y-2">
              {clientSites.length === 0 ? <p className="text-sm text-gray-500">No sites assigned — client will see nothing until a site is added.</p>
              : clientSites.map((cs: any) => (
                <div key={cs.site_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm">{cs.site_name}</span>
                  <button onClick={() => removeSiteMut.mutate(cs.site_id)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={addSiteId} onChange={e => setAddSiteId(e.target.value)} className="input bg-white flex-1">
                <option value="">Add a site…</option>
                {(sitesRes?.data || []).filter((s: any) => !clientSites.some((cs: any) => cs.site_id === s.id)).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => addSiteMut.mutate()} disabled={!addSiteId || addSiteMut.isPending} className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">Add</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg">{title}</h3><button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
