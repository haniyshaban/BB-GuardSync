// Staff Routes - Admin/Staff login
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware, requireRole } = require('../auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many login attempts' }
});

// POST /api/staff/login
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get(email);
    if (!staff) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, staff.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = generateToken({ id: staff.id, role: staff.role, name: staff.name, orgId: staff.org_id, siteId: staff.site_id });
    const { password: _, ...staffData } = staff;

    res.json({
      success: true,
      token,
      data: staffData
    });
  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/staff/me - Current staff profile
router.get('/me', authMiddleware, (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT s.id, s.name, s.email, s.phone, s.role, s.site_id, s.created_at, si.name as site_name 
      FROM staff s
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.id = ?
    `).get(req.user.id);
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });
    
    // Check if token is stale (site_id mismatch)
    const tokenSiteId = req.user.siteId || null;
    const currentSiteId = staff.site_id || null;
    
    if (tokenSiteId !== currentSiteId) {
      staff.tokenStale = true;
      staff.message = 'Your site assignment has changed. Please log out and log back in to see updated data.';
    }
    
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// PUT /api/staff/change-password
router.put('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }
    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.user.id);
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });

    const valid = bcrypt.compareSync(currentPassword, staff.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Current password is incorrect' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE staff SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// GET /api/staff - List staff (admin only)
router.get('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { siteId } = req.query;
    let sql = `SELECT s.id, s.name, s.email, s.phone, s.role, s.site_id, s.created_at, si.name as site_name 
               FROM staff s
               LEFT JOIN sites si ON s.site_id = si.id
               WHERE 1=1`;
    const params = [];

    if (siteId) {
      sql += ' AND s.site_id = ?';
      params.push(siteId);
    }

    sql += ' ORDER BY s.created_at DESC';
    const staff = db.prepare(sql).all(...params);
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list staff' });
  }
});

// POST /api/staff - Create staff member (admin only)
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, phone, role, site_id } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO staff (name, email, password, phone, role, site_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, hashedPassword, phone || null, role || 'staff', site_id || null);

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create staff' });
  }
});

// PATCH /api/staff/:id - Update staff member (admin only)
router.patch('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, site_id } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (site_id !== undefined) { updates.push('site_id = ?'); params.push(site_id); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    const sql = `UPDATE staff SET ${updates.join(', ')} WHERE id = ?`;
    const result = db.prepare(sql).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    res.json({ success: true, message: 'Staff updated successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update staff' });
  }
});

module.exports = router;
