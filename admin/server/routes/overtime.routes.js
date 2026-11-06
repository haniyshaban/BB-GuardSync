// Overtime Monitoring Routes
// Derives overtime from existing attendance records (hours_worked) vs configured thresholds.
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

function getConfig() {
  return db.prepare('SELECT ot_daily_threshold_hours, ot_weekly_threshold_hours FROM system_config WHERE id = 1').get()
    || { ot_daily_threshold_hours: 9, ot_weekly_threshold_hours: 48 };
}

// GET /api/overtime?from=YYYY-MM-DD&to=YYYY-MM-DD&siteId=
// Returns per-record overtime plus per-guard summary.
router.get('/', authMiddleware, (req, res) => {
  try {
    const cfg = getConfig();
    const dailyThreshold = cfg.ot_daily_threshold_hours;

    const now = new Date();
    const to = req.query.to || now.toISOString().split('T')[0];
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const siteId = req.query.siteId ? Number(req.query.siteId) : null;

    const rows = db.prepare(`
      SELECT a.id, a.guard_id, g.name AS guard_name, a.site_id, s.name AS site_name,
             a.date, a.clock_in, a.clock_out, a.hours_worked
      FROM guard_attendance a
      JOIN guards g ON g.id = a.guard_id
      LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.date BETWEEN ? AND ?
        AND a.hours_worked IS NOT NULL
        AND (? IS NULL OR a.site_id = ?)
      ORDER BY a.date DESC, g.name
    `).all(from, to, siteId, siteId);

    const records = rows.map(r => {
      const otHours = Math.max(0, (r.hours_worked || 0) - dailyThreshold);
      const abnormal = (r.hours_worked || 0) > dailyThreshold * 1.6; // >~14.4h on a 9h base
      return { ...r, overtime_hours: Math.round(otHours * 100) / 100, abnormal };
    }).filter(r => r.overtime_hours > 0);

    // Per-guard summary
    const byGuard = {};
    for (const r of records) {
      if (!byGuard[r.guard_id]) byGuard[r.guard_id] = { guard_id: r.guard_id, guard_name: r.guard_name, total_ot_hours: 0, days: 0, abnormal_days: 0 };
      byGuard[r.guard_id].total_ot_hours += r.overtime_hours;
      byGuard[r.guard_id].days += 1;
      if (r.abnormal) byGuard[r.guard_id].abnormal_days += 1;
    }
    const summary = Object.values(byGuard).map(s => ({ ...s, total_ot_hours: Math.round(s.total_ot_hours * 100) / 100 }))
      .sort((a, b) => b.total_ot_hours - a.total_ot_hours);

    res.json({
      success: true,
      data: {
        from, to,
        dailyThreshold,
        weeklyThreshold: cfg.ot_weekly_threshold_hours,
        totalOtHours: Math.round(records.reduce((s, r) => s + r.overtime_hours, 0) * 100) / 100,
        abnormalCount: records.filter(r => r.abnormal).length,
        records,
        summary,
      }
    });
  } catch (err) {
    console.error('Overtime report error:', err);
    res.status(500).json({ success: false, error: 'Failed to build overtime report' });
  }
});

// GET /api/overtime/export/:from/:to - CSV
router.get('/export/:from/:to', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const cfg = getConfig();
    const { from, to } = req.params;
    const rows = db.prepare(`
      SELECT a.date, g.name AS guard_name, s.name AS site_name, a.clock_in, a.clock_out, a.hours_worked
      FROM guard_attendance a
      JOIN guards g ON g.id = a.guard_id
      LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.date BETWEEN ? AND ? AND a.hours_worked IS NOT NULL
      ORDER BY a.date DESC
    `).all(from, to);

    const header = 'Date,Guard,Site,Clock In,Clock Out,Hours Worked,Overtime Hours\n';
    const body = rows.map(r => {
      const ot = Math.max(0, (r.hours_worked || 0) - cfg.ot_daily_threshold_hours).toFixed(2);
      return [r.date, r.guard_name, r.site_name || '', r.clock_in, r.clock_out || '', (r.hours_worked || 0).toFixed(2), ot]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.send(header + body);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export overtime' });
  }
});

module.exports = router;
