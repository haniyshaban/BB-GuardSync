// Organization Routes - Registration, Validation
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { generateToken, authMiddleware, requireRole } = require('../auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many registration attempts. Try again later.' }
});

/**
 * Generate a unique invite code like "ACME-7X3K"
 */
function generateInviteCode(slug) {
  const prefix = slug.slice(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Generate a URL-safe slug from an org name
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// POST /api/org/register - Register new organization + admin user (public)
router.post('/register', registerLimiter, (req, res) => {
  try {
    const { orgName, adminName, adminEmail, adminPassword, orgAddress, contactPhone } = req.body;

    if (!orgName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, error: 'Organization name, admin name, email, and password are required' });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Check if admin email already exists
    const existingStaff = db.prepare('SELECT id FROM staff WHERE email = ?').get(adminEmail);
    if (existingStaff) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    // Generate slug and invite code
    let slug = slugify(orgName);
    const existingSlug = db.prepare('SELECT id FROM organizations WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    let inviteCode = generateInviteCode(slug);
    // Ensure uniqueness
    while (db.prepare('SELECT id FROM organizations WHERE invite_code = ?').get(inviteCode)) {
      inviteCode = generateInviteCode(slug);
    }

    // Create org + admin in a transaction
    const createOrg = db.transaction(() => {
      const orgResult = db.prepare(`
        INSERT INTO organizations (name, slug, invite_code, address, contact_phone, contact_email)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orgName, slug, inviteCode, orgAddress || null, contactPhone || null, adminEmail);

      const orgId = orgResult.lastInsertRowid;

      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      const staffResult = db.prepare(`
        INSERT INTO staff (org_id, name, email, password, phone, role)
        VALUES (?, ?, ?, ?, ?, 'admin')
      `).run(orgId, adminName, adminEmail, hashedPassword, contactPhone || null);

      return {
        orgId,
        staffId: staffResult.lastInsertRowid,
        inviteCode,
        slug,
      };
    });

    const result = createOrg();

    // Generate token so the admin is logged in immediately
    const token = generateToken({ id: result.staffId, role: 'admin', name: adminName, orgId: result.orgId });

    res.status(201).json({
      success: true,
      token,
      data: {
        org: {
          id: result.orgId,
          name: orgName,
          slug: result.slug,
          inviteCode: result.inviteCode,
        },
        user: {
          id: result.staffId,
          name: adminName,
          email: adminEmail,
          role: 'admin',
          org_id: result.orgId,
        },
      },
      message: 'Organization registered successfully',
    });
  } catch (err) {
    console.error('Org registration error:', err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, error: 'Organization name or email already taken' });
    }
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// GET /api/org/validate/:code - Validate an invite code (public, for guard enrollment)
router.get('/validate/:code', (req, res) => {
  try {
    const org = db.prepare('SELECT id, name, slug FROM organizations WHERE invite_code = ? AND is_active = 1').get(req.params.code);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Invalid or expired organization code' });
    }
    res.json({ success: true, data: { id: org.id, name: org.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

// GET /api/org/me - Get current org details (authenticated staff)
router.get('/me', authMiddleware, (req, res) => {
  try {
    const staff = db.prepare('SELECT org_id FROM staff WHERE id = ?').get(req.user.id);
    if (!staff || !staff.org_id) {
      return res.status(404).json({ success: false, error: 'No organization found' });
    }

    const org = db.prepare('SELECT id, name, slug, invite_code, address, contact_email, contact_phone, is_active, created_at FROM organizations WHERE id = ?').get(staff.org_id);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    res.json({ success: true, data: org });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get organization' });
  }
});

module.exports = router;
