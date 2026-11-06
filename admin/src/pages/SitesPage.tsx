import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/utils';
import { Plus, Building2, Clock, Settings, Trash2, Search, Users, MapPin, Radio } from 'lucide-react';

export default function SitesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: sitesRes, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api('/sites'),
  });

  const sites: any[] = sitesRes?.data || [];
  const q = search.trim().toLowerCase();
  const shown = q ? sites.filter(s => s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q)) : sites;
  const unfenced = sites.filter(s => !s.geofence_enabled).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-500">
            {sites.length} site{sites.length === 1 ? '' : 's'}
            {unfenced > 0 && <span className="text-amber-600"> · {unfenced} without a geofence</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56" />
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            <Plus className="w-4 h-4" /> Add site
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-500 col-span-full text-center py-8">Loading...</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-500 col-span-full text-center py-8">{sites.length ? 'No sites match your search' : 'No sites yet'}</p>
        ) : (
          shown.map((site: any) => (
            <div key={site.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{site.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{site.address || 'No address'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> On duty</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{site.onDutyCount ?? 0}<span className="text-sm font-normal text-gray-400"> / {site.guardCount}</span></p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Geofence</p>
                  <p className={'text-base font-semibold mt-1 ' + (site.geofence_enabled ? 'text-gray-900' : 'text-amber-600')}>{fenceLabel(site)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {(site.shifts || []).map((shift: any) => (
                  <span key={shift.id} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                    <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />{shift.label} {shift.start_time}–{shift.end_time}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                <button onClick={() => navigate(`/?site=${site.id}`)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                  <Radio className="w-4 h-4" /> View live
                </button>
                <button onClick={() => navigate(`/sites/${site.id}/manage`)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Settings className="w-4 h-4" /> Manage
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Site Modal */}
      {showAdd && <AddSiteDialog onClose={() => setShowAdd(false)} onSuccess={(newId) => { qc.invalidateQueries({ queryKey: ['sites'] }); setShowAdd(false); if (newId) navigate(`/sites/${newId}/manage`); }} />}
    </div>
  );
}

function fenceLabel(site: any) {
  if (!site.geofence_enabled) return 'Not set';
  if (site.geofence_type === 'polygon') return `Polygon · ${site.geofence_polygon?.length || 0} pts`;
  return `${site.geofence_radius_m || 150} m radius`;
}

function AddSiteDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (newId?: number) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [shifts, setShifts] = useState([{ label: 'Day Shift', startTime: '06:00', endTime: '14:00' }]);
  const [loading, setLoading] = useState(false);

  const addShift = () => setShifts([...shifts, { label: '', startTime: '', endTime: '' }]);
  const removeShift = (i: number) => setShifts(shifts.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api('/sites', {
        method: 'POST',
        body: JSON.stringify({ name, address, contactPerson, contactPhone, shifts: shifts.filter(s => s.label && s.startTime && s.endTime) }),
      });
      onSuccess(res?.data?.id); // opens Manage Site so the geofence can be drawn
    } catch (err) {
      alert('Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">Add New Site</h2>
        <p className="text-sm text-gray-500 mb-4">You'll set the geofence on the map next.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Site Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Shifts</label>
              <button type="button" onClick={addShift} className="text-xs text-blue-600 hover:text-blue-800">+ Add Shift</button>
            </div>
            {shifts.map((shift, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input placeholder="Label" value={shift.label}
                  onChange={(e) => { const s = [...shifts]; s[i].label = e.target.value; setShifts(s); }}
                  className="flex-1 px-2 py-1.5 border rounded text-sm" />
                <input type="time" value={shift.startTime}
                  onChange={(e) => { const s = [...shifts]; s[i].startTime = e.target.value; setShifts(s); }}
                  className="px-2 py-1.5 border rounded text-sm" />
                <span className="text-gray-400">to</span>
                <input type="time" value={shift.endTime}
                  onChange={(e) => { const s = [...shifts]; s[i].endTime = e.target.value; setShifts(s); }}
                  className="px-2 py-1.5 border rounded text-sm" />
                {shifts.length > 1 && (
                  <button type="button" onClick={() => removeShift(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Site'}
          </button>
        </div>
      </form>
    </div>
  );
}
