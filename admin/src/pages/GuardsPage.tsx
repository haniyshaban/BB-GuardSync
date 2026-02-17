import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, statusColor, formatDate } from '@/lib/utils';
import { Search, UserPlus, CheckCircle, XCircle } from 'lucide-react';

export default function GuardsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [authModal, setAuthModal] = useState<any>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Read initial filter from URL
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilter(statusParam);
    }
  }, [searchParams]);

  const { data: guardsRes, isLoading } = useQuery({
    queryKey: ['guards', search, filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      
      // Handle different filter types
      if (filter !== 'all') {
        // Online/idle/offline are connection statuses
        if (['online', 'idle', 'offline'].includes(filter)) {
          params.set('status', filter);
        } else {
          // pending/active/inactive/rejected are approval statuses
          params.set('approvalStatus', filter);
        }
      }
      
      return api(`/guards?${params}`);
    },
  });

  const { data: sitesRes } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api('/sites'),
  });

  const authorizeMut = useMutation({
    mutationFn: (data: { guardId: number; siteId: number; shiftId: number; dailyRate: number; employeeId: string }) =>
      api(`/guards/${data.guardId}/authorize`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guards'] }); setAuthModal(null); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api(`/guards/${id}/reject`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guards'] }),
  });

  const guards = guardsRes?.data || [];
  const sites = sitesRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guards</h1>
          <p className="text-sm text-gray-500">{guardsRes?.total || 0} total guards</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="all">All Statuses</option>
          <optgroup label="Connection Status">
            <option value="online">Online</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </optgroup>
          <optgroup label="Approval Status">
            <option value="pending">Pending Approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="rejected">Rejected</option>
          </optgroup>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Live</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : guards.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No guards found</td></tr>
              ) : (
                guards.map((g: any) => (
                  <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/guards/${g.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{g.name}</div>
                      <div className="text-xs text-gray-500">{g.employee_id || 'No ID'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{g.site_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(g.approval_status)}`}>
                        {g.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {g.approval_status === 'active' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(g.status)}`}>
                          {g.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {g.approval_status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setAuthModal(g)}
                            className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                            title="Authorize"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm('Reject this enrollment?')) rejectMut.mutate(g.id); }}
                            className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorization Modal */}
      {authModal && (
        <AuthorizeDialog
          guard={authModal}
          sites={sites}
          onClose={() => setAuthModal(null)}
          onSubmit={(data: any) => authorizeMut.mutate({ guardId: authModal.id, ...data })}
          loading={authorizeMut.isPending}
        />
      )}
    </div>
  );
}

function AuthorizeDialog({ guard, sites, onClose, onSubmit, loading }: any) {
  const [siteId, setSiteId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [dailyRate, setDailyRate] = useState('750');
  const [employeeId, setEmployeeId] = useState('');

  const selectedSite = sites.find((s: any) => s.id === Number(siteId));
  const shifts = selectedSite?.shifts || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">Authorize Guard</h2>
        <p className="text-sm text-gray-500 mb-4">Approve {guard.name}'s enrollment</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Assign Site *</label>
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setShiftId(''); }}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select site...</option>
              {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assign Shift *</label>
            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" disabled={!siteId}>
              <option value="">Select shift...</option>
              {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.label} ({s.start_time} - {s.end_time})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Daily Rate (₹) *</label>
            <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Employee ID</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" placeholder="BB-G001" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSubmit({ siteId: Number(siteId), shiftId: Number(shiftId), dailyRate: Number(dailyRate), employeeId })}
            disabled={!siteId || !shiftId || !dailyRate || loading}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Authorizing...' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  );
}
