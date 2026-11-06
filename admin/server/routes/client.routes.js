// Client Visibility Routes - controlled, read-only access scoped to assigned sites
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// Resolve the set of site IDs a client may view (client_sites mappings + their staff.site_id).
function clientSiteIds(staffId) {
  const mapped = db.prepare('SELECT site_id FROM client_sites WHERE staff_id = ?').all(staffId).map(r => r.site_id);
  const own = db.prepare('SELECT site_id FROM staff WHERE id = ?').get(staffId)?.site_id;
  const set = new Set(mapped);
  if (own) set.add(own);
  return [...set];
}

function requireClient(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ success: false, error: 'Client access only' });
  const ids = clientSiteIds(req.user.id);
  if (!ids.length) return res.status(403).json({ success: false, error: 'No sites assigned to this client account' });
  req.clientSiteIds = ids;
  next();
}

function inClause(ids) { return ids.map(() => '?').join(','); }

// GET /api/client/overview
router.get('/overview', authMiddleware, requireClient, (req, res) => {
  try {
    const ids = req.clientSiteIds;
    const ph = inClause(ids);
    const today = new Date().toISOString().split('T')[0];
    const sites = db.prepare(`SELECT id, name, address FROM sites WHERE id IN (${ph})`).all(...ids);
    const totalGuards = db.prepare(`SELECT COUNT(*) AS c FROM guards WHERE approval_status='active' AND site_id IN (${ph})`).get(...ids).c;
    const onDuty = db.prepare(`SELECT COUNT(*) AS c FROM guards WHERE approval_status='active' AND clocked_in=1 AND site_id IN (${ph})`).get(...ids).c;
    const presentToday = db.prepare(`SELECT COUNT(DISTINCT guard_id) AS c FROM guard_attendance WHERE date=? AND site_id IN (${ph})`).get(today, ...ids).c;
    const openIncidents = db.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status!='resolved' AND site_id IN (${ph})`).get(...ids).c;
    res.json({ success: true, data: { sites, totalGuards, onDuty, presentToday, openIncidents } });
  } catch (err) {
    console.error('Client overview error:', err);
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

// GET /api/client/deployment - guards currently deployed at client's sites
router.get('/deployment', authMiddleware, requireClient, (req, res) => {
  try {
    const ph = inClause(req.clientSiteIds);
    const rows = db.prepare(`
      SELECT g.id, g.name, g.employee_id, g.clocked_in, g.clock_in_time,
             s.name AS site_name, sh.label AS shift_label
      FROM guards g LEFT JOIN sites s ON s.id = g.site_id
      LEFT JOIN site_shifts sh ON sh.id = g.shift_id
      WHERE g.approval_status='active' AND g.site_id IN (${ph})
      ORDER BY s.name, g.name
    `).all(...req.clientSiteIds);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load deployment' });
  }
});

// GET /api/client/attendance?date=YYYY-MM-DD
router.get('/attendance', authMiddleware, requireClient, (req, res) => {
  try {
    const ph = inClause(req.clientSiteIds);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const rows = db.prepare(`
      SELECT a.id, a.date, a.clock_in, a.clock_out, a.hours_worked,
             g.name AS guard_name, s.name AS site_name
      FROM guard_attendance a JOIN guards g ON g.id = a.guard_id
      LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.date = ? AND a.site_id IN (${ph})
      ORDER BY s.name, g.name
    `).all(date, ...req.clientSiteIds);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load attendance' });
  }
});

// GET /api/client/patrol?date=YYYY-MM-DD - patrol coverage summary per site
router.get('/patrol', authMiddleware, requireClient, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const data = req.clientSiteIds.map(siteId => {
      const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(siteId);
      const checkpoints = db.prepare('SELECT id, label FROM checkpoints WHERE site_id = ? AND is_active = 1').all(siteId);
      const covered = checkpoints.filter(c =>
        db.prepare('SELECT COUNT(*) AS c FROM patrol_scans WHERE checkpoint_id = ? AND date(scanned_at) = ?').get(c.id, date).c > 0
      ).length;
      const scans = db.prepare(`
        SELECT COUNT(*) AS c FROM patrol_scans ps JOIN checkpoints c ON c.id = ps.checkpoint_id
        WHERE c.site_id = ? AND date(ps.scanned_at) = ?
      `).get(siteId, date).c;
      return { site_id: siteId, site_name: site?.name, totalCheckpoints: checkpoints.length, covered, scans };
    });
    res.json({ success: true, data: { date, sites: data } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load patrol summary' });
  }
});

// GET /api/client/incidents - read-only incident list for client's sites
router.get('/incidents', authMiddleware, requireClient, (req, res) => {
  try {
    const ph = inClause(req.clientSiteIds);
    const rows = db.prepare(`
      SELECT i.id, i.type, i.category, i.severity, i.description, i.status, i.created_at,
             g.name AS guard_name, s.name AS site_name
      FROM incidents i LEFT JOIN guards g ON g.id = i.guard_id
      LEFT JOIN sites s ON s.id = i.site_id
      WHERE i.site_id IN (${ph})
      ORDER BY i.created_at DESC LIMIT 200
    `).all(...req.clientSiteIds);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load incidents' });
  }
});

// ---------- Admin: manage client site access ----------

// GET /api/client/:staffId/sites - sites a client can see
router.get('/:staffId/sites', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT cs.site_id, s.name AS site_name FROM client_sites cs
      JOIN sites s ON s.id = cs.site_id WHERE cs.staff_id = ?
    `).all(req.params.staffId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load client sites' });
  }
});

// POST /api/client/:staffId/sites { siteId }
router.post('/:staffId/sites', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { siteId } = req.body;
    if (!siteId) return res.status(400).json({ success: false, error: 'siteId required' });
    const client = db.prepare("SELECT role FROM staff WHERE id = ?").get(req.params.staffId);
    if (!client || client.role !== 'client') return res.status(400).json({ success: false, error: 'Target is not a client account' });
    db.prepare('INSERT OR IGNORE INTO client_sites (staff_id, site_id) VALUES (?, ?)').run(req.params.staffId, siteId);
    res.status(201).json({ success: true, message: 'Site access granted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to grant site access' });
  }
});

// DELETE /api/client/:staffId/sites/:siteId
router.delete('/:staffId/sites/:siteId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM client_sites WHERE staff_id = ? AND site_id = ?').run(req.params.staffId, req.params.siteId);
    res.json({ success: true, message: 'Site access revoked' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke site access' });
  }
});

module.exports = router;
