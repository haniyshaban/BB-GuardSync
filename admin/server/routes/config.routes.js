// Config Routes - System configuration
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// GET /api/config
router.get('/', authMiddleware, (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

// PUT /api/config
router.put('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { locationUpdateIntervalMins, faceChecksPerDayMin, faceChecksPerDayMax, dataRetentionDays, idleThresholdMins, idleDistanceMeters } = req.body;

    db.prepare(`
      UPDATE system_config SET
        location_update_interval_mins = COALESCE(?, location_update_interval_mins),
        face_checks_per_day_min = COALESCE(?, face_checks_per_day_min),
        face_checks_per_day_max = COALESCE(?, face_checks_per_day_max),
        data_retention_days = COALESCE(?, data_retention_days),
        idle_threshold_mins = COALESCE(?, idle_threshold_mins),
        idle_distance_meters = COALESCE(?, idle_distance_meters)
      WHERE id = 1
    `).run(locationUpdateIntervalMins, faceChecksPerDayMin, faceChecksPerDayMax, dataRetentionDays, idleThresholdMins, idleDistanceMeters);

    res.json({ success: true, message: 'Configuration updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

module.exports = router;
