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

    const token = generateToken({ id: staff.id, role: staff.role, name: staff.name, orgId: staff.org_id });
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
    const staff = db.prepare('SELECT id, name, email, phone, role, created_at FROM staff WHERE id = ?').get(req.user.id);
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// GET /api/staff - List staff (admin only)
router.get('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const staff = db.prepare('SELECT id, name, email, phone, role, created_at FROM staff').all();
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list staff' });
  }
});

// POST /api/staff - Create staff member (admin only)
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO staff (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hashedPassword, phone || null, role || 'staff');

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create staff' });
  }
});

module.exports = router;
