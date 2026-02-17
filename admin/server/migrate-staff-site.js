// Migration: Add site_id column to staff table
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'blackbelt.db');
const db = new Database(DB_PATH);

console.log('⬛ Running migration: Add site_id to staff table...\n');

try {
  // Check if column exists
  const columns = db.prepare("PRAGMA table_info(staff)").all();
  const hasSiteId = columns.some(col => col.name === 'site_id');

  if (hasSiteId) {
    console.log('✓ site_id column already exists in staff table');
  } else {
    // Add site_id column
    db.exec('ALTER TABLE staff ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL');
    console.log('✓ Added site_id column to staff table');
  }

  console.log('\n⬛ Migration complete!\n');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}

db.close();
