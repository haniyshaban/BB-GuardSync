// Stats Routes - Dashboard statistics
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

// GET /api/stats/dashboard
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    const today = new Date().toISOString().split('T')[0];

    // Scope to site for staff users
    const siteId = (req.user.role === 'staff' && req.user.siteId) ? req.user.siteId : null;

    // Guard counts
    const totalGuards = siteId
      ? db.prepare("SELECT COUNT(*) as c FROM guards WHERE approval_status = 'active' AND site_id = ?").get(siteId)?.c || 0
      : db.prepare("SELECT COUNT(*) as c FROM guards WHERE approval_status = 'active'").get()?.c || 0;
    const pendingEnrollments = siteId
      ? db.prepare("SELECT COUNT(*) as c FROM guards WHERE approval_status = 'pending' AND site_id = ?").get(siteId)?.c || 0
      : db.prepare("SELECT COUNT(*) as c FROM guards WHERE approval_status = 'pending'").get()?.c || 0;
    const clockedInGuards = siteId
      ? db.prepare("SELECT COUNT(*) as c FROM guards WHERE clocked_in = 1 AND approval_status = 'active' AND site_id = ?").get(siteId)?.c || 0
      : db.prepare("SELECT COUNT(*) as c FROM guards WHERE clocked_in = 1 AND approval_status = 'active'").get()?.c || 0;

    // Compute online vs idle for clocked-in guards
    const clockedIn = siteId
      ? db.prepare("SELECT * FROM guards WHERE clocked_in = 1 AND approval_status = 'active' AND site_id = ?").all(siteId)
      : db.prepare("SELECT * FROM guards WHERE clocked_in = 1 AND approval_status = 'active'").all();
    let onlineCount = 0, idleCount = 0;

    for (const guard of clockedIn) {
      const lastLocs = db.prepare(
        'SELECT * FROM guard_locations WHERE guard_id = ? ORDER BY timestamp DESC LIMIT 2'
      ).all(guard.id);

      let status = 'online';
      if (lastLocs.length > 0) {
        const minsSince = (Date.now() - new Date(lastLocs[0].timestamp).getTime()) / (1000 * 60);
        if (minsSince > (config?.idle_threshold_mins || 35)) {
          status = 'idle';
        } else if (lastLocs.length >= 2) {
          const dist = haversine(lastLocs[0].lat, lastLocs[0].lng, lastLocs[1].lat, lastLocs[1].lng);
          if (dist < (config?.idle_distance_meters || 50)) status = 'idle';
        }
      }
      if (status === 'online') onlineCount++;
      else idleCount++;
    }

    const offlineCount = totalGuards - clockedInGuards;

    // Today's attendance
    const todayAttendance = siteId
      ? db.prepare('SELECT COUNT(DISTINCT guard_id) as c FROM guard_attendance WHERE date = ? AND site_id = ?').get(today, siteId)?.c || 0
      : db.prepare('SELECT COUNT(DISTINCT guard_id) as c FROM guard_attendance WHERE date = ?').get(today)?.c || 0;

    // Sites
    const totalSites = db.prepare('SELECT COUNT(*) as c FROM sites').get()?.c || 0;

    // Pending face checks (scoped to site via guard join)
    const now = new Date().toISOString();
    const pendingFaceChecks = siteId
      ? db.prepare("SELECT COUNT(*) as c FROM face_checks fc JOIN guards g ON fc.guard_id = g.id WHERE fc.status = 'pending' AND fc.scheduled_for <= ? AND g.site_id = ?").get(now, siteId)?.c || 0
      : db.prepare("SELECT COUNT(*) as c FROM face_checks WHERE status = 'pending' AND scheduled_for <= ?").get(now)?.c || 0;

    res.json({
      success: true,
      data: {
        totalGuards,
        activeGuards: clockedInGuards,
        onlineGuards: onlineCount,
        offlineGuards: offlineCount,
        idleGuards: idleCount,
        totalSites,
        todayAttendance,
        pendingEnrollments,
        pendingFaceChecks,
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// GET /api/stats/attendance-summary - Attendance summary for a period
router.get('/attendance-summary', authMiddleware, (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];

    const summary = db.prepare(`
      SELECT date, COUNT(DISTINCT guard_id) as guards_present, 
             AVG(hours_worked) as avg_hours
      FROM guard_attendance WHERE date >= ? AND date <= ? AND clock_out IS NOT NULL
      GROUP BY date ORDER BY date
    `).all(from, to);

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get attendance summary' });
  }
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
