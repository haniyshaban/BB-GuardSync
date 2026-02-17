import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/utils';
import { Plus, Building2, Clock, Settings, Trash2 } from 'lucide-react';

export default function SitesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: sitesRes, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api('/sites'),
  });

  const sites = sitesRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-500">{sites.length} sites</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Add Site
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-500 col-span-full text-center py-8">Loading...</p>
        ) : sites.length === 0 ? (
          <p className="text-gray-500 col-span-full text-center py-8">No sites yet</p>
        ) : (
          sites.map((site: any) => (
            <div key={site.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{site.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{site.address || 'No address'}</p>
                </div>
                <button
                  onClick={() => navigate(`/sites/${site.id}/manage`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Manage
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{site.guardCount} guards</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{site.shifts?.length || 0} shifts</span>
              </div>

              {site.shifts?.length > 0 && (
                <div className="space-y-1">
                  {site.shifts.map((shift: any) => (
                    <div key={shift.id} className="text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="font-medium">{shift.label}</span>
                      <span className="text-gray-500 ml-2">{shift.start_time} — {shift.end_time}</span>
                    </div>
                  ))}
                </div>
              )}

              {site.contact_person && (
                <p className="text-xs text-gray-400 mt-3">Contact: {site.contact_person} ({site.contact_phone})</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Site Modal */}
      {showAdd && <AddSiteDialog onClose={() => setShowAdd(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['sites'] }); setShowAdd(false); }} />}
    </div>
  );
}

function AddSiteDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      await api('/sites', {
        method: 'POST',
        body: JSON.stringify({ name, address, contactPerson, contactPhone, shifts: shifts.filter(s => s.label && s.startTime && s.endTime) }),
      });
      onSuccess();
    } catch (err) {
      alert('Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Add New Site</h2>

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
