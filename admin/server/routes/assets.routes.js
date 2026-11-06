// Assets & Inventory Routes
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// GET /api/assets - list assets with allocation summary
router.get('/', authMiddleware, (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets ORDER BY name').all();
    const data = assets.map(a => {
      const issued = db.prepare(
        "SELECT COALESCE(SUM(quantity),0) AS q FROM asset_allocations WHERE asset_id = ? AND status = 'issued'"
      ).get(a.id).q;
      return { ...a, issued, available_qty: Math.max(0, a.quantity - issued) };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('List assets error:', err);
    res.status(500).json({ success: false, error: 'Failed to list assets' });
  }
});

// GET /api/assets/summary - inventory totals
router.get('/summary', authMiddleware, (req, res) => {
  try {
    const totalAssets = db.prepare('SELECT COUNT(*) AS c FROM assets').get().c;
    const totalUnits = db.prepare('SELECT COALESCE(SUM(quantity),0) AS q FROM assets').get().q;
    const issuedUnits = db.prepare("SELECT COALESCE(SUM(quantity),0) AS q FROM asset_allocations WHERE status = 'issued'").get().q;
    const totalValue = db.prepare('SELECT COALESCE(SUM(quantity * unit_value),0) AS v FROM assets').get().v;
    const lostDamaged = db.prepare("SELECT COUNT(*) AS c FROM asset_allocations WHERE status IN ('lost','damaged')").get().c;
    res.json({ success: true, data: { totalAssets, totalUnits, issuedUnits, availableUnits: totalUnits - issuedUnits, totalValue, lostDamaged } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get inventory summary' });
  }
});

// GET /api/assets/:id - asset with allocations
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    const allocations = db.prepare(`
      SELECT al.*, g.name AS guard_name, s.name AS site_name
      FROM asset_allocations al
      LEFT JOIN guards g ON g.id = al.guard_id
      LEFT JOIN sites s ON s.id = al.site_id
      WHERE al.asset_id = ? ORDER BY al.allocated_at DESC
    `).all(req.params.id);
    res.json({ success: true, data: { ...asset, allocations } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get asset' });
  }
});

// POST /api/assets - create
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, category, assetTag, quantity, unitValue, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Asset name is required' });
    const result = db.prepare(
      'INSERT INTO assets (name, category, asset_tag, quantity, unit_value, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, category || null, assetTag || null, quantity || 1, unitValue || 0, notes || null);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Asset created' });
  } catch (err) {
    if (String(err).includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Asset tag already exists' });
    res.status(500).json({ success: false, error: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id - update
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { name, category, assetTag, quantity, unitValue, status, notes } = req.body;
    db.prepare(`
      UPDATE assets SET name = COALESCE(?, name), category = COALESCE(?, category),
        asset_tag = COALESCE(?, asset_tag), quantity = COALESCE(?, quantity),
        unit_value = COALESCE(?, unit_value), status = COALESCE(?, status), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name, category, assetTag, quantity, unitValue, status, notes, req.params.id);
    res.json({ success: true, message: 'Asset updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Asset deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete asset' });
  }
});

// POST /api/assets/:id/allocate - issue to guard or site
router.post('/:id/allocate', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { guardId, siteId, quantity, notes } = req.body;
    if (!guardId && !siteId) return res.status(400).json({ success: false, error: 'guardId or siteId required' });
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const issued = db.prepare("SELECT COALESCE(SUM(quantity),0) AS q FROM asset_allocations WHERE asset_id = ? AND status = 'issued'").get(asset.id).q;
    const qty = quantity || 1;
    if (issued + qty > asset.quantity) {
      return res.status(400).json({ success: false, error: `Only ${asset.quantity - issued} unit(s) available` });
    }
    const result = db.prepare(
      'INSERT INTO asset_allocations (asset_id, guard_id, site_id, quantity, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(asset.id, guardId || null, siteId || null, qty, notes || null);

    if (issued + qty >= asset.quantity) db.prepare("UPDATE assets SET status = 'allocated' WHERE id = ?").run(asset.id);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Asset allocated' });
  } catch (err) {
    console.error('Allocate asset error:', err);
    res.status(500).json({ success: false, error: 'Failed to allocate asset' });
  }
});

// PUT /api/assets/allocations/:allocId - return / mark lost / damaged
router.put('/allocations/:allocId', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['returned', 'lost', 'damaged', 'issued'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const alloc = db.prepare('SELECT * FROM asset_allocations WHERE id = ?').get(req.params.allocId);
    if (!alloc) return res.status(404).json({ success: false, error: 'Allocation not found' });

    const returnedAt = status === 'issued' ? null : new Date().toISOString();
    db.prepare('UPDATE asset_allocations SET status = ?, returned_at = ?, notes = COALESCE(?, notes) WHERE id = ?')
      .run(status, returnedAt, notes, req.params.allocId);

    // Refresh asset availability flag
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(alloc.asset_id);
    const issued = db.prepare("SELECT COALESCE(SUM(quantity),0) AS q FROM asset_allocations WHERE asset_id = ? AND status = 'issued'").get(asset.id).q;
    if (asset.status !== 'maintenance' && asset.status !== 'retired') {
      db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(issued >= asset.quantity ? 'allocated' : 'available', asset.id);
    }
    res.json({ success: true, message: 'Allocation updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update allocation' });
  }
});

// GET /api/assets/by-guard/:guardId - assets held by a guard
router.get('/by-guard/:guardId', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT al.*, a.name AS asset_name, a.category, a.asset_tag
      FROM asset_allocations al JOIN assets a ON a.id = al.asset_id
      WHERE al.guard_id = ? ORDER BY al.allocated_at DESC
    `).all(req.params.guardId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get guard assets' });
  }
});

module.exports = router;
