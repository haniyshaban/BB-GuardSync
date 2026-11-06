// Shared alert creation helper.
// Centralises operational alert inserts (sleep, shortage, sos, incident, overtime, low_battery, offline, face_fail).
// De-dupes active alerts of the same (type, guard, site) within a short window so jobs can run idempotently.
const db = require('../db');

const DEDUP_WINDOW_MINUTES = 60;

/**
 * Create an alert, unless an active one of the same type/guard/site exists within the dedup window.
 * @returns {number|null} inserted alert id, or null if suppressed as duplicate.
 */
function createAlert({ orgId = null, guardId = null, siteId = null, type, severity = 'medium', message, meta = null }) {
  const existing = db.prepare(`
    SELECT id FROM alerts
    WHERE type = ? AND status = 'active'
      AND IFNULL(guard_id, -1) = IFNULL(?, -1)
      AND IFNULL(site_id, -1) = IFNULL(?, -1)
      AND created_at >= datetime('now', ?)
    LIMIT 1
  `).get(type, guardId, siteId, `-${DEDUP_WINDOW_MINUTES} minutes`);
  if (existing) return null;

  const result = db.prepare(`
    INSERT INTO alerts (org_id, guard_id, site_id, type, severity, message, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, guardId, siteId, type, severity, message, meta ? JSON.stringify(meta) : null);
  return result.lastInsertRowid;
}

module.exports = { createAlert };
