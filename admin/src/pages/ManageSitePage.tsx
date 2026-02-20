import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, AlertTriangle, Search, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function ManageSitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddGuard, setShowAddGuard] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showDeleteSite, setShowDeleteSite] = useState(false);

  const { data: siteRes, isLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => api(`/sites/${id}`),
  });

  const { data: guardsRes } = useQuery({
    queryKey: ['site-guards', id],
    queryFn: () => api(`/guards?siteId=${id}`),
  });

  const { data: staffRes } = useQuery({
    queryKey: ['site-staff', id],
    queryFn: () => api(`/staff?siteId=${id}`),
  });

  const { data: allGuardsRes } = useQuery({
    queryKey: ['guards-unassigned'],
    queryFn: () => api('/guards?approvalStatus=active&limit=200'),
    enabled: showAddGuard,
  });

  const { data: allStaffRes } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => api('/staff'),
    enabled: showAddStaff,
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

  const removeStaffMut = useMutation({
    mutationFn: (staffId: number) => api(`/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify({ site_id: null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-staff', id] });
      qc.invalidateQueries({ queryKey: ['staff'] });
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
  const staff = staffRes?.data || [];

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

      {/* Ground Staff */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Ground Staff ({staff.length})</h2>
          <button
            onClick={() => setShowAddStaff(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" /> Assign Staff
          </button>
        </div>

        {staff.length > 0 ? (
          <div className="space-y-2">
            {staff.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email} • {member.phone || 'No phone'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{member.role}</span>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.name} from this site?`)) {
                      removeStaffMut.mutate(member.id);
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
          <p className="text-sm text-gray-500 text-center py-4">No ground staff assigned to this site</p>
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

      {/* Add Staff Modal */}
      {showAddStaff && (
        <AddStaffToSiteDialog
          siteId={Number(id)}
          siteName={site.name}
          existingStaff={staff}
          allStaff={allStaffRes?.data || []}
          onClose={() => setShowAddStaff(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['site-staff', id] });
            qc.invalidateQueries({ queryKey: ['staff'] });
            setShowAddStaff(false);
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
  const [selectedGuard, setSelectedGuard] = useState<any>(null);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [guardSearch, setGuardSearch] = useState('');
  const [guardOpen, setGuardOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const existingGuardIds = new Set(existingGuards.map(g => g.id));
  const availableGuards = allGuards.filter(
    g => !existingGuardIds.has(g.id) && g.approval_status === 'active'
  );
  const filteredGuards = availableGuards.filter(g =>
    g.name.toLowerCase().includes(guardSearch.toLowerCase()) ||
    g.phone.includes(guardSearch) ||
    (g.employee_id || '').toLowerCase().includes(guardSearch.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGuardOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuard || !selectedShiftId) return;
    setLoading(true);
    try {
      await api(`/guards/${selectedGuard.id}`, {
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
          {/* Searchable guard picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Guard *</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => { setGuardOpen(v => !v); setGuardSearch(''); }}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <span className={selectedGuard ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedGuard ? `${selectedGuard.name} — ${selectedGuard.phone}` : 'Search and choose a guard…'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>

              {guardOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {/* Search input */}
                  <div className="p-2 border-b">
                    <div className="flex items-center gap-2 px-2 py-1.5 border rounded-md bg-gray-50">
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Name, phone or ID…"
                        value={guardSearch}
                        onChange={e => setGuardSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                  {/* Guard list */}
                  <ul className="max-h-52 overflow-y-auto">
                    {filteredGuards.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-gray-400">
                        {availableGuards.length === 0 ? 'No active guards available' : 'No matches found'}
                      </li>
                    ) : filteredGuards.map((g: any) => (
                      <li
                        key={g.id}
                        onClick={() => { setSelectedGuard(g); setGuardOpen(false); }}
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${
                          selectedGuard?.id === g.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{g.name}</p>
                          <p className="text-xs text-gray-500">{g.phone}{g.employee_id ? ` • ${g.employee_id}` : ''}{g.site_name ? ` • ${g.site_name}` : ' • Unassigned'}</p>
                        </div>
                        {selectedGuard?.id === g.id && <span className="text-xs text-green-600 font-semibold">✓</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Shift picker */}
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
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedGuard || !selectedShiftId}
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

function AddStaffToSiteDialog({
  siteId,
  siteName,
  existingStaff,
  allStaff,
  onClose,
  onSuccess,
}: {
  siteId: number;
  siteName: string;
  existingStaff: any[];
  allStaff: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffOpen, setStaffOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const existingStaffIds = new Set(existingStaff.map(s => s.id));
  const availableStaff = allStaff.filter(s => !existingStaffIds.has(s.id) && s.role === 'staff');
  const filteredStaff = availableStaff.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearch.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStaffOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setLoading(true);
    try {
      await api(`/staff/${selectedMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ site_id: siteId }),
      });
      onSuccess();
    } catch (err) {
      alert('Failed to assign staff to site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Assign Staff to {siteName}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Staff Member *</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => { setStaffOpen(v => !v); setStaffSearch(''); }}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <span className={selectedMember ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedMember ? `${selectedMember.name} — ${selectedMember.email}` : 'Search and choose a staff member…'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>

              {staffOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="flex items-center gap-2 px-2 py-1.5 border rounded-md bg-gray-50">
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Name or email…"
                        value={staffSearch}
                        onChange={e => setStaffSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                  <ul className="max-h-52 overflow-y-auto">
                    {filteredStaff.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-gray-400">
                        {availableStaff.length === 0 ? 'No staff available' : 'No matches found'}
                      </li>
                    ) : filteredStaff.map((s: any) => (
                      <li
                        key={s.id}
                        onClick={() => { setSelectedMember(s); setStaffOpen(false); }}
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${
                          selectedMember?.id === s.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.email}{s.site_name ? ` • Currently at ${s.site_name}` : ' • Unassigned'}</p>
                        </div>
                        {selectedMember?.id === s.id && <span className="text-xs text-green-600 font-semibold">✓</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {availableStaff.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No available staff members to assign</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Note: If a staff member is currently assigned to another site, they will be reassigned to this site.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedMember}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Assigning...' : 'Assign Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}
