// Sites Routes - CRUD + shifts
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// GET /api/sites - List all sites
router.get('/', authMiddleware, (req, res) => {
  try {
    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
    
    // Attach shifts and guard count for each site
    const sitesWithDetails = sites.map(site => {
      const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id);
      const guardCount = db.prepare('SELECT COUNT(*) as count FROM guards WHERE site_id = ? AND approval_status = ?').get(site.id, 'active')?.count || 0;
      return {
        ...site,
        shifts: shifts.map(s => ({ ...s, daysOfWeek: JSON.parse(s.days_of_week) })),
        guardCount,
      };
    });

    res.json({ success: true, data: sitesWithDetails });
  } catch (err) {
    console.error('List sites error:', err);
    res.status(500).json({ success: false, error: 'Failed to list sites' });
  }
});

// GET /api/sites/:id - Get single site with shifts
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });

    const shifts = db.prepare('SELECT * FROM site_shifts WHERE site_id = ?').all(site.id);
    const guards = db.prepare(
      "SELECT id, name, phone, employee_id, approval_status, clocked_in FROM guards WHERE site_id = ? AND approval_status = 'active'"
    ).all(site.id);

    res.json({
      success: true,
      data: {
        ...site,
        shifts: shifts.map(s => ({ ...s, daysOfWeek: JSON.parse(s.days_of_week) })),
        guards,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get site' });
  }
});

// POST /api/sites - Create site
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, address, contactPerson, contactPhone, shifts } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Site name is required' });
    }

    const result = db.prepare(
      'INSERT INTO sites (name, address, contact_person, contact_phone) VALUES (?, ?, ?, ?)'
    ).run(name, address || null, contactPerson || null, contactPhone || null);

    const siteId = result.lastInsertRowid;

    // Add shifts if provided
    if (shifts && Array.isArray(shifts)) {
      const insertShift = db.prepare(
        'INSERT INTO site_shifts (site_id, label, start_time, end_time, days_of_week) VALUES (?, ?, ?, ?, ?)'
      );
      for (const shift of shifts) {
        insertShift.run(siteId, shift.label, shift.startTime, shift.endTime, JSON.stringify(shift.daysOfWeek || ['mon','tue','wed','thu','fri','sat','sun']));
      }
    }

    res.status(201).json({ success: true, data: { id: siteId }, message: 'Site created' });
  } catch (err) {
    console.error('Create site error:', err);
    res.status(500).json({ success: false, error: 'Failed to create site' });
  }
});

// PUT /api/sites/:id - Update site
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, address, contactPerson, contactPhone } = req.body;
    
    db.prepare(`
      UPDATE sites SET name = COALESCE(?, name), address = COALESCE(?, address),
      contact_person = COALESCE(?, contact_person), contact_phone = COALESCE(?, contact_phone)
      WHERE id = ?
    `).run(name, address, contactPerson, contactPhone, req.params.id);

    res.json({ success: true, message: 'Site updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update site' });
  }
});

// DELETE /api/sites/:id
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    // Unassign guards from this site
    db.prepare('UPDATE guards SET site_id = NULL, shift_id = NULL WHERE site_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Site deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete site' });
  }
});

// ============ SHIFT MANAGEMENT ============

// POST /api/sites/:id/shifts - Add shift to site
router.post('/:id/shifts', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { label, startTime, endTime, daysOfWeek } = req.body;
    if (!label || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Shift label, start time, and end time are required' });
    }

    const result = db.prepare(
      'INSERT INTO site_shifts (site_id, label, start_time, end_time, days_of_week) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, label, startTime, endTime, JSON.stringify(daysOfWeek || ['mon','tue','wed','thu','fri','sat','sun']));

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add shift' });
  }
});

// PUT /api/sites/:siteId/shifts/:shiftId - Update shift
router.put('/:siteId/shifts/:shiftId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { label, startTime, endTime, daysOfWeek } = req.body;
    db.prepare(`
      UPDATE site_shifts SET label = COALESCE(?, label), start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time), days_of_week = COALESCE(?, days_of_week)
      WHERE id = ? AND site_id = ?
    `).run(label, startTime, endTime, daysOfWeek ? JSON.stringify(daysOfWeek) : null, req.params.shiftId, req.params.siteId);

    res.json({ success: true, message: 'Shift updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update shift' });
  }
});

// DELETE /api/sites/:siteId/shifts/:shiftId
router.delete('/:siteId/shifts/:shiftId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('UPDATE guards SET shift_id = NULL WHERE shift_id = ?').run(req.params.shiftId);
    db.prepare('DELETE FROM site_shifts WHERE id = ? AND site_id = ?').run(req.params.shiftId, req.params.siteId);
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete shift' });
  }
});

module.exports = router;
