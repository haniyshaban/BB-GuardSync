// Sites Routes - CRUD + shifts
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const { polygonPoints, polygonsBySite } = require('../lib/geo');

const router = express.Router();

// Parse and validate fence fields from a request body.
// Returns { error } or { fields } where fields only includes what was sent.
function readFence(body) {
  const f = {};
  if (body.geofenceType !== undefined) {
    if (!['radius', 'polygon'].includes(body.geofenceType)) return { error: 'geofenceType must be radius or polygon' };
    f.type = body.geofenceType;
  }
  if (body.geofenceRadiusM !== undefined && body.geofenceRadiusM !== null) {
    const r = Number(body.geofenceRadiusM);
    if (!Number.isFinite(r) || r < 25 || r > 5000) return { error: 'Geofence radius must be between 25 and 5000 m' };
    f.radius = Math.round(r);
  }
  for (const k of ['lat', 'lng']) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
      const v = Number(body[k]);
      const max = k === 'lat' ? 90 : 180;
      if (!Number.isFinite(v) || Math.abs(v) > max) return { error: `Invalid ${k}` };
      f[k] = v;
    }
  }
  if (body.geofencePolygon !== undefined) {
    const poly = body.geofencePolygon;
    if (!Array.isArray(poly)) return { error: 'geofencePolygon must be a list of points' };
    const pts = poly.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    if (pts.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) {
      return { error: 'Polygon points need valid lat/lng' };
    }
    if (pts.length > 0 && pts.length < 3) return { error: 'A polygon needs at least 3 points' };
    if (pts.length > 100) return { error: 'A polygon can have at most 100 points' };
    f.polygon = pts;
  }
  if (body.geofenceEnabled !== undefined && body.geofenceEnabled !== null) f.enabled = body.geofenceEnabled ? 1 : 0;
  return { fields: f };
}

const savePolygon = db.transaction((siteId, points) => {
  db.prepare('DELETE FROM site_geofence_points WHERE site_id = ?').run(siteId);
  const ins = db.prepare('INSERT INTO site_geofence_points (site_id, lat, lng, point_order) VALUES (?, ?, ?, ?)');
  points.forEach((p, i) => ins.run(siteId, p.lat, p.lng, i));
});

// GET /api/sites - List all sites
router.get('/', authMiddleware, (req, res) => {
  try {
    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
    const polys = polygonsBySite();

    // Attach shifts, guard counts and fence polygon for each site
    const sitesWithDetails = sites.map(site => {
      const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id);
      const counts = db.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(clocked_in), 0) AS on_duty FROM guards WHERE site_id = ? AND approval_status = 'active'"
      ).get(site.id);
      return {
        ...site,
        shifts: shifts.map(s => ({ ...s, daysOfWeek: JSON.parse(s.days_of_week) })),
        guardCount: counts.total,
        onDutyCount: counts.on_duty,
        geofence_polygon: polys[site.id] || [],
      };
    });

    res.json({ success: true, data: sitesWithDetails });
  } catch (err) {
    console.error('List sites error:', err);
    res.status(500).json({ success: false, error: 'Failed to list sites' });
  }
});

// GET /api/sites/:id - Get single site with shifts
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });

    const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id);
    const guards = db.prepare(
      "SELECT id, name, phone, employee_id, approval_status, clocked_in FROM guards WHERE site_id = ? AND approval_status = 'active'"
    ).all(site.id);

    res.json({
      success: true,
      data: {
        ...site,
        shifts: shifts.map(s => ({ ...s, daysOfWeek: JSON.parse(s.days_of_week) })),
        guards,
        geofence_polygon: polygonPoints(site.id),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get site' });
  }
});

// POST /api/sites - Create site
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, address, contactPerson, contactPhone, shifts } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Site name is required' });
    }
    const fence = readFence(req.body);
    if (fence.error) return res.status(400).json({ success: false, error: fence.error });
    const f = fence.fields;

    const result = db.prepare(
      'INSERT INTO sites (name, address, contact_person, contact_phone, lat, lng, geofence_radius_m, geofence_enabled, geofence_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, address || null, contactPerson || null, contactPhone || null,
      f.lat ?? null, f.lng ?? null, f.radius ?? 150, f.enabled ?? 0, f.type ?? 'radius');

    const siteId = result.lastInsertRowid;
    if (f.polygon) savePolygon(siteId, f.polygon);

    // Add shifts if provided
    if (shifts && Array.isArray(shifts)) {
      const insertShift = db.prepare(
        'INSERT INTO site_shifts (site_id, label, start_time, end_time, days_of_week) VALUES (?, ?, ?, ?, ?)'
      );
      for (const shift of shifts) {
        insertShift.run(siteId, shift.label, shift.startTime, shift.endTime, JSON.stringify(shift.daysOfWeek || ['mon','tue','wed','thu','fri','sat','sun']));
      }
    }

    res.status(201).json({ success: true, data: { id: siteId }, message: 'Site created' });
  } catch (err) {
    console.error('Create site error:', err);
    res.status(500).json({ success: false, error: 'Failed to create site' });
  }
});

// PUT /api/sites/:id - Update site (details and/or geofence)
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, address, contactPerson, contactPhone } = req.body;
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });

    const fence = readFence(req.body);
    if (fence.error) return res.status(400).json({ success: false, error: fence.error });
    const f = fence.fields;
    if (f.type === 'polygon' && f.enabled === 1) {
      const n = f.polygon ? f.polygon.length : polygonPoints(site.id).length;
      if (n < 3) return res.status(400).json({ success: false, error: 'Draw at least 3 points before enabling a polygon geofence' });
    }

    db.prepare(`
      UPDATE sites SET name = COALESCE(?, name), address = COALESCE(?, address),
      contact_person = COALESCE(?, contact_person), contact_phone = COALESCE(?, contact_phone),
      lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      geofence_radius_m = COALESCE(?, geofence_radius_m),
      geofence_enabled = COALESCE(?, geofence_enabled),
      geofence_type = COALESCE(?, geofence_type)
      WHERE id = ?
    `).run(name, address, contactPerson, contactPhone,
      f.lat ?? null, f.lng ?? null, f.radius ?? null, f.enabled ?? null, f.type ?? null, site.id);
    if (f.polygon) savePolygon(site.id, f.polygon);

    res.json({ success: true, message: 'Site updated' });
  } catch (err) {
    console.error('Update site error:', err);
    res.status(500).json({ success: false, error: 'Failed to update site' });
  }
});

// DELETE /api/sites/:id
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    // Unassign guards from this site
    db.prepare('UPDATE guards SET site_id = NULL, shift_id = NULL WHERE site_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Site deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete site' });
  }
});

// ============ SHIFT MANAGEMENT ============

// POST /api/sites/:id/shifts - Add shift to site
router.post('/:id/shifts', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { label, startTime, endTime, daysOfWeek } = req.body;
    if (!label || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Shift label, start time, and end time are required' });
    }

    const result = db.prepare(
      'INSERT INTO site_shifts (site_id, label, start_time, end_time, days_of_week) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, label, startTime, endTime, JSON.stringify(daysOfWeek || ['mon','tue','wed','thu','fri','sat','sun']));

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add shift' });
  }
});

// PUT /api/sites/:siteId/shifts/:shiftId - Update shift
router.put('/:siteId/shifts/:shiftId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { label, startTime, endTime, daysOfWeek } = req.body;
    db.prepare(`
      UPDATE site_shifts SET label = COALESCE(?, label), start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time), days_of_week = COALESCE(?, days_of_week)
      WHERE id = ? AND site_id = ?
    `).run(label, startTime, endTime, daysOfWeek ? JSON.stringify(daysOfWeek) : null, req.params.shiftId, req.params.siteId);

    res.json({ success: true, message: 'Shift updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update shift' });
  }
});

// DELETE /api/sites/:siteId/shifts/:shiftId
router.delete('/:siteId/shifts/:shiftId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('UPDATE guards SET shift_id = NULL WHERE shift_id = ?').run(req.params.shiftId);
    db.prepare('DELETE FROM site_shifts WHERE id = ? AND site_id = ?').run(req.params.shiftId, req.params.siteId);
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete shift' });
  }
});

module.exports = router;
