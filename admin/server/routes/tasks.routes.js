// Field Task Management Routes
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// ---------- Guard-facing ----------

// GET /api/tasks/mine - tasks assigned to the logged-in guard
router.get('/mine', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'guard') return res.status(403).json({ success: false, error: 'Guards only' });
    const rows = db.prepare(`
      SELECT t.*, s.name AS site_name FROM tasks t LEFT JOIN sites s ON s.id = t.site_id
      WHERE t.guard_id = ? AND t.status != 'cancelled'
      ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.due_at
    `).all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load tasks' });
  }
});

// PUT /api/tasks/:id/status - guard updates own task (in_progress/done)
router.put('/:id/status', authMiddleware, (req, res) => {
  try {
    const { status, note, photoUrl } = req.body;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    // Guards may only update their own tasks and cannot "verify"
    if (req.user.role === 'guard') {
      if (task.guard_id !== req.user.id) return res.status(403).json({ success: false, error: 'Not your task' });
      if (!['in_progress', 'done'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
    } else if (!['open', 'in_progress', 'done', 'verified', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const completedAt = (status === 'done' || status === 'verified') ? (task.completed_at || new Date().toISOString()) : null;
    db.prepare(`
      UPDATE tasks SET status = ?, completion_note = COALESCE(?, completion_note),
        completion_photo_url = COALESCE(?, completion_photo_url), completed_at = ?
      WHERE id = ?
    `).run(status, note || null, photoUrl || null, completedAt, req.params.id);
    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// ---------- Admin / staff-facing ----------

// GET /api/tasks?status=&guardId=&siteId=
router.get('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { status, guardId, siteId } = req.query;
    const where = [], params = [];
    if (status) { where.push('t.status = ?'); params.push(status); }
    if (guardId) { where.push('t.guard_id = ?'); params.push(Number(guardId)); }
    if (siteId) { where.push('t.site_id = ?'); params.push(Number(siteId)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT t.*, g.name AS guard_name, s.name AS site_name, st.name AS created_by_name
      FROM tasks t
      LEFT JOIN guards g ON g.id = t.guard_id
      LEFT JOIN sites s ON s.id = t.site_id
      LEFT JOIN staff st ON st.id = t.created_by
      ${whereSql}
      ORDER BY t.created_at DESC LIMIT 500
    `).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ success: false, error: 'Failed to list tasks' });
  }
});

// POST /api/tasks - create / assign
router.post('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { guardId, siteId, title, description, priority, dueAt } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });
    const orgId = db.prepare('SELECT org_id FROM staff WHERE id = ?').get(req.user.id)?.org_id || null;
    const result = db.prepare(`
      INSERT INTO tasks (org_id, guard_id, site_id, title, description, priority, due_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orgId, guardId || null, siteId || null, title, description || null, priority || 'normal', dueAt || null, req.user.id);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Task created' });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - edit
router.put('/:id', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { guardId, siteId, title, description, priority, dueAt } = req.body;
    db.prepare(`
      UPDATE tasks SET guard_id = COALESCE(?, guard_id), site_id = COALESCE(?, site_id),
        title = COALESCE(?, title), description = COALESCE(?, description),
        priority = COALESCE(?, priority), due_at = COALESCE(?, due_at)
      WHERE id = ?
    `).run(guardId, siteId, title, description, priority, dueAt, req.params.id);
    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

module.exports = router;
