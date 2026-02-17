// Attendance Routes - Clock in/out, listing, export
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// POST /api/attendance/clock-in
router.post('/clock-in', authMiddleware, (req, res) => {
  try {
    const guardId = req.user.role === 'guard' ? req.user.id : req.body.guardId;
    const { lat, lng } = req.body;

    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(guardId);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });
    if (guard.approval_status !== 'active') {
      return res.status(403).json({ success: false, error: 'Guard is not authorized' });
    }
    if (guard.clocked_in) {
      return res.status(400).json({ success: false, error: 'Already clocked in' });
    }

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const clockIn = now.toISOString();

    // Create attendance record
    const result = db.prepare(
      'INSERT INTO guard_attendance (guard_id, site_id, clock_in, date, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(guardId, guard.site_id, clockIn, date, lat || null, lng || null);

    // Update guard status
    db.prepare("UPDATE guards SET clocked_in = 1, clock_in_time = ?, updated_at = datetime('now') WHERE id = ?")
      .run(clockIn, guardId);

    // Schedule face checks for this shift
    scheduleFaceChecks(guardId, guard.shift_id);

    res.json({
      success: true,
      data: { attendanceId: result.lastInsertRowid, clockIn, date },
      message: 'Clocked in successfully'
    });
  } catch (err) {
    console.error('Clock-in error:', err);
    res.status(500).json({ success: false, error: 'Clock-in failed' });
  }
});

// POST /api/attendance/clock-out
router.post('/clock-out', authMiddleware, (req, res) => {
  try {
    const guardId = req.user.role === 'guard' ? req.user.id : req.body.guardId;
    const { lat, lng } = req.body;

    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(guardId);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });
    if (!guard.clocked_in) {
      return res.status(400).json({ success: false, error: 'Not clocked in' });
    }

    const clockOut = new Date().toISOString();

    // Find the open attendance record
    const attendance = db.prepare(
      'SELECT * FROM guard_attendance WHERE guard_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
    ).get(guardId);

    if (attendance) {
      const hoursWorked = (new Date(clockOut).getTime() - new Date(attendance.clock_in).getTime()) / (1000 * 60 * 60);
      db.prepare('UPDATE guard_attendance SET clock_out = ?, hours_worked = ? WHERE id = ?')
        .run(clockOut, Math.round(hoursWorked * 100) / 100, attendance.id);
    }

    // Update guard status
    db.prepare("UPDATE guards SET clocked_in = 0, clock_in_time = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(guardId);

    // Expire any pending face checks
    db.prepare("UPDATE face_checks SET status = 'expired' WHERE guard_id = ? AND status = 'pending'")
      .run(guardId);

    res.json({ success: true, data: { clockOut }, message: 'Clocked out successfully' });
  } catch (err) {
    console.error('Clock-out error:', err);
    res.status(500).json({ success: false, error: 'Clock-out failed' });
  }
});

// GET /api/attendance - List attendance records with filters
router.get('/', authMiddleware, (req, res) => {
  try {
    const { guardId, siteId, dateFrom, dateTo, date, page = 1, limit = 50 } = req.query;

    let sql = `SELECT a.*, g.name as guard_name, s.name as site_name 
               FROM guard_attendance a 
               LEFT JOIN guards g ON a.guard_id = g.id 
               LEFT JOIN sites s ON a.site_id = s.id WHERE 1=1`;
    const params = [];

    // Staff can only see attendance from their assigned site
    if (req.user.role === 'staff' && req.user.siteId) {
      sql += ' AND a.site_id = ?';
      params.push(req.user.siteId);
    }

    if (guardId) { sql += ' AND a.guard_id = ?'; params.push(guardId); }
    if (siteId) { sql += ' AND a.site_id = ?'; params.push(siteId); }
    if (date) { sql += ' AND a.date = ?'; params.push(date); }
    if (dateFrom) { sql += ' AND a.date >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND a.date <= ?'; params.push(dateTo); }

    // If guard is requesting their own
    if (req.user.role === 'guard') {
      sql += ' AND a.guard_id = ?';
      params.push(req.user.id);
    }

    const countSql = sql.replace(/SELECT a\.\*, g\.name as guard_name, s\.name as site_name\s+FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params)?.total || 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY a.clock_in DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const records = db.prepare(sql).all(...params);

    res.json({ success: true, data: records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Attendance list error:', err);
    res.status(500).json({ success: false, error: 'Failed to list attendance' });
  }
});

// GET /api/attendance/export - Export attendance as CSV
router.get('/export', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { dateFrom, dateTo, siteId, guardId } = req.query;

    let sql = `SELECT a.date, g.name as guard_name, g.employee_id, s.name as site_name, 
               a.clock_in, a.clock_out, a.hours_worked
               FROM guard_attendance a 
               LEFT JOIN guards g ON a.guard_id = g.id 
               LEFT JOIN sites s ON a.site_id = s.id WHERE 1=1`;
    const params = [];

    // Staff can only export attendance from their assigned site
    if (req.user.role === 'staff' && req.user.siteId) {
      sql += ' AND a.site_id = ?';
      params.push(req.user.siteId);
    }

    if (guardId) { sql += ' AND a.guard_id = ?'; params.push(guardId); }
    if (siteId) { sql += ' AND a.site_id = ?'; params.push(siteId); }
    if (dateFrom) { sql += ' AND a.date >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND a.date <= ?'; params.push(dateTo); }
    sql += ' ORDER BY a.date DESC, a.clock_in DESC';

    const records = db.prepare(sql).all(...params);

    // Generate CSV
    const headers = 'Date,Guard Name,Employee ID,Site,Clock In,Clock Out,Hours Worked\n';
    const rows = records.map(r =>
      `"${r.date}","${r.guard_name}","${r.employee_id || ''}","${r.site_name || ''}","${r.clock_in}","${r.clock_out || ''}","${r.hours_worked || ''}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${dateFrom || 'all'}-to-${dateTo || 'now'}.csv`);
    res.send(headers + rows);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export attendance' });
  }
});

// Helper: Schedule face checks when guard clocks in
function scheduleFaceChecks(guardId, shiftId) {
  try {
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    const minChecks = config?.face_checks_per_day_min || 2;
    const maxChecks = config?.face_checks_per_day_max || 4;
    const checksCount = Math.floor(Math.random() * (maxChecks - minChecks + 1)) + minChecks;

    const now = Date.now();
    let shiftEnd;

    if (shiftId) {
      const shift = db.prepare('SELECT * FROM site_shifts WHERE id = ?').get(shiftId);
      if (shift) {
        const today = new Date().toISOString().split('T')[0];
        const endParts = shift.end_time.split(':');
        const startParts = shift.start_time.split(':');
        shiftEnd = new Date(`${today}T${shift.end_time}:00`).getTime();
        // If end time is before start time, it's a night shift — add a day
        if (parseInt(endParts[0]) < parseInt(startParts[0])) {
          shiftEnd += 24 * 60 * 60 * 1000;
        }
      }
    }

    if (!shiftEnd) {
      shiftEnd = now + 8 * 60 * 60 * 1000; // Default 8 hour shift
    }

    const duration = shiftEnd - now;
    const segment = duration / checksCount;

    const insert = db.prepare(
      'INSERT INTO face_checks (guard_id, scheduled_for, status) VALUES (?, ?, ?)'
    );

    for (let i = 0; i < checksCount; i++) {
      const segStart = now + i * segment;
      const buffer = Math.min(15 * 60 * 1000, segment * 0.2);
      const t = segStart + buffer + Math.random() * (segment - 2 * buffer);
      insert.run(guardId, new Date(t).toISOString(), 'pending');
    }
  } catch (err) {
    console.error('Failed to schedule face checks:', err);
  }
}

module.exports = router;
