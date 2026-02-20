import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, statusBadge } from '@/lib/utils';
import { Search, UserCircle } from 'lucide-react';

export default function GuardsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const initialStatus = searchParams.get('status') as 'online' | 'idle' | 'offline' | null;
  const initialApproval = searchParams.get('approval');
  const [filter, setFilter] = useState<'all' | 'online' | 'idle' | 'offline'>(initialStatus ?? 'all');
  const [approvalFilter] = useState(initialApproval ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['guards', search, filter, approvalFilter],
    queryFn: () => api(
      `/guards?search=${encodeURIComponent(search)}&status=${filter === 'all' ? '' : filter}${approvalFilter ? `&approvalStatus=${approvalFilter}` : ''}`
    ),
    refetchInterval: 30_000,
  });

  const guards = data?.data ?? [];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Guards</h2>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all', 'online', 'idle', 'offline'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === f ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : guards.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No guards found</p>
      ) : (
        <div className="space-y-2">
          {guards.map((g: any) => (
            <div key={g.id} className="bg-white rounded-xl border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(g.status)}`}>{g.status}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{g.site_name || 'No site assigned'}</p>
                <p className="text-xs text-gray-400">{g.phone}</p>
              </div>
              <div className="text-right text-xs">
                {g.site_id ? (
                  <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">Assigned</span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">Unassigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
