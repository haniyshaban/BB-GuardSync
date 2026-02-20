// Face Checks Routes - Random face detection verification
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// Euclidean distance between two face descriptors (128-d float arrays)
function faceDistance(d1, d2) {
  if (!d1 || !d2 || d1.length !== d2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < d1.length; i++) sum += (d1[i] - d2[i]) ** 2;
  return Math.sqrt(sum);
}
const FACE_MATCH_THRESHOLD = 0.6; // standard face-api.js threshold

// GET /api/face-checks/pending/:guardId - Get pending face checks for guard
router.get('/pending/:guardId', authMiddleware, (req, res) => {
  try {
    const guardId = req.user.role === 'guard' ? req.user.id : req.params.guardId;
    const now = new Date().toISOString();

    // Get face checks that are due (scheduled_for <= now and still pending)
    const checks = db.prepare(`
      SELECT * FROM face_checks 
      WHERE guard_id = ? AND status = 'pending' AND scheduled_for <= ?
      ORDER BY scheduled_for ASC
    `).all(guardId, now);

    res.json({ success: true, data: checks });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get face checks' });
  }
});

// GET /api/face-checks/all/:guardId - Get all face checks for a guard today
router.get('/all/:guardId', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const checks = db.prepare(`
      SELECT * FROM face_checks 
      WHERE guard_id = ? AND DATE(scheduled_for) = ?
      ORDER BY scheduled_for ASC
    `).all(req.params.guardId, today);

    res.json({ success: true, data: checks });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get face checks' });
  }
});

// POST /api/face-checks/:checkId/result - Submit captured descriptor, server compares
router.post('/:checkId/result', authMiddleware, (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    const checkId = req.params.checkId;

    const check = db.prepare('SELECT * FROM face_checks WHERE id = ?').get(checkId);
    if (!check) return res.status(404).json({ success: false, error: 'Face check not found' });
    if (check.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Face check already completed' });
    }

    // Verify this guard owns this check
    if (req.user.role === 'guard' && check.guard_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your face check' });
    }

    // Fetch guard's enrolled face descriptor
    const guard = db.prepare('SELECT face_descriptor FROM guards WHERE id = ?').get(check.guard_id);
    const storedDescriptor = guard?.face_descriptor ? JSON.parse(guard.face_descriptor) : null;

    let passed;
    if (!storedDescriptor) {
      // Guard has no enrolled face — fail the check (require proper enrollment)
      passed = false;
      console.log(`[FaceCheck] Guard ${check.guard_id} has no enrolled face — auto-fail`);
    } else if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ success: false, error: 'No face descriptor provided' });
    } else {
      const distance = faceDistance(storedDescriptor, faceDescriptor);
      passed = distance <= FACE_MATCH_THRESHOLD;
      console.log(`[FaceCheck] Guard ${check.guard_id} distance=${distance.toFixed(3)} passed=${passed}`);
    }

    const status = passed ? 'passed' : 'failed';
    db.prepare(`
      UPDATE face_checks SET status = ?, passed = ?, completed_at = datetime('now') WHERE id = ?
    `).run(status, passed ? 1 : 0, checkId);

    res.json({ success: true, data: { passed }, message: `Face check ${status}` });
  } catch (err) {
    console.error('Face check result error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit face check result' });
  }
});

// GET /api/face-checks/stats - Admin stats on face checks
router.get('/stats/summary', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM face_checks WHERE DATE(scheduled_for) = ?
    `).get(today);

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get face check stats' });
  }
});

module.exports = router;
