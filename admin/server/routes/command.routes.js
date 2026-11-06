// 24x7 Command Centre Routes - live operational board
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const { createAlert } = require('../lib/alerts');
const { checkFence, polygonsBySite } = require('../lib/geo');

const router = express.Router();

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function haversine(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null)) return null;
  const R = 6371e3, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shiftActiveNow(shift, now = new Date()) {
  let days = [];
  try { days = JSON.parse(shift.days_of_week || '[]'); } catch { days = []; }
  if (!days.includes(DOW[now.getDay()])) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  if (s === e) return true;
  return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e);
}

function guardLiveStatus(guardId, config, site) {
  const locs = db.prepare('SELECT lat, lng, battery, timestamp FROM guard_locations WHERE guard_id = ? ORDER BY timestamp DESC LIMIT 2').all(guardId);
  if (!locs.length) return { status: 'online', battery: null, lastPing: null, lat: null, lng: null, offsite: false };
  const minsSince = (Date.now() - new Date(locs[0].timestamp + 'Z').getTime()) / 60000;
  let status = 'online';
  if (minsSince > (config.idle_threshold_mins || 35)) status = 'idle';
  else if (locs.length >= 2) {
    const d = haversine(locs[0].lat, locs[0].lng, locs[1].lat, locs[1].lng);
    if (d != null && d < (config.idle_distance_meters || 50)) status = 'idle';
  }

  // Geofence (radius or polygon): outside the fence -> out of location (takes visual precedence).
  const fence = site ? checkFence(site, locs[0].lat, locs[0].lng, site.polygon || []) : { active: false };
  const offsite = !!(fence.active && !fence.inside);
  if (offsite) status = 'out-of-location';
  const distanceFromSite = fence.active ? fence.distance : null;
  return { status, battery: locs[0].battery, lastPing: locs[0].timestamp, lat: locs[0].lat, lng: locs[0].lng, offsite, distanceFromSite };
}

// GET /api/command/live - full live board (sites, shortages, alerts, incidents)
router.get('/live', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get() || {};
    const now = new Date();

    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
    const polys = polygonsBySite();
    const siteBoard = sites.map(site => {
      const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id);
      const activeShifts = shifts.filter(s => shiftActiveNow(s, now));
      const activeShiftIds = activeShifts.map(s => s.id);

      // Required = active guards assigned to a shift that is active right now
      let required = 0;
      if (activeShiftIds.length) {
        const placeholders = activeShiftIds.map(() => '?').join(',');
        required = db.prepare(
          `SELECT COUNT(*) AS c FROM guards WHERE approval_status = 'active' AND shift_id IN (${placeholders})`
        ).get(...activeShiftIds).c;
      }

      const onDuty = db.prepare(
        "SELECT COUNT(*) AS c FROM guards WHERE approval_status = 'active' AND site_id = ? AND clocked_in = 1"
      ).get(site.id).c;

      const shortage = Math.max(0, required - onDuty);

      return {
        site_id: site.id, site_name: site.name, address: site.address,
        lat: site.lat, lng: site.lng,
        geofence_enabled: !!site.geofence_enabled, geofence_radius_m: site.geofence_radius_m,
        geofence_type: site.geofence_type || 'radius', geofence_polygon: polys[site.id] || [],
        activeShifts: activeShifts.map(s => s.label),
        required, onDuty, shortage,
      };
    });

    // Live guard roster (clocked-in)
    const clockedIn = db.prepare(`
      SELECT g.id, g.name, g.site_id, s.name AS site_name,
             s.lat AS site_lat, s.lng AS site_lng, s.geofence_radius_m, s.geofence_enabled, s.geofence_type
      FROM guards g LEFT JOIN sites s ON s.id = g.site_id
      WHERE g.clocked_in = 1 AND g.approval_status = 'active'
    `).all();
    const roster = clockedIn.map(g => ({
      id: g.id, name: g.name, site_id: g.site_id, site_name: g.site_name,
      ...guardLiveStatus(g.id, config, { id: g.site_id, lat: g.site_lat, lng: g.site_lng, geofence_radius_m: g.geofence_radius_m, geofence_enabled: g.geofence_enabled, geofence_type: g.geofence_type, polygon: polys[g.site_id] }),
    }));

    // Alerts + incidents
    const activeAlerts = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = 'active'").get().c;
    const criticalAlerts = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = 'active' AND severity = 'critical'").get().c;
    const openIncidents = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'open'").get().c;
    const openSos = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'open' AND type = 'sos'").get().c;
    const recentAlerts = db.prepare(`
      SELECT a.*, g.name AS guard_name, s.name AS site_name FROM alerts a
      LEFT JOIN guards g ON g.id = a.guard_id LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.status = 'active' ORDER BY a.created_at DESC LIMIT 20
    `).all();

    const totalShortage = siteBoard.reduce((s, x) => s + x.shortage, 0);
    const lowBattery = roster.filter(r => r.battery != null && r.battery <= (config.low_battery_threshold || 15)).length;
    const totalGuards = db.prepare("SELECT COUNT(*) AS c FROM guards WHERE approval_status = 'active'").get().c;
    const pendingEnrollments = db.prepare("SELECT COUNT(*) AS c FROM guards WHERE approval_status = 'pending'").get().c;

    // Open SOS incidents with coordinates, for map pins on the live dashboard.
    const sosPins = db.prepare(`
      SELECT i.id, i.lat, i.lng, i.created_at, i.site_id, g.name AS guard_name, s.name AS site_name
      FROM incidents i LEFT JOIN guards g ON g.id = i.guard_id LEFT JOIN sites s ON s.id = i.site_id
      WHERE i.type = 'sos' AND i.status != 'resolved' AND i.lat IS NOT NULL
      ORDER BY i.created_at DESC LIMIT 50
    `).all();

    res.json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
        lowBatteryThreshold: config.low_battery_threshold || 15,
        sos: sosPins,
        summary: {
          sites: sites.length,
          totalGuards, pendingEnrollments,
          onDuty: roster.length,
          online: roster.filter(r => r.status === 'online').length,
          idle: roster.filter(r => r.status === 'idle').length,
          offsite: roster.filter(r => r.offsite).length,
          totalShortage,
          activeAlerts, criticalAlerts, openIncidents, openSos, lowBattery,
        },
        sites: siteBoard,
        roster,
        recentAlerts: recentAlerts.map(a => ({ ...a, meta: a.meta ? JSON.parse(a.meta) : null })),
      }
    });
  } catch (err) {
    console.error('Command live error:', err);
    res.status(500).json({ success: false, error: 'Failed to build live board' });
  }
});

// GET /api/command/map - positioned guards + checkpoints for the live map
router.get('/map', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get() || {};
    const polys = polygonsBySite();
    const clockedIn = db.prepare(`
      SELECT g.id, g.name, g.site_id, s.name AS site_name,
             s.lat AS site_lat, s.lng AS site_lng, s.geofence_radius_m, s.geofence_enabled, s.geofence_type
      FROM guards g LEFT JOIN sites s ON s.id = g.site_id
      WHERE g.clocked_in = 1 AND g.approval_status = 'active'
    `).all();

    const guards = clockedIn
      .map(g => ({
        id: g.id, name: g.name, site_id: g.site_id, site_name: g.site_name,
        ...guardLiveStatus(g.id, config, { id: g.site_id, lat: g.site_lat, lng: g.site_lng, geofence_radius_m: g.geofence_radius_m, geofence_enabled: g.geofence_enabled, geofence_type: g.geofence_type, polygon: polys[g.site_id] }),
      }))
      .filter(g => g.lat != null && g.lng != null);

    const checkpoints = db.prepare(`
      SELECT c.id, c.label, c.code, c.lat, c.lng, c.radius_meters, c.site_id, s.name AS site_name
      FROM checkpoints c LEFT JOIN sites s ON s.id = c.site_id
      WHERE c.is_active = 1 AND c.lat IS NOT NULL AND c.lng IS NOT NULL
    `).all();

    // Geofenced sites, drawn as circles or polygons on the map.
    const geofences = db.prepare('SELECT id, name, lat, lng, geofence_radius_m, geofence_type FROM sites WHERE geofence_enabled = 1').all()
      .map(sf => ({ ...sf, geofence_type: sf.geofence_type || 'radius', polygon: polys[sf.id] || [] }))
      .filter(sf => sf.geofence_type === 'polygon' ? sf.polygon.length >= 3 : sf.lat != null && sf.lng != null);

    // Open SOS incidents with coordinates (shown as urgent pins)
    const sos = db.prepare(`
      SELECT i.id, i.lat, i.lng, i.created_at, g.name AS guard_name, s.name AS site_name
      FROM incidents i LEFT JOIN guards g ON g.id = i.guard_id LEFT JOIN sites s ON s.id = i.site_id
      WHERE i.type = 'sos' AND i.status != 'resolved' AND i.lat IS NOT NULL
      ORDER BY i.created_at DESC LIMIT 50
    `).all();

    res.json({ success: true, data: { generatedAt: new Date().toISOString(), guards, checkpoints, geofences, sos } });
  } catch (err) {
    console.error('Command map error:', err);
    res.status(500).json({ success: false, error: 'Failed to build map data' });
  }
});

// POST /api/command/scan-shortages - evaluate shortages and raise alerts (idempotent)
router.post('/scan-shortages', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const now = new Date();
    const sites = db.prepare('SELECT * FROM sites').all();
    let raised = 0;
    for (const site of sites) {
      const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id).filter(s => shiftActiveNow(s, now));
      const ids = shifts.map(s => s.id);
      if (!ids.length) continue;
      const placeholders = ids.map(() => '?').join(',');
      const required = db.prepare(`SELECT COUNT(*) AS c FROM guards WHERE approval_status='active' AND shift_id IN (${placeholders})`).get(...ids).c;
      const onDuty = db.prepare("SELECT COUNT(*) AS c FROM guards WHERE approval_status='active' AND site_id=? AND clocked_in=1").get(site.id).c;
      const shortage = required - onDuty;
      if (shortage > 0) {
        if (createAlert({
          orgId: site.org_id, siteId: site.id, type: 'shortage',
          severity: shortage >= 2 ? 'high' : 'medium',
          message: `Guard shortage at ${site.name}: ${onDuty}/${required} on duty (${shortage} short)`,
          meta: { required, onDuty, shortage },
        })) raised++;
      }
    }
    res.json({ success: true, data: { raised }, message: `${raised} shortage alert(s) raised` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to scan shortages' });
  }
});

module.exports = router;
