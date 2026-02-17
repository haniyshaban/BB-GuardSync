// Location Routes - GPS pings during shift
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

// POST /api/locations - Submit guard location (from guard app, every 30 mins)
router.post('/', authMiddleware, (req, res) => {
  try {
    const guardId = req.user.role === 'guard' ? req.user.id : req.body.guardId;
    const { lat, lng, accuracy } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
    }

    // Verify guard is clocked in
    const guard = db.prepare('SELECT clocked_in FROM guards WHERE id = ?').get(guardId);
    if (!guard || !guard.clocked_in) {
      return res.status(400).json({ success: false, error: 'Guard is not clocked in' });
    }

    db.prepare(
      'INSERT INTO guard_locations (guard_id, lat, lng, accuracy) VALUES (?, ?, ?, ?)'
    ).run(guardId, lat, lng, accuracy || null);

    res.json({ success: true, message: 'Location recorded' });
  } catch (err) {
    console.error('Location submit error:', err);
    res.status(500).json({ success: false, error: 'Failed to record location' });
  }
});

// GET /api/locations/:guardId - Get recent locations for a guard (admin)
router.get('/:guardId', authMiddleware, (req, res) => {
  try {
    const { limit = 48, dateFrom, dateTo } = req.query; // 48 = ~24hrs at 30min intervals

    let sql = 'SELECT * FROM guard_locations WHERE guard_id = ?';
    const params = [req.params.guardId];

    if (dateFrom) { sql += ' AND timestamp >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND timestamp <= ?'; params.push(dateTo); }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const locations = db.prepare(sql).all(...params);
    res.json({ success: true, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get locations' });
  }
});

// GET /api/locations/latest/all - Get latest location for all clocked-in guards
router.get('/latest/all', authMiddleware, (req, res) => {
  try {
    const locations = db.prepare(`
      SELECT gl.*, g.name as guard_name, g.site_id, s.name as site_name
      FROM guard_locations gl
      INNER JOIN (
        SELECT guard_id, MAX(timestamp) as max_ts FROM guard_locations GROUP BY guard_id
      ) latest ON gl.guard_id = latest.guard_id AND gl.timestamp = latest.max_ts
      INNER JOIN guards g ON gl.guard_id = g.id
      LEFT JOIN sites s ON g.site_id = s.id
      WHERE g.clocked_in = 1
    `).all();

    res.json({ success: true, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get latest locations' });
  }
});

module.exports = router;
