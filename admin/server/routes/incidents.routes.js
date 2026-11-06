// Incident Reporting + SOS Routes
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const { createAlert } = require('../lib/alerts');

const router = express.Router();

// Helper: resolve a guard's org/site for alert context
function guardContext(guardId) {
  return db.prepare('SELECT org_id, site_id, name FROM guards WHERE id = ?').get(guardId) || {};
}

// ---------- Guard-facing ----------

// POST /api/incidents - guard reports an incident
router.post('/', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const { category, severity, description, photoUrl, lat, lng } = req.body;
    const ctx = guardContext(req.user.id);
    const result = db.prepare(`
      INSERT INTO incidents (org_id, guard_id, site_id, type, category, severity, description, photo_url, lat, lng)
      VALUES (?, ?, ?, 'incident', ?, ?, ?, ?, ?, ?)
    `).run(ctx.org_id, req.user.id, ctx.site_id, category || null, severity || 'medium', description || null, photoUrl || null, lat || null, lng || null);

    createAlert({
      orgId: ctx.org_id, guardId: req.user.id, siteId: ctx.site_id,
      type: 'incident', severity: severity === 'critical' ? 'critical' : (severity || 'medium'),
      message: `Incident reported by ${ctx.name || 'guard'}${category ? ': ' + category : ''}`,
      meta: { incidentId: result.lastInsertRowid },
    });
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Incident reported' });
  } catch (err) {
    console.error('Report incident error:', err);
    res.status(500).json({ success: false, error: 'Failed to report incident' });
  }
});

// POST /api/incidents/sos - panic button
router.post('/sos', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const { lat, lng, description } = req.body;
    const ctx = guardContext(req.user.id);
    const result = db.prepare(`
      INSERT INTO incidents (org_id, guard_id, site_id, type, category, severity, description, lat, lng)
      VALUES (?, ?, ?, 'sos', 'SOS', 'critical', ?, ?, ?)
    `).run(ctx.org_id, req.user.id, ctx.site_id, description || 'SOS triggered', lat || null, lng || null);

    createAlert({
      orgId: ctx.org_id, guardId: req.user.id, siteId: ctx.site_id,
      type: 'sos', severity: 'critical',
      message: `🆘 SOS from ${ctx.name || 'guard'}`,
      meta: { incidentId: result.lastInsertRowid, lat, lng },
    });
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'SOS sent' });
  } catch (err) {
    console.error('SOS error:', err);
    res.status(500).json({ success: false, error: 'Failed to send SOS' });
  }
});

// GET /api/incidents/mine - guard's own reports
router.get('/mine', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const rows = db.prepare('SELECT * FROM incidents WHERE guard_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load incidents' });
  }
});

// ---------- Admin / staff-facing ----------

// GET /api/incidents?status=&type=&siteId=
router.get('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { status, type, siteId } = req.query;
    const where = [], params = [];
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (type) { where.push('i.type = ?'); params.push(type); }
    if (siteId) { where.push('i.site_id = ?'); params.push(Number(siteId)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT i.*, g.name AS guard_name, s.name AS site_name, st.name AS acknowledged_by_name
      FROM incidents i
      LEFT JOIN guards g ON g.id = i.guard_id
      LEFT JOIN sites s ON s.id = i.site_id
      LEFT JOIN staff st ON st.id = i.acknowledged_by
      ${whereSql}
      ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, i.created_at DESC
      LIMIT 500
    `).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List incidents error:', err);
    res.status(500).json({ success: false, error: 'Failed to list incidents' });
  }
});

// PUT /api/incidents/:id/acknowledge
router.put('/:id/acknowledge', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    db.prepare(`UPDATE incidents SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = datetime('now') WHERE id = ?`)
      .run(req.user.id, req.params.id);
    res.json({ success: true, message: 'Incident acknowledged' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to acknowledge' });
  }
});

// PUT /api/incidents/:id/resolve
router.put('/:id/resolve', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { resolutionNote } = req.body;
    db.prepare(`UPDATE incidents SET status = 'resolved', resolved_at = datetime('now'), resolution_note = COALESCE(?, resolution_note) WHERE id = ?`)
      .run(resolutionNote || null, req.params.id);
    res.json({ success: true, message: 'Incident resolved' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resolve' });
  }
});

module.exports = router;
