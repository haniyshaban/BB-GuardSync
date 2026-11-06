import { Fragment, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatTime } from '@/lib/utils';

// Status colours shared by the map, legend and badges.
export const STATUS_COLORS = {
  active: '#16a34a',
  inactive: '#d97706',
  out: '#9333ea',
  sos: '#dc2626',
  fence: '#2563eb',
};

// Coloured dot built from inline HTML: avoids Leaflet's default marker image URLs, which break under bundlers.
function dotIcon(color: string, pulse = false) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)${pulse ? ',0 0 0 6px ' + color + '55' : ''};"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}
const ICONS = {
  active: dotIcon(STATUS_COLORS.active),
  inactive: dotIcon(STATUS_COLORS.inactive),
  out: dotIcon(STATUS_COLORS.out, true),
  sos: dotIcon(STATUS_COLORS.sos, true),
};

export type MapGuard = {
  id: number; name: string; site_name?: string; lat: number | null; lng: number | null;
  status: string; offsite?: boolean; distanceFromSite?: number | null; battery?: number | null; lastPing?: string | null;
};
export type MapFence = { id: number; name: string; lat: number | null; lng: number | null; radius: number; points?: [number, number][] };
export type MapSos = { id: number; lat: number; lng: number; guard_name?: string; site_name?: string; created_at: string };
// `marker` (e.g. 'g-12' or 'sos-3') names the pin whose popup opens once the map arrives.
export type Focus = { lat: number; lng: number; zoom?: number; marker?: string; key: number } | null;

// Fit the view to all points whenever the set of points changes (e.g. the site filter changes).
function FitToPoints({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 16);
    else map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 16 });
    // fitKey is the trigger; points are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function FlyTo({ focus, markers }: { focus: Focus; markers: React.MutableRefObject<Record<string, L.Marker | null>> }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.closePopup();
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 18, { duration: 0.6 });
    if (!focus.marker) return;
    const open = () => markers.current[focus.marker!]?.openPopup();
    map.once('moveend', open);
    return () => { map.off('moveend', open); };
  }, [focus, map, markers]);
  return null;
}

export function guardStatusLabel(g: MapGuard) {
  if (g.offsite) return 'Out of location';
  return g.status === 'idle' ? 'Inactive' : 'Active';
}

export default function LiveMap({ guards, fences, sos, focus, fitKey, height = 520 }: {
  guards: MapGuard[]; fences: MapFence[]; sos: MapSos[]; focus: Focus; fitKey: string; height?: number;
}) {
  const located = guards.filter(g => g.lat != null && g.lng != null);
  // Frame the guards being shown; fall back to the site fences when no guard has a location.
  const points: [number, number][] = located.length
    ? located.map(g => [g.lat as number, g.lng as number] as [number, number])
    : fences.flatMap(f => f.points && f.points.length >= 3 ? f.points : f.lat != null && f.lng != null ? [[f.lat, f.lng] as [number, number]] : []);
  const center: [number, number] = points[0] || [12.9716, 77.5946]; // Bengaluru fallback
  const markers = useRef<Record<string, L.Marker | null>>({});

  return (
    <div style={{ height }} className="w-full">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={points} fitKey={fitKey} />
        <FlyTo focus={focus} markers={markers} />

        {fences.map(f => {
          const style = { color: STATUS_COLORS.fence, weight: 1.5, dashArray: '6 6', fillColor: STATUS_COLORS.fence, fillOpacity: 0.07 };
          if (f.points && f.points.length >= 3) {
            return (
              <Polygon key={`f-${f.id}`} positions={f.points} pathOptions={style}>
                <Popup><strong>{f.name}</strong><br />Geofence: custom area</Popup>
              </Polygon>
            );
          }
          if (f.lat == null || f.lng == null) return null;
          return (
            <Circle key={`f-${f.id}`} center={[f.lat, f.lng]} radius={f.radius} pathOptions={style}>
              <Popup><strong>{f.name}</strong><br />Geofence: {f.radius} m radius</Popup>
            </Circle>
          );
        })}

        {located.map(g => (
          <Marker key={`g-${g.id}`} ref={m => { markers.current[`g-${g.id}`] = m; }} position={[g.lat as number, g.lng as number]}
            icon={g.offsite ? ICONS.out : g.status === 'idle' ? ICONS.inactive : ICONS.active}>
            <Popup>
              <strong>{g.name}</strong><br />
              <span style={{ color: '#6b7280' }}>{g.site_name || 'Unassigned'}</span><br />
              Status: <strong style={{ color: g.offsite ? STATUS_COLORS.out : undefined }}>{guardStatusLabel(g)}</strong><br />
              {g.offsite && g.distanceFromSite != null && <>{g.distanceFromSite} m from post<br /></>}
              Battery: {g.battery == null ? '—' : `${g.battery}%`}<br />
              Last GPS: {g.lastPing ? formatTime(g.lastPing) : '—'}
            </Popup>
          </Marker>
        ))}

        {sos.map(s => (
          <Fragment key={`sos-${s.id}`}>
            <Circle center={[s.lat, s.lng]} radius={80} pathOptions={{ color: STATUS_COLORS.sos, fillColor: STATUS_COLORS.sos, fillOpacity: 0.15 }} />
            <Marker ref={m => { markers.current[`sos-${s.id}`] = m; }} position={[s.lat, s.lng]} icon={ICONS.sos}>
              <Popup>
                <strong style={{ color: STATUS_COLORS.sos }}>SOS</strong><br />
                {s.guard_name}<br />
                <span style={{ color: '#6b7280' }}>{s.site_name}</span><br />
                {formatTime(s.created_at)}
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
