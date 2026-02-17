// Monthly location data archival job
// Run via: node jobs/archive-locations.js
// Schedule with cron: 0 2 1 * * (2 AM on 1st of each month)

const db = require('../db');

const config = db.prepare('SELECT * FROM system_config WHERE id = 1').get();
const retentionDays = config?.data_retention_days || 30;

const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

console.log(`⬛ Archiving location data older than ${retentionDays} days (before ${cutoffDate})...`);

// Archive old locations
const archived = db.prepare(`
  INSERT INTO guard_locations_archive (id, guard_id, lat, lng, accuracy, timestamp)
  SELECT id, guard_id, lat, lng, accuracy, timestamp
  FROM guard_locations WHERE timestamp < ?
`).run(cutoffDate);

console.log(`  Archived ${archived.changes} location records`);

// Delete archived records from main table
const deleted = db.prepare('DELETE FROM guard_locations WHERE timestamp < ?').run(cutoffDate);
console.log(`  Deleted ${deleted.changes} records from active table`);

// Archive old expired/completed face checks
const archivedChecks = db.prepare(`
  DELETE FROM face_checks WHERE (status = 'expired' OR status = 'passed' OR status = 'failed') 
  AND requested_at < ?
`).run(cutoffDate);
console.log(`  Cleaned ${archivedChecks.changes} old face check records`);

// Vacuum to reclaim disk space
console.log('  Running VACUUM...');
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');

console.log('⬛ Archive complete!\n');
