import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, formatTime } from '@/lib/utils';
import { Map as MapIcon, Navigation } from 'lucide-react';

// Colored pin built from inline SVG — avoids Leaflet's broken default marker URLs under bundlers.
function dotIcon(color: string, pulse = false) {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:18px;height:18px;border-radius:50%;
      background:${color};border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)${pulse ? ',0 0 0 6px ' + color + '55' : ''};
    "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}
const ICONS = {
  online: dotIcon('#16a34a'),
  idle: dotIcon('#d97706'),
  sos: dotIcon('#dc2626', true),
  checkpoint: L.divIcon({
    className: '',
    html: `<span style="display:block;width:12px;height:12px;background:#2563eb;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -8],
  }),
};

type Pt = { lat: number; lng: number };

function FitBounds({ points }: { points: Pt[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])).pad(0.2));
    }
    done.current = true;
  }, [points, map]);
  return null;
}

export default function LiveMapPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['command-map'],
    queryFn: () => api('/command/map'),
    refetchInterval: 15000, // refresh positions every 15s
  });

  const d = data?.data;
  const guards = d?.guards || [];
  const checkpoints = d?.checkpoints || [];
  const sos = d?.sos || [];

  const allPoints: Pt[] = useMemo(() => [
    ...guards.map((g: any) => ({ lat: g.lat, lng: g.lng })),
    ...checkpoints.map((c: any) => ({ lat: c.lat, lng: c.lng })),
  ], [guards, checkpoints]);

  const center: [number, number] = allPoints.length
    ? [allPoints[0].lat, allPoints[0].lng]
    : [12.9716, 77.5946]; // Bengaluru fallback

  const online = guards.filter((g: any) => g.status === 'online').length;
  const idle = guards.filter((g: any) => g.status === 'idle').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><MapIcon className="w-6 h-6 text-green-600" /> Live Map</h1>
          <p className="text-sm text-gray-500">
            {isLoading ? 'Loading…' : `${guards.length} guard${guards.length === 1 ? '' : 's'} located · updated ${dataUpdatedAt ? formatTime(new Date(dataUpdatedAt).toISOString()) : ''}`}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Legend color="#16a34a" label={`Online (${online})`} />
          <Legend color="#d97706" label={`Idle (${idle})`} />
          <Legend color="#dc2626" label={`SOS (${sos.length})`} />
          <Legend color="#2563eb" label="Checkpoint" square />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ height: '72vh' }}>
        {typeof window !== 'undefined' && (
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={allPoints} />

            {checkpoints.map((c: any) => (
              <Marker key={`cp-${c.id}`} position={[c.lat, c.lng]} icon={ICONS.checkpoint}>
                <Popup>
                  <strong>{c.label}</strong>{c.code ? ` (${c.code})` : ''}<br />
                  <span className="text-gray-500">{c.site_name}</span><br />
                  Checkpoint · {c.radius_meters}m radius
                </Popup>
              </Marker>
            ))}

            {guards.map((g: any) => (
              <Marker key={`g-${g.id}`} position={[g.lat, g.lng]} icon={g.status === 'idle' ? ICONS.idle : ICONS.online}>
                <Popup>
                  <strong>{g.name}</strong><br />
                  <span className="text-gray-500">{g.site_name || 'Unassigned'}</span><br />
                  Status: {g.status}<br />
                  Battery: {g.battery == null ? '—' : `${g.battery}%`}<br />
                  Last ping: {g.lastPing ? formatTime(g.lastPing) : '—'}
                </Popup>
              </Marker>
            ))}

            {sos.map((s: any) => (
              <Fragment key={`sos-${s.id}`}>
                <Circle center={[s.lat, s.lng]} radius={80} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.15 }} />
                <Marker position={[s.lat, s.lng]} icon={ICONS.sos}>
                  <Popup>
                    <strong style={{ color: '#dc2626' }}>🆘 SOS</strong><br />
                    {s.guard_name}<br />
                    <span className="text-gray-500">{s.site_name}</span><br />
                    {formatTime(s.created_at)}
                  </Popup>
                </Marker>
              </Fragment>
            ))}
          </MapContainer>
        )}
      </div>

      {!isLoading && guards.length === 0 && (
        <div className="text-center text-gray-500 text-sm flex items-center justify-center gap-2">
          <Navigation className="w-4 h-4" /> No guards are currently on duty with a recent GPS location.
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-600">
      <span style={{ background: color, width: 12, height: 12, display: 'inline-block', borderRadius: square ? 2 : '50%', transform: square ? 'rotate(45deg)' : undefined }} />
      {label}
    </span>
  );
}
