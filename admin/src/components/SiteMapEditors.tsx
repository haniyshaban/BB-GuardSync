import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, cn } from '@/lib/utils';
import { MapPin, Undo2, Trash2, Route, Plus, X } from 'lucide-react';

type LatLng = { lat: number; lng: number };
const FALLBACK: [number, number] = [12.9716, 77.5946]; // Bengaluru

const centreIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const vertexIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:2.5px solid #2563eb"></div>',
  iconSize: [12, 12], iconAnchor: [6, 6],
});
const guardIcon = (onDuty: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:${onDuty ? '#16a34a' : '#9ca3af'};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
  iconSize: [10, 10], iconAnchor: [5, 5],
});
const checkpointIcon = (n: number) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#16a34a;border:2px solid #fff;color:#fff;font:600 12px/20px system-ui;text-align:center;box-shadow:0 0 0 1px rgba(0,0,0,.25)">${n}</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

function ClickCapture({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: e => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Frame the given points once (and again when `fitKey` changes).
function Frame({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 17);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function Tiles() {
  return <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />;
}

/** The site's current fence drawn read-only, for context on other maps. */
export function FenceShape({ site }: { site: any }) {
  if (!site?.geofence_enabled) return null;
  const style = { color: '#2563eb', weight: 1.5, dashArray: '6 6', fillColor: '#2563eb', fillOpacity: 0.06 };
  if (site.geofence_type === 'polygon' && site.geofence_polygon?.length >= 3) {
    return <Polygon positions={site.geofence_polygon.map((p: LatLng) => [p.lat, p.lng])} pathOptions={style} />;
  }
  if (site.lat != null && site.lng != null) {
    return <Circle center={[site.lat, site.lng]} radius={site.geofence_radius_m || 150} pathOptions={style} />;
  }
  return null;
}

/**
 * Geofence editor: radius (click to place the centre, drag to move, slider for size)
 * or polygon (click to add corners). Mirrors the GuardSync site geofence editor.
 */
export function GeofenceEditor({ site, siteId, guards = [] }: { site: any; siteId: string; guards?: any[] }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'radius' | 'polygon'>(site.geofence_type === 'polygon' ? 'polygon' : 'radius');
  const [enabled, setEnabled] = useState<boolean>(!!site.geofence_enabled);
  const [centre, setCentre] = useState<LatLng | null>(site.lat != null && site.lng != null ? { lat: site.lat, lng: site.lng } : null);
  const [radius, setRadius] = useState<number>(site.geofence_radius_m || 150);
  const [points, setPoints] = useState<LatLng[]>(site.geofence_polygon || []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const startPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (site.lat != null && site.lng != null) pts.push([site.lat, site.lng]);
    (site.geofence_polygon || []).forEach((p: LatLng) => pts.push([p.lat, p.lng]));
    return pts;
  }, [site]);

  const save = useMutation({
    mutationFn: () => {
      const body: any = { geofenceType: mode, geofenceEnabled: enabled };
      if (mode === 'radius') {
        if (centre) { body.lat = centre.lat; body.lng = centre.lng; }
        body.geofenceRadiusM = radius;
      } else {
        body.geofencePolygon = points;
        // Keep the site pin on the drawn area so maps and distances stay consistent.
        if (points.length >= 3) {
          body.lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
          body.lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
        }
      }
      return api(`/sites/${siteId}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site', siteId] });
      qc.invalidateQueries({ queryKey: ['sites'] });
      setMsg({ ok: true, text: 'Geofence saved' });
      setTimeout(() => setMsg(null), 2500);
    },
    onError: (e: any) => setMsg({ ok: false, text: e.message }),
  });

  const onMapClick = (p: LatLng) => {
    setMsg(null);
    if (mode === 'radius') setCentre(p);
    else setPoints(prev => [...prev, p]);
  };

  const canSave = mode === 'radius' ? !!centre : points.length >= 3 || !enabled;
  const hint = mode === 'radius'
    ? (centre ? 'Click the map or drag the blue pin to move the site centre.' : 'Click the map to place the site centre.')
    : points.length < 3 ? `Click the map to add corners (${points.length}/3 minimum).` : `${points.length} corners. Keep clicking to add more.`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><MapPin className="w-5 h-5" /> Geofence</h2>
          <p className="text-sm text-gray-500">Guards outside this area for longer than the grace period are marked <strong>Out of Location</strong>.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <span className={cn('relative inline-flex h-6 w-11 rounded-full transition', enabled ? 'bg-green-600' : 'bg-gray-300')}>
            <input type="checkbox" className="sr-only" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', enabled ? 'left-[22px]' : 'left-0.5')} />
          </span>
          {enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      <div className="px-6 pb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          {(['radius', 'polygon'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setMsg(null); }}
              className={cn('px-3 py-1.5 text-sm rounded-md font-medium', mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {m === 'radius' ? 'Radius' : 'Custom polygon'}
            </button>
          ))}
        </div>

        {mode === 'radius' ? (
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <input type="range" min={25} max={1000} step={5} value={radius} onChange={e => setRadius(Number(e.target.value))} className="flex-1 accent-gray-900" />
            <span className="text-sm font-semibold bg-gray-100 px-3 py-1 rounded-full w-20 text-center">{radius} m</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setPoints(p => p.slice(0, -1))} disabled={!points.length}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"><Undo2 className="w-4 h-4" /> Undo</button>
            <button onClick={() => setPoints([])} disabled={!points.length}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Clear</button>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[500] bg-gray-900/85 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">{hint}</div>
        <div className="h-[420px] cursor-crosshair">
          <MapContainer center={startPoints[0] || FALLBACK} zoom={startPoints.length ? 17 : 12} style={{ height: '100%', width: '100%' }}>
            <Tiles />
            <Frame points={startPoints} fitKey="init" />
            <ClickCapture onClick={onMapClick} />

            {mode === 'radius' && centre && (
              <>
                <Circle center={[centre.lat, centre.lng]} radius={radius}
                  pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: enabled ? 0.12 : 0.04, dashArray: enabled ? undefined : '6 6' }} />
                <Marker position={[centre.lat, centre.lng]} icon={centreIcon} draggable
                  eventHandlers={{ dragend: e => { const ll = (e.target as L.Marker).getLatLng(); setCentre({ lat: ll.lat, lng: ll.lng }); } }} />
              </>
            )}

            {mode === 'polygon' && (
              <>
                {points.length >= 2 && (
                  <Polygon positions={points.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: points.length >= 3 ? 0.12 : 0 }} />
                )}
                {points.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={vertexIcon} />)}
              </>
            )}

            {guards.filter(g => g.lat != null && g.lng != null).map(g => (
              <Marker key={`g-${g.id}`} position={[g.lat, g.lng]} icon={guardIcon(!!g.clocked_in)}>
                <Popup>{g.name}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="px-6 py-4 border-t flex items-center gap-3">
        <button onClick={() => save.mutate()} disabled={!canSave || save.isPending}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save geofence'}
        </button>
        {msg && <span className={cn('text-sm', msg.ok ? 'text-green-600' : 'text-red-600')}>{msg.ok ? '✓ ' : ''}{msg.text}</span>}
        {centre && (
          <span className="ml-auto text-xs text-gray-400 font-mono">{centre.lat.toFixed(5)}, {centre.lng.toFixed(5)}</span>
        )}
      </div>
    </div>
  );
}

/** Patrol route: click the map to add numbered checkpoints for this site. */
export function PatrolCheckpointsEditor({ site, siteId }: { site: any; siteId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [cpRadius, setCpRadius] = useState(30);

  const { data } = useQuery({
    queryKey: ['checkpoints', siteId],
    queryFn: () => api(`/patrol/sites/${siteId}/checkpoints`),
  });
  const checkpoints: any[] = data?.data || [];

  const add = useMutation({
    mutationFn: (p: LatLng) => api(`/patrol/sites/${siteId}/checkpoints`, {
      method: 'POST',
      body: JSON.stringify({ label: `Checkpoint ${checkpoints.length + 1}`, lat: p.lat, lng: p.lng, radiusMeters: cpRadius, sortOrder: checkpoints.length + 1 }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', siteId] }),
    onError: (e: any) => alert(e.message),
  });
  const rename = useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) => api(`/patrol/checkpoints/${id}`, { method: 'PUT', body: JSON.stringify({ label }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', siteId] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/patrol/checkpoints/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', siteId] }),
  });

  const located = checkpoints.filter(c => c.lat != null && c.lng != null);
  const framePts: [number, number][] = [
    ...located.map(c => [c.lat, c.lng] as [number, number]),
    ...(site.lat != null ? [[site.lat, site.lng] as [number, number]] : []),
    ...((site.geofence_polygon || []).map((p: LatLng) => [p.lat, p.lng] as [number, number])),
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Route className="w-5 h-5" /> Patrol route</h2>
          <p className="text-sm text-gray-500">Guards scan these checkpoints in the guard app; scans are GPS-verified against each radius.</p>
        </div>
        <div className="flex items-center gap-2">
          {adding && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Radius
              <input type="number" min={5} max={200} value={cpRadius} onChange={e => setCpRadius(Number(e.target.value))} className="w-20 px-2 py-1.5 border rounded-lg text-sm" />
              m
            </label>
          )}
          <button onClick={() => setAdding(a => !a)}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg', adding ? 'bg-green-600 text-white' : 'border hover:bg-gray-50')}>
            {adding ? 'Done' : <><Plus className="w-4 h-4" /> Add checkpoints</>}
          </button>
        </div>
      </div>

      <div className="relative">
        {adding && <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[500] bg-green-700/90 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">Click the map to drop checkpoint {checkpoints.length + 1}</div>}
        <div className={cn('h-[340px]', adding && 'cursor-crosshair')}>
          <MapContainer center={framePts[0] || FALLBACK} zoom={framePts.length ? 17 : 12} style={{ height: '100%', width: '100%' }}>
            <Tiles />
            <Frame points={framePts} fitKey={`${located.length > 0}`} />
            <FenceShape site={site} />
            {adding && <ClickCapture onClick={p => !add.isPending && add.mutate(p)} />}
            {located.map((c, i) => (
              <Fragment key={c.id}>
                <Circle center={[c.lat, c.lng]} radius={c.radius_meters || 30} pathOptions={{ color: '#16a34a', weight: 1, fillColor: '#16a34a', fillOpacity: 0.15 }} />
                <Marker position={[c.lat, c.lng]} icon={checkpointIcon(i + 1)}><Popup>{c.label} · {c.radius_meters} m</Popup></Marker>
              </Fragment>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="px-6 py-4 border-t">
        {checkpoints.length === 0 ? (
          <p className="text-sm text-gray-500">No checkpoints yet. Click <strong>Add checkpoints</strong>, then click the map.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {checkpoints.map((c, i) => (
              <span key={c.id} className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-green-50 border border-green-200 text-sm">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                <input defaultValue={c.label} onBlur={e => e.target.value.trim() && e.target.value !== c.label && rename.mutate({ id: c.id, label: e.target.value.trim() })}
                  className="bg-transparent w-32 focus:outline-none focus:bg-white rounded px-1" />
                <span className="text-xs text-gray-500">{c.radius_meters} m</span>
                <button onClick={() => remove.mutate(c.id)} className="text-gray-400 hover:text-red-600" title="Remove"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
