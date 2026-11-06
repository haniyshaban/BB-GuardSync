import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { Package, Plus, X, Share2 } from 'lucide-react';

export default function AssetsPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [allocFor, setAllocFor] = useState<any>(null);
  const [form, setForm] = useState({ name: '', category: '', assetTag: '', quantity: 1, unitValue: 0 });
  const [alloc, setAlloc] = useState({ guardId: '', siteId: '', quantity: 1 });

  const { data: assetsRes, isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => api('/assets') });
  const { data: summaryRes } = useQuery({ queryKey: ['assets-summary'], queryFn: () => api('/assets/summary') });
  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: () => api('/sites') });
  const { data: guardsRes } = useQuery({ queryKey: ['guards-active'], queryFn: () => api('/guards?status=active') });

  const createMut = useMutation({
    mutationFn: () => api('/assets', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['assets-summary'] }); setShowNew(false); setForm({ name: '', category: '', assetTag: '', quantity: 1, unitValue: 0 }); },
    onError: (e: any) => alert(e.message),
  });
  const allocMut = useMutation({
    mutationFn: () => api(`/assets/${allocFor.id}/allocate`, { method: 'POST', body: JSON.stringify({ guardId: alloc.guardId ? Number(alloc.guardId) : null, siteId: alloc.siteId ? Number(alloc.siteId) : null, quantity: Number(alloc.quantity) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['assets-summary'] }); setAllocFor(null); setAlloc({ guardId: '', siteId: '', quantity: 1 }); },
    onError: (e: any) => alert(e.message),
  });

  const assets = assetsRes?.data || [];
  const sm = summaryRes?.data || {};
  const guards = guardsRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package className="w-6 h-6" /> Assets & Inventory</h1>
          <p className="text-sm text-gray-500">{sm.totalAssets ?? 0} items · ₹{(sm.totalValue ?? 0).toLocaleString('en-IN')} value</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"><Plus className="w-4 h-4" /> Add asset</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Total units</div><div className="text-2xl font-bold">{sm.totalUnits ?? '—'}</div></div>
        <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Issued</div><div className="text-2xl font-bold">{sm.issuedUnits ?? '—'}</div></div>
        <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Available</div><div className="text-2xl font-bold">{sm.availableUnits ?? '—'}</div></div>
        <div className="bg-red-50 border-red-200 rounded-xl border p-4"><div className="text-xs text-red-600">Lost / damaged</div><div className="text-2xl font-bold text-red-700">{sm.lostDamaged ?? '—'}</div></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Asset</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Tag</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Qty</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Issued</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Avail</th>
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              : assets.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No assets yet</td></tr>
              : assets.map((a: any) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-2 text-gray-600">{a.category || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{a.asset_tag || '—'}</td>
                  <td className="px-4 py-2 text-center">{a.quantity}</td>
                  <td className="px-4 py-2 text-center">{a.issued}</td>
                  <td className="px-4 py-2 text-center font-medium">{a.available_qty}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setAllocFor(a)} disabled={a.available_qty <= 0} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"><Share2 className="w-3 h-3" /> Allocate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New asset modal */}
      {showNew && (
        <Modal title="Add asset" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input" /></Field>
              <Field label="Asset tag"><input value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} className="input" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity"><input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} className="input" /></Field>
              <Field label="Unit value (₹)"><input type="number" min={0} value={form.unitValue} onChange={e => setForm({ ...form, unitValue: Number(e.target.value) })} className="input" /></Field>
            </div>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="w-full py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">Create</button>
          </div>
        </Modal>
      )}

      {/* Allocate modal */}
      {allocFor && (
        <Modal title={`Allocate: ${allocFor.name}`} onClose={() => setAllocFor(null)}>
          <div className="space-y-3">
            <Field label="To guard (optional)">
              <select value={alloc.guardId} onChange={e => setAlloc({ ...alloc, guardId: e.target.value, siteId: '' })} className="input bg-white">
                <option value="">—</option>
                {guards.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Or to site (optional)">
              <select value={alloc.siteId} onChange={e => setAlloc({ ...alloc, siteId: e.target.value, guardId: '' })} className="input bg-white">
                <option value="">—</option>
                {(sitesRes?.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={`Quantity (max ${allocFor.available_qty})`}>
              <input type="number" min={1} max={allocFor.available_qty} value={alloc.quantity} onChange={e => setAlloc({ ...alloc, quantity: Number(e.target.value) })} className="input" />
            </Field>
            <button onClick={() => allocMut.mutate()} disabled={(!alloc.guardId && !alloc.siteId) || allocMut.isPending} className="w-full py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">Allocate</button>
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
