// Auth Routes - Guard login (phone/email + password)
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }
});

// POST /api/auth/login - Guard login with phone or email + password
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = phone or email

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Phone/email and password are required' });
    }

    // Find guard by phone or email
    const guard = db.prepare(
      'SELECT * FROM guards WHERE phone = ? OR email = ?'
    ).get(identifier, identifier);

    if (!guard) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check approval status
    if (guard.approval_status === 'pending') {
      return res.status(403).json({ success: false, error: 'Your enrollment is pending admin approval' });
    }
    if (guard.approval_status === 'rejected') {
      return res.status(403).json({ success: false, error: 'Your enrollment was rejected. Contact admin.' });
    }
    if (guard.approval_status === 'inactive') {
      return res.status(403).json({ success: false, error: 'Your account is inactive. Contact admin.' });
    }

    // Verify password
    const valid = bcrypt.compareSync(password, guard.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({ id: guard.id, role: 'guard', name: guard.name });

    // Get site and shift info
    let siteName = null, shiftLabel = null;
    if (guard.site_id) {
      const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(guard.site_id);
      siteName = site?.name;
    }
    if (guard.shift_id) {
      const shift = db.prepare('SELECT label FROM site_shifts WHERE id = ?').get(guard.shift_id);
      shiftLabel = shift?.label;
    }

    const { password: _, face_descriptor, ...guardData } = guard;
    res.json({
      success: true,
      data: {
        token,
        user: {
          ...guardData,
          siteName,
          shiftLabel,
          hasFaceDescriptor: !!face_descriptor,
        },
        role: 'guard',
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current guard profile
router.get('/me', require('../auth').authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') {
      return res.status(403).json({ success: false, error: 'Not a guard account' });
    }

    const guard = db.prepare(
      'SELECT g.*, s.name as site_name, sh.label as shift_label FROM guards g LEFT JOIN sites s ON g.site_id = s.id LEFT JOIN site_shifts sh ON g.shift_id = sh.id WHERE g.id = ?'
    ).get(req.user.id);

    if (!guard) {
      return res.status(404).json({ success: false, error: 'Guard not found' });
    }

    const { password: _, ...guardData } = guard;
    res.json({ success: true, data: guardData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

module.exports = router;
