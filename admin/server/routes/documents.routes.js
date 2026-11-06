// Guard Documents Routes (Aadhaar/PAN/EPF/Bank/PASARA/Police verification)
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

const DOC_TYPES = ['aadhaar', 'pan', 'epf', 'bank', 'pasara', 'police_verification', 'other'];

// GET /api/documents/guard/:guardId - all documents for a guard
router.get('/guard/:guardId', authMiddleware, (req, res) => {
  try {
    const docs = db.prepare(`
      SELECT d.*, s.name AS verified_by_name
      FROM guard_documents d LEFT JOIN staff s ON s.id = d.verified_by
      WHERE d.guard_id = ? ORDER BY d.created_at DESC
    `).all(req.params.guardId);
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list documents' });
  }
});

// POST /api/documents - add a document record
router.post('/', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { guardId, docType, docNumber, fileUrl, notes } = req.body;
    if (!guardId || !docType) return res.status(400).json({ success: false, error: 'guardId and docType required' });
    if (!DOC_TYPES.includes(docType)) return res.status(400).json({ success: false, error: 'Invalid docType' });
    const guard = db.prepare('SELECT id FROM guards WHERE id = ?').get(guardId);
    if (!guard) return res.status(404).json({ success: false, error: 'Guard not found' });

    const result = db.prepare(
      'INSERT INTO guard_documents (guard_id, doc_type, doc_number, file_url, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(guardId, docType, docNumber || null, fileUrl || null, notes || null);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: 'Document added' });
  } catch (err) {
    console.error('Add document error:', err);
    res.status(500).json({ success: false, error: 'Failed to add document' });
  }
});

// PUT /api/documents/:id/verify - verify or unverify
router.put('/:id/verify', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { verified } = req.body;
    const isVerified = verified === false ? 0 : 1;
    db.prepare(`
      UPDATE guard_documents SET verified = ?, verified_by = ?, verified_at = ?
      WHERE id = ?
    `).run(isVerified, isVerified ? req.user.id : null, isVerified ? new Date().toISOString() : null, req.params.id);

    // Reflect overall KYC status: all known statutory docs present & verified
    const doc = db.prepare('SELECT guard_id FROM guard_documents WHERE id = ?').get(req.params.id);
    if (doc) {
      const required = ['aadhaar', 'pan', 'bank'];
      const verifiedTypes = db.prepare(
        "SELECT DISTINCT doc_type FROM guard_documents WHERE guard_id = ? AND verified = 1"
      ).all(doc.guard_id).map(r => r.doc_type);
      const allVerified = required.every(t => verifiedTypes.includes(t));
      db.prepare('UPDATE guards SET kyc_verified = ? WHERE id = ?').run(allVerified ? 1 : 0, doc.guard_id);
    }
    res.json({ success: true, message: 'Document verification updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to verify document' });
  }
});

// PUT /api/documents/:id - update a document record
router.put('/:id', authMiddleware, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { docNumber, fileUrl, notes } = req.body;
    db.prepare('UPDATE guard_documents SET doc_number = COALESCE(?, doc_number), file_url = COALESCE(?, file_url), notes = COALESCE(?, notes) WHERE id = ?')
      .run(docNumber, fileUrl, notes, req.params.id);
    res.json({ success: true, message: 'Document updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM guard_documents WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

module.exports = router;
