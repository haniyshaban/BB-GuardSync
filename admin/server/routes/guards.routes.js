// Guards Routes - Enrollment, CRUD, Authorization
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// POST /api/guards/enroll - Guard self-enrollment (public)
router.post('/enroll', (req, res) => {
  try {
    const { name, phone, email, password, photoUrl, faceDescriptor, orgCode } = req.body;

    if (!name || !phone || !email || !password || !orgCode) {
      return res.status(400).json({ success: false, error: 'Name, phone, email, password, and organization code are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Validate organization code
    const org = db.prepare('SELECT id, name FROM organizations WHERE invite_code = ? AND is_active = 1').get(orgCode);
    if (!org) {
      return res.status(400).json({ success: false, error: 'Invalid organization code. Please check with your employer.' });
    }

    // Check for existing phone/email
    const existing = db.prepare('SELECT id FROM guards WHERE phone = ? OR email = ?').get(phone, email);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Phone number or email already registered' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO guards (name, phone, email, password, photo_url, face_descriptor, org_id, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      name, phone, email, hashedPassword,
      photoUrl || null,
      faceDescriptor ? JSON.stringify(Array.isArray(faceDescriptor) ? faceDescriptor : JSON.parse(faceDescriptor)) : null,
      org.id
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid, orgName: org.name },
      message: `Enrollment submitted to ${org.name}. Waiting for admin approval.`
    });
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ success: false, error: 'Enrollment failed' });
  }
});

// GET /api/guards - List all guards (admin/staff)
router.get('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { status, approvalStatus, siteId, search, page = 1, limit = 50 } = req.query;
    
    let sql = `SELECT g.*, s.name as site_name, sh.label as shift_label 
               FROM guards g 
               LEFT JOIN sites s ON g.site_id = s.id 
               LEFT JOIN site_shifts sh ON g.shift_id = sh.id WHERE 1=1`;
    const params = [];

    // Staff can only see guards from their assigned site
    if (req.user.role === 'staff' && req.user.siteId) {
      sql += ' AND g.site_id = ?';
      params.push(req.user.siteId);
    }

    if (approvalStatus) {
      sql += ' AND g.approval_status = ?';
      params.push(approvalStatus);
    }
    if (siteId) {
      sql += ' AND g.site_id = ?';
      params.push(siteId);
    }
    if (search) {
      sql += ' AND (g.name LIKE ? OR g.phone LIKE ? OR g.email LIKE ? OR g.employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    // Count total
    const countSql = sql.replace(/SELECT g\.\*, s\.name as site_name, sh\.label as shift_label\s+FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params)?.total || 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const guards = db.prepare(sql).all(...params);

    // Compute live status for each guard
    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    let guardsWithStatus = guards.map(g => {
      const { password: _, ...guard } = g;
      guard.status = computeStatus(g, config);
      return guard;
    });

    // Filter by computed status if requested
    if (status) {
      guardsWithStatus = guardsWithStatus.filter(g => g.status === status);
    }

    res.json({ success: true, data: guardsWithStatus, total: guardsWithStatus.length, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('List guards error:', err);
    res.status(500).json({ success: false, error: 'Failed to list guards' });
  }
});

// GET /api/guards/:id - Get single guard (admin/staff)
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const guard = db.prepare(`
      SELECT g.*, s.name as site_name, sh.label as shift_label 
      FROM guards g 
      LEFT JOIN sites s ON g.site_id = s.id 
      LEFT JOIN site_shifts sh ON g.shift_id = sh.id 
      WHERE g.id = ?
    `).get(req.params.id);

    if (!guard) {
      return res.status(404).json({ success: false, error: 'Guard not found' });
    }

    const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
    const { password: _, ...guardData } = guard;
    guardData.status = computeStatus(guard, config);

    res.json({ success: true, data: guardData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get guard' });
  }
});

// PUT /api/guards/:id/authorize - Admin authorizes a pending guard
router.put('/:id/authorize', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { siteId, shiftId, dailyRate, employeeId } = req.body;

    if (!siteId || !shiftId || !dailyRate) {
      return res.status(400).json({ success: false, error: 'Site, shift, and daily rate are required' });
    }

    // Verify site and shift exist
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });

    const shift = db.prepare('SELECT id FROM site_shifts WHERE id = ? AND site_id = ?').get(shiftId, siteId);
    if (!shift) return res.status(404).json({ success: false, error: 'Shift not found for this site' });

    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });

    db.prepare(`
      UPDATE guards SET 
        approval_status = 'active', site_id = ?, shift_id = ?, daily_rate = ?, 
        employee_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(siteId, shiftId, dailyRate, employeeId || null, req.params.id);

    res.json({ success: true, message: 'Guard authorized successfully' });
  } catch (err) {
    console.error('Authorize error:', err);
    res.status(500).json({ success: false, error: 'Authorization failed' });
  }
});

// PUT /api/guards/:id/reject - Reject a guard enrollment
router.put('/:id/reject', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare("UPDATE guards SET approval_status = 'rejected', updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);
    res.json({ success: true, message: 'Guard enrollment rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Rejection failed' });
  }
});

// PATCH /api/guards/:id - Partial update (site/shift assignment, unassignment)
router.patch('/:id', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });

    // Accept both camelCase and snake_case keys; explicit null clears the field
    const has = (key1, key2) => req.body.hasOwnProperty(key1) || req.body.hasOwnProperty(key2);
    const val  = (key1, key2, fallback) => req.body.hasOwnProperty(key1) ? req.body[key1] : (req.body.hasOwnProperty(key2) ? req.body[key2] : fallback);

    const siteId         = val('siteId', 'site_id', guard.site_id);
    const shiftId        = val('shiftId', 'shift_id', guard.shift_id);
    const dailyRate      = val('dailyRate', 'daily_rate', guard.daily_rate);
    const employeeId     = val('employeeId', 'employee_id', guard.employee_id);
    const approvalStatus = val('approvalStatus', 'approval_status', guard.approval_status);

    db.prepare(`
      UPDATE guards SET
        site_id = ?, shift_id = ?, daily_rate = ?, employee_id = ?,
        approval_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(siteId, shiftId, dailyRate, employeeId, approvalStatus, req.params.id);

    res.json({ success: true, message: 'Guard updated' });
  } catch (err) {
    console.error('Patch guard error:', err);
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// PUT /api/guards/:id - Update guard details
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, phone, email, siteId, shiftId, dailyRate, employeeId, approvalStatus } = req.body;
    
    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });

    db.prepare(`
      UPDATE guards SET 
        name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email),
        site_id = COALESCE(?, site_id), shift_id = COALESCE(?, shift_id),
        daily_rate = COALESCE(?, daily_rate), employee_id = COALESCE(?, employee_id),
        approval_status = COALESCE(?, approval_status), updated_at = datetime('now')
      WHERE id = ?
    `).run(name, phone, email, siteId, shiftId, dailyRate, employeeId, approvalStatus, req.params.id);

    res.json({ success: true, message: 'Guard updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// DELETE /api/guards/:id - Delete guard
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM guards WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Guard deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

// Helper: compute guard status
function computeStatus(guard, config) {
  if (!guard.clocked_in) return 'offline';

  const lastLoc = db.prepare(
    'SELECT * FROM guard_locations WHERE guard_id = ? ORDER BY timestamp DESC LIMIT 2'
  ).all(guard.id);

  if (lastLoc.length === 0) return 'online'; // just clocked in

  const minutesSinceUpdate = (Date.now() - new Date(lastLoc[0].timestamp).getTime()) / (1000 * 60);
  if (minutesSinceUpdate > (config?.idle_threshold_mins || 35)) return 'idle';

  if (lastLoc.length >= 2) {
    const dist = haversineMeters(lastLoc[0].lat, lastLoc[0].lng, lastLoc[1].lat, lastLoc[1].lng);
    if (dist < (config?.idle_distance_meters || 50)) return 'idle';
  }

  return 'online';
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
