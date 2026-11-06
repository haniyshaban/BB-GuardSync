// Patrolling & Site Visits Routes - checkpoints + scans with GPS proximity verification
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many scans in a short time. Please wait a moment.' },
});

function haversine(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null)) return null;
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Checkpoints (admin) ----------

// GET /api/patrol/sites/:siteId/checkpoints
router.get('/sites/:siteId/checkpoints', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM checkpoints WHERE site_id = ? ORDER BY sort_order, id').all(req.params.siteId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list checkpoints' });
  }
});

// POST /api/patrol/sites/:siteId/checkpoints
router.post('/sites/:siteId/checkpoints', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { label, code, lat, lng, radiusMeters, sortOrder } = req.body;
    if (!label) return res.status(400).json({ success: false, error: 'Checkpoint label is required' });
    const result = db.prepare(`
      INSERT INTO checkpoints (site_id, label, code, lat, lng, radius_meters, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.siteId, label, code || null, lat || null, lng || null, radiusMeters || 50, sortOrder || 0);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Checkpoint created' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create checkpoint' });
  }
});

// PUT /api/patrol/checkpoints/:id
router.put('/checkpoints/:id', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { label, code, lat, lng, radiusMeters, sortOrder, isActive } = req.body;
    db.prepare(`
      UPDATE checkpoints SET label = COALESCE(?, label), code = COALESCE(?, code),
        lat = COALESCE(?, lat), lng = COALESCE(?, lng), radius_meters = COALESCE(?, radius_meters),
        sort_order = COALESCE(?, sort_order), is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(label, code, lat, lng, radiusMeters, sortOrder, isActive == null ? null : (isActive ? 1 : 0), req.params.id);
    res.json({ success: true, message: 'Checkpoint updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update checkpoint' });
  }
});

// DELETE /api/patrol/checkpoints/:id
router.delete('/checkpoints/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM checkpoints WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Checkpoint deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete checkpoint' });
  }
});

// ---------- Guard-facing ----------

// GET /api/patrol/my-checkpoints - active checkpoints at the guard's assigned site
router.get('/my-checkpoints', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const guard = db.prepare('SELECT site_id FROM guards WHERE id = ?').get(req.user.id);
    if (!guard || !guard.site_id) return res.json({ success: true, data: [] });
    const rows = db.prepare(`
      SELECT c.*, (
        SELECT scanned_at FROM patrol_scans ps
        WHERE ps.checkpoint_id = c.id AND ps.guard_id = ? AND ps.scanned_at >= date('now')
        ORDER BY ps.scanned_at DESC LIMIT 1
      ) AS last_scan_today
      FROM checkpoints c
      WHERE c.site_id = ? AND c.is_active = 1 ORDER BY c.sort_order, c.id
    `).all(req.user.id, guard.site_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load checkpoints' });
  }
});

// POST /api/patrol/scan - guard logs a checkpoint scan
router.post('/scan', authMiddleware, scanLimiter, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const { checkpointId, code, lat, lng, photoUrl } = req.body;

    let checkpoint;
    if (checkpointId) checkpoint = db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(checkpointId);
    else if (code) checkpoint = db.prepare('SELECT * FROM checkpoints WHERE code = ?').get(code);
    if (!checkpoint) return res.status(404).json({ success: false, error: 'Checkpoint not found' });

    // Proximity verification when both checkpoint and scan have coordinates
    let distance = null, verified = 1;
    if (checkpoint.lat != null && lat != null) {
      distance = haversine(checkpoint.lat, checkpoint.lng, lat, lng);
      verified = distance != null && distance <= checkpoint.radius_meters ? 1 : 0;
    }

    const result = db.prepare(`
      INSERT INTO patrol_scans (checkpoint_id, guard_id, site_id, lat, lng, distance_meters, verified, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(checkpoint.id, req.user.id, checkpoint.site_id, lat || null, lng || null,
      distance == null ? null : Math.round(distance), verified, photoUrl || null);

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid, verified: !!verified, distance_meters: distance == null ? null : Math.round(distance) },
      message: verified ? 'Checkpoint verified' : 'Scan recorded but outside checkpoint range',
    });
  } catch (err) {
    console.error('Patrol scan error:', err);
    res.status(500).json({ success: false, error: 'Failed to record scan' });
  }
});

// ---------- Reporting (admin/staff) ----------

// GET /api/patrol/scans?guardId=&siteId=&from=&to=  (route / scan history)
router.get('/scans', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { guardId, siteId, from, to } = req.query;
    const where = [], params = [];
    if (guardId) { where.push('ps.guard_id = ?'); params.push(Number(guardId)); }
    if (siteId) { where.push('ps.site_id = ?'); params.push(Number(siteId)); }
    if (from) { where.push('ps.scanned_at >= ?'); params.push(from); }
    if (to) { where.push('ps.scanned_at <= ?'); params.push(to); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT ps.*, c.label AS checkpoint_label, c.code AS checkpoint_code, g.name AS guard_name, s.name AS site_name
      FROM patrol_scans ps
      JOIN checkpoints c ON c.id = ps.checkpoint_id
      JOIN guards g ON g.id = ps.guard_id
      LEFT JOIN sites s ON s.id = ps.site_id
      ${whereSql}
      ORDER BY ps.scanned_at DESC LIMIT 500
    `).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list scans' });
  }
});

// GET /api/patrol/coverage/:siteId?date=YYYY-MM-DD - checkpoint coverage for a day
router.get('/coverage/:siteId', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const checkpoints = db.prepare('SELECT * FROM checkpoints WHERE site_id = ? AND is_active = 1 ORDER BY sort_order, id').all(req.params.siteId);
    const data = checkpoints.map(c => {
      const scans = db.prepare(`
        SELECT COUNT(*) AS total, SUM(verified) AS verified
        FROM patrol_scans WHERE checkpoint_id = ? AND date(scanned_at) = ?
      `).get(c.id, date);
      return { ...c, scans_today: scans.total, verified_today: scans.verified || 0 };
    });
    const covered = data.filter(c => c.scans_today > 0).length;
    res.json({ success: true, data: { date, totalCheckpoints: checkpoints.length, covered, checkpoints: data } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get coverage' });
  }
});

module.exports = router;
