// Black Belt - GuardSync Server Entry Point
const app = require('./app');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists (respects DATA_DIR env var same as db.js)
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database (creates tables via import)
const db = require('./db');

// Auto-create default admin if none exists
function seedDefaultAdmin() {
  try {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    // Ensure a default org exists
    let org = db.prepare('SELECT id, invite_code FROM organizations LIMIT 1').get();
    if (!org) {
      const inviteCode = process.env.ORG_INVITE_CODE ||
        ('BBGS-' + crypto.randomBytes(2).toString('hex').toUpperCase());
      const result = db.prepare(
        'INSERT OR IGNORE INTO organizations (name, slug, invite_code, is_active) VALUES (?, ?, ?, 1)'
      ).run('Black Belt GuardSync', 'black-belt-guardsync', inviteCode);
      org = { id: result.lastInsertRowid, invite_code: inviteCode };
      console.log(`  ✓ Default organization created (code: ${inviteCode})`);
    }

    const existing = db.prepare('SELECT id FROM staff WHERE role = ?').get('admin');
    if (!existing) {
      const email = process.env.ADMIN_EMAIL || 'admin@blackbelt.app';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(
        'INSERT OR IGNORE INTO staff (name, email, password, phone, role, org_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('Admin User', email, hash, '0000000000', 'admin', org.id);
      console.log(`  ✓ Default admin created: ${email}`);
    } else {
      // Link existing admin to the org if not already linked
      db.prepare('UPDATE staff SET org_id = ? WHERE id = ? AND org_id IS NULL')
        .run(org.id, existing.id);
    }
  } catch (err) {
    console.error('Auto-seed admin error:', err.message);
  }
}

// Auto-seed demo data if DB is empty
function seedDemoData() {
  try {
    const guardCount = db.prepare('SELECT COUNT(*) as count FROM guards').get().count;
    if (guardCount === 0) {
      console.log('  ⏳ Empty database detected, seeding demo data...');
      require('./seed');
      console.log('  ✓ Demo data seeded');
    }
  } catch (err) {
    console.error('Auto-seed demo error:', err.message);
  }
}

seedDemoData();
seedDefaultAdmin();

// ============ RANDOM FACE CHECK SCHEDULER ============
// Every 30 minutes: give each clocked-in guard a ~40% chance of receiving a face check
function scheduleRandomFaceChecks() {
  try {
    const clockedInGuards = db.prepare(
      "SELECT id FROM guards WHERE clocked_in = 1 AND approval_status = 'active'"
    ).all();

    let scheduled = 0;
    for (const guard of clockedInGuards) {
      if (Math.random() > 0.4) continue; // 40% chance

      // Skip if already has a pending check
      const existing = db.prepare(
        "SELECT id FROM face_checks WHERE guard_id = ? AND status = 'pending'"
      ).get(guard.id);
      if (existing) continue;

      // Schedule check for now (due immediately)
      db.prepare(
        'INSERT INTO face_checks (guard_id, scheduled_for) VALUES (?, datetime("now"))'
      ).run(guard.id);
      scheduled++;
    }

    if (scheduled > 0) {
      console.log(`[FaceCheck Scheduler] Scheduled ${scheduled} face checks`);
    }
  } catch (err) {
    console.error('[FaceCheck Scheduler] Error:', err.message);
  }
}

// Also expire any face checks that have been pending for more than 15 minutes
function expireOldFaceChecks() {
  try {
    const expired = db.prepare(`
      UPDATE face_checks SET status = 'expired'
      WHERE status = 'pending' AND scheduled_for < datetime('now', '-15 minutes')
    `).run();
    if (expired.changes > 0) {
      console.log(`[FaceCheck Scheduler] Expired ${expired.changes} overdue checks`);
    }
  } catch (err) {
    console.error('[FaceCheck Scheduler] Expire error:', err.message);
  }
}

// Run every 30 minutes
const FACE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
setInterval(() => {
  expireOldFaceChecks();
  scheduleRandomFaceChecks();
}, FACE_CHECK_INTERVAL_MS);

// Run once on startup (after 1 min delay to let server warm up)
setTimeout(() => {
  expireOldFaceChecks();
  scheduleRandomFaceChecks();
}, 60 * 1000);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n  ⬛ Black Belt - GuardSync API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

