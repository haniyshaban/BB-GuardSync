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
    role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff','client')),
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

  -- ============ RAKSHAM MODULES ============

  -- Guard statutory documents (Aadhaar/PAN/EPF/Bank/PASARA etc.)
  CREATE TABLE IF NOT EXISTS guard_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('aadhaar','pan','epf','bank','pasara','police_verification','other')),
    doc_number TEXT,
    file_url TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    verified_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Assets catalogue
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT,
    asset_tag TEXT UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_value REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','allocated','maintenance','retired')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Asset allocations to guard or site
  CREATE TABLE IF NOT EXISTS asset_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    guard_id INTEGER REFERENCES guards(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
    returned_at TEXT,
    status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','returned','lost','damaged')),
    notes TEXT
  );

  -- Field tasks assigned to guards
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    guard_id INTEGER REFERENCES guards(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','verified','cancelled')),
    due_at TEXT,
    created_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    completed_at TEXT,
    completion_note TEXT,
    completion_photo_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Incident reports (incl. SOS)
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    guard_id INTEGER REFERENCES guards(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'incident' CHECK(type IN ('incident','sos')),
    category TEXT,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    description TEXT,
    photo_url TEXT,
    lat REAL,
    lng REAL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),
    acknowledged_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    acknowledged_at TEXT,
    resolved_at TEXT,
    resolution_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Operational alerts / notifications (sleep alert, shortage, SOS, etc.)
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    guard_id INTEGER REFERENCES guards(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('sleep','shortage','sos','incident','overtime','face_fail','low_battery','offline','offsite')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    message TEXT NOT NULL,
    meta TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acknowledged','resolved')),
    acknowledged_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    acknowledged_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Patrol checkpoints per site
  CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    code TEXT,
    lat REAL,
    lng REAL,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Patrol scan events
  CREATE TABLE IF NOT EXISTS patrol_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    lat REAL,
    lng REAL,
    distance_meters REAL,
    verified INTEGER NOT NULL DEFAULT 0,
    photo_url TEXT,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Client site access (controlled read-only visibility)
  CREATE TABLE IF NOT EXISTS client_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE(staff_id, site_id)
  );

  -- Indexes for new modules
  CREATE INDEX IF NOT EXISTS idx_guard_documents_guard_id ON guard_documents(guard_id);
  CREATE INDEX IF NOT EXISTS idx_asset_allocations_asset_id ON asset_allocations(asset_id);
  CREATE INDEX IF NOT EXISTS idx_asset_allocations_guard_id ON asset_allocations(guard_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_guard_id ON tasks(guard_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
  CREATE INDEX IF NOT EXISTS idx_incidents_guard_id ON incidents(guard_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
  CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
  CREATE INDEX IF NOT EXISTS idx_checkpoints_site_id ON checkpoints(site_id);
  CREATE INDEX IF NOT EXISTS idx_patrol_scans_guard_id ON patrol_scans(guard_id);
  CREATE INDEX IF NOT EXISTS idx_patrol_scans_checkpoint_id ON patrol_scans(checkpoint_id);
  CREATE INDEX IF NOT EXISTS idx_client_sites_staff_id ON client_sites(staff_id);

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

// ============ MIGRATIONS (for existing databases) ============
// Idempotent: adds columns only if missing, and rebuilds CHECK constraints via user_version.

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Guard statutory inline fields (quick-reference; files/verification live in guard_documents)
addColumn('guards', 'aadhaar_number', 'TEXT');
addColumn('guards', 'pan_number', 'TEXT');
addColumn('guards', 'epf_number', 'TEXT');
addColumn('guards', 'bank_account', 'TEXT');
addColumn('guards', 'bank_ifsc', 'TEXT');
addColumn('guards', 'pasara_number', 'TEXT');
addColumn('guards', 'kyc_verified', 'INTEGER NOT NULL DEFAULT 0');

// Battery + distance telemetry on location pings (Command Centre / low-battery alerts)
addColumn('guard_locations', 'battery', 'INTEGER');
addColumn('guard_locations_archive', 'battery', 'INTEGER');

// Overtime + night-shift + alert thresholds on config
addColumn('system_config', 'ot_daily_threshold_hours', 'REAL NOT NULL DEFAULT 9');
addColumn('system_config', 'ot_weekly_threshold_hours', 'REAL NOT NULL DEFAULT 48');
addColumn('system_config', 'night_shift_start', "TEXT NOT NULL DEFAULT '22:00'");
addColumn('system_config', 'night_shift_end', "TEXT NOT NULL DEFAULT '06:00'");
addColumn('system_config', 'sleep_inactivity_mins', 'INTEGER NOT NULL DEFAULT 45');
addColumn('system_config', 'low_battery_threshold', 'INTEGER NOT NULL DEFAULT 15');
addColumn('system_config', 'offsite_grace_mins', 'INTEGER NOT NULL DEFAULT 10');

// Geofencing: geotag a site and define an allowed radius; guards outside it too long are "off-site".
addColumn('sites', 'lat', 'REAL');
addColumn('sites', 'lng', 'REAL');
addColumn('sites', 'geofence_radius_m', 'INTEGER NOT NULL DEFAULT 150');
addColumn('sites', 'geofence_enabled', 'INTEGER NOT NULL DEFAULT 0');

// When a clocked-in guard first left their site geofence (cleared when back inside).
addColumn('guards', 'offsite_since', 'TEXT');

// Fence shape: 'radius' (centre + geofence_radius_m) or 'polygon' (site_geofence_points).
addColumn('sites', 'geofence_type', "TEXT NOT NULL DEFAULT 'radius'");
// Whether the guard was inside the site fence at clock-in (NULL = no fence configured).
addColumn('guard_attendance', 'within_geofence', 'INTEGER');

db.exec(`
  -- Polygon geofence vertices, in drawing order
  CREATE TABLE IF NOT EXISTS site_geofence_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    point_order INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_site_geofence_points_site ON site_geofence_points(site_id);

  -- Guard leave requests (applied in the guard app, decided by admin/staff)
  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL DEFAULT 'casual' CHECK(leave_type IN ('casual','sick','earned','other')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
    reviewed_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leave_requests_guard ON leave_requests(guard_id);
  CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
`);

// Rebuild staff CHECK to permit the 'client' role on pre-existing databases.
// Uses user_version as a one-shot migration guard.
const USER_VERSION = db.pragma('user_version', { simple: true });
if (USER_VERSION < 1) {
  const staffCheck = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='staff'"
  ).get();
  if (staffCheck && staffCheck.sql && !staffCheck.sql.includes("'client'")) {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE staff_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
          site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          phone TEXT,
          role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff','client')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO staff_new (id, org_id, site_id, name, email, password, phone, role, created_at)
          SELECT id, org_id, site_id, name, email, password, phone, role, created_at FROM staff;
        DROP TABLE staff;
        ALTER TABLE staff_new RENAME TO staff;
        CREATE INDEX IF NOT EXISTS idx_staff_org_id ON staff(org_id);
      `);
    });
    rebuild();
  }
  db.pragma('user_version = 1');
}

// v2: allow the 'offsite' alert type on pre-existing databases (rebuild alerts CHECK).
if (db.pragma('user_version', { simple: true }) < 2) {
  const alertsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='alerts'").get();
  if (alertsSql && alertsSql.sql && !alertsSql.sql.includes("'offsite'")) {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE alerts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
          guard_id INTEGER REFERENCES guards(id) ON DELETE SET NULL,
          site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
          type TEXT NOT NULL CHECK(type IN ('sleep','shortage','sos','incident','overtime','face_fail','low_battery','offline','offsite')),
          severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
          message TEXT NOT NULL,
          meta TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acknowledged','resolved')),
          acknowledged_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
          acknowledged_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO alerts_new SELECT * FROM alerts;
        DROP TABLE alerts;
        ALTER TABLE alerts_new RENAME TO alerts;
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
      `);
    });
    rebuild();
  }
  db.pragma('user_version = 2');
}

module.exports = db;
