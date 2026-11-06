// Leave Requests: guards apply from the guard app; admin/staff approve or reject.
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function days(start, end) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}

// Staff only see requests from guards at their own site.
function staffSiteClause(req, params) {
  if (req.user.role === 'staff' && req.user.siteId) {
    params.push(req.user.siteId);
    return ' AND g.site_id = ?';
  }
  return '';
}

// ---------- Guard-facing ----------

// POST /api/leave - guard applies for leave
router.post('/', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const { leaveType = 'casual', startDate, endDate, reason } = req.body;

    if (!LEAVE_TYPES.includes(leaveType)) return res.status(400).json({ success: false, error: 'Invalid leave type' });
    if (!DATE_RE.test(startDate || '') || !DATE_RE.test(endDate || '') || Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
      return res.status(400).json({ success: false, error: 'Start and end dates are required (YYYY-MM-DD)' });
    }
    if (endDate < startDate) return res.status(400).json({ success: false, error: 'End date cannot be before start date' });
    if (days(startDate, endDate) > 60) return res.status(400).json({ success: false, error: 'A single request can cover at most 60 days' });
    const today = new Date().toISOString().split('T')[0];
    if (endDate < today) return res.status(400).json({ success: false, error: 'Leave dates are in the past' });
    if (reason && String(reason).length > 500) return res.status(400).json({ success: false, error: 'Reason is too long' });

    // Reject overlap with the guard's own pending/approved leave.
    const overlap = db.prepare(`
      SELECT id FROM leave_requests
      WHERE guard_id = ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ?
    `).get(req.user.id, endDate, startDate);
    if (overlap) return res.status(409).json({ success: false, error: 'You already have leave covering these dates' });

    const r = db.prepare('INSERT INTO leave_requests (guard_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, leaveType, startDate, endDate, reason ? String(reason).trim() : null);
    res.status(201).json({ success: true, data: { id: r.lastInsertRowid }, message: 'Leave request submitted' });
  } catch (err) {
    console.error('Create leave error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit leave request' });
  }
});

// GET /api/leave/mine - guard's own requests
router.get('/mine', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const rows = db.prepare('SELECT * FROM leave_requests WHERE guard_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load leave requests' });
  }
});

// PUT /api/leave/:id/cancel - guard cancels their own pending request
router.put('/:id/cancel', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const r = db.prepare("UPDATE leave_requests SET status = 'cancelled' WHERE id = ? AND guard_id = ? AND status = 'pending'")
      .run(req.params.id, req.user.id);
    if (!r.changes) return res.status(400).json({ success: false, error: 'Only your pending requests can be cancelled' });
    res.json({ success: true, message: 'Leave request cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel leave request' });
  }
});

// ---------- Admin / staff ----------

// GET /api/leave?status=pending - list requests
router.get('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT l.*, g.name AS guard_name, g.employee_id, s.name AS site_name, st.name AS reviewed_by_name
      FROM leave_requests l
      JOIN guards g ON g.id = l.guard_id
      LEFT JOIN sites s ON s.id = g.site_id
      LEFT JOIN staff st ON st.id = l.reviewed_by
      WHERE 1=1`;
    if (req.query.status) { sql += ' AND l.status = ?'; params.push(req.query.status); }
    sql += staffSiteClause(req, params);
    sql += " ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.start_date DESC LIMIT 500";
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  } catch (err) {
    console.error('List leave error:', err);
    res.status(500).json({ success: false, error: 'Failed to list leave requests' });
  }
});

// GET /api/leave/summary - pending count + guards on leave today
router.get('/summary', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const p1 = [], p2 = [today, today];
    const pending = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests l JOIN guards g ON g.id = l.guard_id WHERE l.status = 'pending'${staffSiteClause(req, p1)}`).get(...p1).c;
    const onLeaveToday = db.prepare(`SELECT COUNT(DISTINCT l.guard_id) AS c FROM leave_requests l JOIN guards g ON g.id = l.guard_id
      WHERE l.status = 'approved' AND l.start_date <= ? AND l.end_date >= ?${staffSiteClause(req, p2)}`).get(...p2).c;
    res.json({ success: true, data: { pending, onLeaveToday } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load leave summary' });
  }
});

// PUT /api/leave/:id/decision { status: 'approved'|'rejected', note }
router.put('/:id/decision', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: 'Status must be approved or rejected' });

    const params = [req.params.id];
    const row = db.prepare(`SELECT l.id, l.status FROM leave_requests l JOIN guards g ON g.id = l.guard_id WHERE l.id = ?${staffSiteClause(req, params)}`).get(...params);
    if (!row) return res.status(404).json({ success: false, error: 'Leave request not found' });
    if (row.status !== 'pending') return res.status(400).json({ success: false, error: `This request is already ${row.status}` });

    db.prepare("UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ? WHERE id = ?")
      .run(status, req.user.id, note ? String(note).slice(0, 500) : null, row.id);
    res.json({ success: true, message: `Leave ${status}` });
  } catch (err) {
    console.error('Leave decision error:', err);
    res.status(500).json({ success: false, error: 'Failed to update leave request' });
  }
});

module.exports = router;
