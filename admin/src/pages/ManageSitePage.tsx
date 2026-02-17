import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function ManageSitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddGuard, setShowAddGuard] = useState(false);
  const [showDeleteSite, setShowDeleteSite] = useState(false);

  const { data: siteRes, isLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => api(`/sites/${id}`),
  });

  const { data: guardsRes } = useQuery({
    queryKey: ['site-guards', id],
    queryFn: () => api(`/guards?siteId=${id}`),
  });

  const { data: allGuardsRes } = useQuery({
    queryKey: ['guards-unassigned'],
    queryFn: () => api('/guards?status=active'),
    enabled: showAddGuard,
  });

  const removeGuardMut = useMutation({
    mutationFn: (guardId: number) => api(`/guards/${guardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ site_id: null, shift_id: null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-guards', id] });
      qc.invalidateQueries({ queryKey: ['guards'] });
    },
  });

  const deleteSiteMut = useMutation({
    mutationFn: () => api(`/sites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      navigate('/sites');
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><p className="text-gray-500">Loading...</p></div>;

  const site = siteRes?.data;
  const guards = guardsRes?.data || [];

  if (!site) return <div className="text-center py-12"><p>Site not found</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/sites')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Manage Site: {site.name}</h1>
          <p className="text-sm text-gray-500">{site.address || 'No address'}</p>
        </div>
      </div>

      {/* Site Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Site Information</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Contact Person:</span>
            <p className="font-medium">{site.contact_person || 'Not set'}</p>
          </div>
          <div>
            <span className="text-gray-500">Contact Phone:</span>
            <p className="font-medium">{site.contact_phone || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Shifts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Shifts</h2>
        {site.shifts?.length > 0 ? (
          <div className="space-y-2">
            {site.shifts.map((shift: any) => (
              <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{shift.label}</p>
                  <p className="text-sm text-gray-500">{shift.start_time} — {shift.end_time}</p>
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded">{shift.guardCount || 0} guards</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No shifts defined</p>
        )}
      </div>

      {/* Assigned Guards */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Assigned Guards ({guards.length})</h2>
          <button
            onClick={() => setShowAddGuard(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" /> Add Guard
          </button>
        </div>

        {guards.length > 0 ? (
          <div className="space-y-2">
            {guards.map((guard: any) => (
              <div key={guard.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium">{guard.name}</p>
                  <p className="text-sm text-gray-500">{guard.phone} • {guard.shift_label || 'No shift'}</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${guard.name} from this site?`)) {
                      removeGuardMut.mutate(guard.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No guards assigned to this site</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Danger Zone</h3>
            <p className="text-sm text-red-700 mb-4">
              Deleting this site will remove all associated shifts and unassign all guards. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteSite(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
            >
              Delete Site
            </button>
          </div>
        </div>
      </div>

      {/* Add Guard Modal */}
      {showAddGuard && (
        <AddGuardToSiteDialog
          siteId={Number(id)}
          site={site}
          existingGuards={guards}
          allGuards={allGuardsRes?.data || []}
          onClose={() => setShowAddGuard(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['site-guards', id] });
            qc.invalidateQueries({ queryKey: ['guards'] });
            setShowAddGuard(false);
          }}
        />
      )}

      {/* Delete Site Confirmation */}
      {showDeleteSite && (
        <DeleteSiteDialog
          siteName={site.name}
          onClose={() => setShowDeleteSite(false)}
          onConfirm={() => deleteSiteMut.mutate()}
        />
      )}
    </div>
  );
}

function AddGuardToSiteDialog({
  siteId,
  site,
  existingGuards,
  allGuards,
  onClose,
  onSuccess,
}: {
  siteId: number;
  site: any;
  existingGuards: any[];
  allGuards: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedGuardId, setSelectedGuardId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [loading, setLoading] = useState(false);

  const existingGuardIds = new Set(existingGuards.map(g => g.id));
  const availableGuards = allGuards.filter(g => !existingGuardIds.has(g.id) && g.approval_status === 'active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuardId || !selectedShiftId) return;

    setLoading(true);
    try {
      await api(`/guards/${selectedGuardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ site_id: siteId, shift_id: Number(selectedShiftId) }),
      });
      onSuccess();
    } catch (err) {
      alert('Failed to add guard to site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Add Guard to Site</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Guard *</label>
            <select
              value={selectedGuardId}
              onChange={(e) => setSelectedGuardId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Choose a guard...</option>
              {availableGuards.map((guard: any) => (
                <option key={guard.id} value={guard.id}>
                  {guard.name} ({guard.phone})
                </option>
              ))}
            </select>
            {availableGuards.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No available guards to assign</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Shift *</label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Choose a shift...</option>
              {site.shifts?.map((shift: any) => (
                <option key={shift.id} value={shift.id}>
                  {shift.label} ({shift.start_time} — {shift.end_time})
                </option>
              ))}
            </select>
            {!site.shifts?.length && (
              <p className="text-xs text-red-500 mt-1">No shifts available for this site</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !availableGuards.length || !site.shifts?.length}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Guard'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteSiteDialog({
  siteName,
  onClose,
  onConfirm,
}: {
  siteName: string;
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
          <h2 className="text-lg font-semibold text-gray-900">Delete Site</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This will permanently delete <strong>{siteName}</strong> and all associated data. This action cannot be undone.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Type <strong className="text-red-600">{siteName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter site name"
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
              if (confirmText === siteName) {
                onConfirm();
              }
            }}
            disabled={confirmText !== siteName}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Site
          </button>
        </div>
      </div>
    </div>
  );
}
