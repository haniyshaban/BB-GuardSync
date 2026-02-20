// Black Belt - GuardSync Database (SQLite)
const Database = require('better-sqlite3');
const path = require('path');

// DATA_DIR env var lets Railway (or any host) point to a persistent volume mount.
// Default: ./data relative to this file (used in local dev and Docker without a volume).
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(dataDir, 'blackbelt.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ SCHEMA ============

db.exec(`
  -- Organizations table
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    logo TEXT,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Guards table
  CREATE TABLE IF NOT EXISTS guards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    employee_id TEXT UNIQUE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    shift_id INTEGER REFERENCES site_shifts(id) ON DELETE SET NULL,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','active','inactive','rejected')),
    clocked_in INTEGER NOT NULL DEFAULT 0,
    clock_in_time TEXT,
    daily_rate REAL NOT NULL DEFAULT 0,
    face_descriptor TEXT,
    photo_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  -- Sites table
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Site shifts
  CREATE TABLE IF NOT EXISTS site_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    days_of_week TEXT NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'
  );

  -- Guard attendance (clock in/out records)
  CREATE TABLE IF NOT EXISTS guard_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    clock_in TEXT NOT NULL,
    clock_out TEXT,
    date TEXT NOT NULL,
    hours_worked REAL,
    lat REAL,
    lng REAL
  );

  -- Guard location pings (every 30 mins during shift)
  CREATE TABLE IF NOT EXISTS guard_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy REAL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Archived location data (monthly archive)
  CREATE TABLE IF NOT EXISTS guard_locations_archive (
    id INTEGER PRIMARY KEY,
    guard_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy REAL,
    timestamp TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Face verification checks
  CREATE TABLE IF NOT EXISTS face_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    scheduled_for TEXT NOT NULL,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','expired')),
    passed INTEGER
  );

  -- Payroll records
  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    guard_name TEXT,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_days_worked INTEGER NOT NULL DEFAULT 0,
    daily_rate REAL NOT NULL DEFAULT 0,
    gross_pay REAL NOT NULL DEFAULT 0,
    deductions REAL NOT NULL DEFAULT 0,
    net_pay REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paid')),
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guard_id, month, year)
  );

  -- Staff / Admin users
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- System configuration
  CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    location_update_interval_mins INTEGER NOT NULL DEFAULT 30,
    face_checks_per_day_min INTEGER NOT NULL DEFAULT 2,
    face_checks_per_day_max INTEGER NOT NULL DEFAULT 4,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    idle_threshold_mins INTEGER NOT NULL DEFAULT 35,
    idle_distance_meters INTEGER NOT NULL DEFAULT 50
  );

  -- Ensure default config exists
  INSERT OR IGNORE INTO system_config (id) VALUES (1);

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_guard_attendance_guard_id ON guard_attendance(guard_id);
  CREATE INDEX IF NOT EXISTS idx_guard_attendance_date ON guard_attendance(date);
  CREATE INDEX IF NOT EXISTS idx_guard_locations_guard_id ON guard_locations(guard_id);
  CREATE INDEX IF NOT EXISTS idx_guard_locations_timestamp ON guard_locations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_face_checks_guard_id ON face_checks(guard_id);
  CREATE INDEX IF NOT EXISTS idx_face_checks_status ON face_checks(status);
  CREATE INDEX IF NOT EXISTS idx_payroll_guard_id ON payroll(guard_id);
  CREATE INDEX IF NOT EXISTS idx_guards_approval_status ON guards(approval_status);
  CREATE INDEX IF NOT EXISTS idx_guards_site_id ON guards(site_id);
  CREATE INDEX IF NOT EXISTS idx_guards_org_id ON guards(org_id);
  CREATE INDEX IF NOT EXISTS idx_sites_org_id ON sites(org_id);
  CREATE INDEX IF NOT EXISTS idx_staff_org_id ON staff(org_id);
  CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code);
`);

module.exports = db;
