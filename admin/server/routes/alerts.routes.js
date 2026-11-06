// Operational Alerts / Notifications Routes
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// GET /api/alerts?status=active&type=&siteId=&limit=
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, type, siteId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const where = [];
    const params = [];
    if (status) { where.push('a.status = ?'); params.push(status); }
    if (type) { where.push('a.type = ?'); params.push(type); }
    if (siteId) { where.push('a.site_id = ?'); params.push(Number(siteId)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT a.*, g.name AS guard_name, s.name AS site_name
      FROM alerts a
      LEFT JOIN guards g ON g.id = a.guard_id
      LEFT JOIN sites s ON s.id = a.site_id
      ${whereSql}
      ORDER BY a.created_at DESC LIMIT ?
    `).all(...params, limit);

    res.json({ success: true, data: rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null })) });
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ success: false, error: 'Failed to list alerts' });
  }
});

// GET /api/alerts/count - active alert counts by severity (for header badge)
router.get('/count', authMiddleware, (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = 'active'").get().c;
    const critical = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = 'active' AND severity = 'critical'").get().c;
    res.json({ success: true, data: { active: total, critical } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to count alerts' });
  }
});

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    db.prepare(`UPDATE alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = datetime('now') WHERE id = ?`)
      .run(req.user.id, req.params.id);
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    db.prepare(`UPDATE alerts SET status = 'resolved' WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'Alert resolved' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

module.exports = router;
