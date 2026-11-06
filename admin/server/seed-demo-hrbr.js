// Customer demo data: Blackbelt HRBR Office (geofenced) + other geotagged sites,
// guards with login (clock-in) times and live GPS pings — including one guard who
// has stepped outside the HRBR geofence to demonstrate the "Off-site" feature.
//
// ensureDemo(): idempotent — creates/updates the sites, guards and today's attendance.
// refreshPings(): re-stamps each demo guard's GPS ping to "now" at its fixed location,
//                 so the Command Centre / Live Map keep showing them live between boots.
const db = require('./db');
const bcrypt = require('bcryptjs');

const PWD_HASH = bcrypt.hashSync('guard123', 10);
const DEMO_DOMAIN = '@demo.blackbelt.app';

// Sites with a geofence. Coordinates are real Bengaluru locations so OSM tiles match.
const SITES = [
  { key: 'hrbr', name: 'Blackbelt HRBR Office', address: '5th Main Rd, HRBR Layout, Bengaluru', lat: 13.01160, lng: 77.64100, radius: 150 },
  { key: 'indiranagar', name: 'Blackbelt Indiranagar Metro', address: '100 Feet Rd, Indiranagar, Bengaluru', lat: 12.97840, lng: 77.64080, radius: 150 },
  // Polygon fence: the mall's footprint rather than a circle.
  { key: 'koramangala', name: 'Blackbelt Koramangala Forum', address: 'Hosur Rd, Koramangala, Bengaluru', lat: 12.93480, lng: 77.61150, radius: 150,
    polygon: [[12.93585, 77.61040], [12.93590, 77.61235], [12.93470, 77.61280], [12.93365, 77.61190], [12.93380, 77.61045]] },
];

// Guards. dlat/dlng are small offsets (degrees) from the site centre.
// ~0.0009 deg ≈ 100 m. offsite guards sit well beyond the 150 m fence.
const GUARDS = [
  // HRBR — 6 on-site, 1 off-site (stepped out ~320 m north)
  { name: 'Rajesh Kumar',    site: 'hrbr', emp: 'HRBR-01', dlat: 0.0006, dlng: 0.0004, battery: 86, inHrs: 6,  offsite: false },
  { name: 'Suresh Nair',     site: 'hrbr', emp: 'HRBR-02', dlat: -0.0005, dlng: 0.0006, battery: 72, inHrs: 6,  offsite: false },
  { name: 'Mohammed Irfan',  site: 'hrbr', emp: 'HRBR-03', dlat: 0.0008, dlng: -0.0003, battery: 64, inHrs: 8,  offsite: false },
  { name: 'Anil Deshmukh',   site: 'hrbr', emp: 'HRBR-04', dlat: -0.0007, dlng: -0.0006, battery: 45, inHrs: 8,  offsite: false },
  { name: 'Prakash Reddy',   site: 'hrbr', emp: 'HRBR-05', dlat: 0.0003, dlng: 0.0009, battery: 91, inHrs: 2,  offsite: false },
  { name: 'Ganesh Pawar',    site: 'hrbr', emp: 'HRBR-06', dlat: -0.0004, dlng: 0.0002, battery: 30, inHrs: 2,  offsite: false },
  { name: 'Vijay Chauhan',   site: 'hrbr', emp: 'HRBR-07', dlat: 0.0029, dlng: 0.0000, battery: 58, inHrs: 4,  offsite: true, offsiteMins: 16 },
  // Indiranagar — 3 on-site
  { name: 'Ravi Shankar',    site: 'indiranagar', emp: 'IND-01', dlat: 0.0005, dlng: 0.0004, battery: 80, inHrs: 5, offsite: false },
  { name: 'Karthik Menon',   site: 'indiranagar', emp: 'IND-02', dlat: -0.0006, dlng: 0.0005, battery: 67, inHrs: 7, offsite: false },
  { name: 'Sandeep Jadhav',  site: 'indiranagar', emp: 'IND-03', dlat: 0.0007, dlng: -0.0004, battery: 22, inHrs: 7, offsite: false },
  // Koramangala — 3 on-site
  { name: 'Imran Shaikh',    site: 'koramangala', emp: 'KOR-01', dlat: 0.0004, dlng: 0.0006, battery: 77, inHrs: 6, offsite: false },
  { name: 'Naveen Gowda',    site: 'koramangala', emp: 'KOR-02', dlat: -0.0005, dlng: -0.0005, battery: 53, inHrs: 6, offsite: false },
  { name: 'Deepak Verma',    site: 'koramangala', emp: 'KOR-03', dlat: 0.0008, dlng: 0.0003, battery: 40, inHrs: 9, offsite: false },
];

function getOrgId() {
  let org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
  if (!org) {
    const r = db.prepare("INSERT INTO organizations (name, slug, invite_code, is_active) VALUES (?,?,?,1)")
      .run('Black Belt GuardSync', 'black-belt-guardsync', 'BBGS-DEMO');
    org = { id: r.lastInsertRowid };
  }
  return org.id;
}

function ensureSite(orgId, s) {
  let row = db.prepare('SELECT id FROM sites WHERE name = ?').get(s.name);
  const fenceType = s.polygon ? 'polygon' : 'radius';
  if (!row) {
    const r = db.prepare(`INSERT INTO sites (org_id, name, address, lat, lng, geofence_radius_m, geofence_enabled, geofence_type)
      VALUES (?,?,?,?,?,?,1,?)`).run(orgId, s.name, s.address, s.lat, s.lng, s.radius, fenceType);
    row = { id: r.lastInsertRowid };
  } else {
    db.prepare(`UPDATE sites SET address=?, lat=?, lng=?, geofence_radius_m=?, geofence_enabled=1, geofence_type=? WHERE id=?`)
      .run(s.address, s.lat, s.lng, s.radius, fenceType, row.id);
  }
  db.prepare('DELETE FROM site_geofence_points WHERE site_id = ?').run(row.id);
  if (s.polygon) {
    const ins = db.prepare('INSERT INTO site_geofence_points (site_id, lat, lng, point_order) VALUES (?,?,?,?)');
    s.polygon.forEach(([lat, lng], i) => ins.run(row.id, lat, lng, i));
  }
  // Ensure a day shift exists
  const shift = db.prepare('SELECT id FROM site_shifts WHERE site_id=? LIMIT 1').get(row.id);
  if (!shift) {
    db.prepare(`INSERT INTO site_shifts (site_id,label,start_time,end_time,days_of_week)
      VALUES (?,?,?,?,?)`).run(row.id, 'Day Shift', '06:00', '18:00', '["mon","tue","wed","thu","fri","sat","sun"]');
  }
  return db.prepare('SELECT id FROM site_shifts WHERE site_id=? LIMIT 1').get(row.id).id;
}

function ensureDemo() {
  const orgId = getOrgId();
  const siteIds = {};
  const shiftIds = {};
  for (const s of SITES) { shiftIds[s.key] = ensureSite(orgId, s); siteIds[s.key] = db.prepare('SELECT id FROM sites WHERE name=?').get(s.name).id; }

  const today = new Date().toISOString().split('T')[0];
  for (let i = 0; i < GUARDS.length; i++) {
    const g = GUARDS[i];
    const email = g.emp.toLowerCase() + DEMO_DOMAIN;
    const phone = '9' + String(900000001 + i); // unique per demo guard
    const siteId = siteIds[g.site];
    const shiftId = shiftIds[g.site];
    const clockIn = new Date(Date.now() - g.inHrs * 3600 * 1000).toISOString();

    let guard = db.prepare('SELECT id FROM guards WHERE email = ?').get(email);
    if (!guard) {
      const r = db.prepare(`INSERT INTO guards
        (name, phone, email, password, employee_id, site_id, shift_id, org_id, approval_status, clocked_in, clock_in_time, daily_rate)
        VALUES (?,?,?,?,?,?,?,?,'active',1,?,?)`)
        .run(g.name, phone, email, PWD_HASH, g.emp, siteId, shiftId, orgId, clockIn, 850);
      guard = { id: r.lastInsertRowid };
    } else {
      db.prepare(`UPDATE guards SET name=?, site_id=?, shift_id=?, approval_status='active', clocked_in=1, clock_in_time=? WHERE id=?`)
        .run(g.name, siteId, shiftId, clockIn, guard.id);
    }
    // offsite_since in SQLite datetime (UTC) format so the monitoring job parses it correctly.
    if (g.offsite) {
      db.prepare("UPDATE guards SET offsite_since = datetime('now', ?) WHERE id = ?").run(`-${g.offsiteMins || 16} minutes`, guard.id);
    } else {
      db.prepare('UPDATE guards SET offsite_since = NULL WHERE id = ?').run(guard.id);
    }

    // Today's attendance (login time) — one row per guard per day
    const att = db.prepare('SELECT id FROM guard_attendance WHERE guard_id=? AND date=?').get(guard.id, today);
    if (!att) {
      db.prepare('INSERT INTO guard_attendance (guard_id, site_id, clock_in, date, lat, lng) VALUES (?,?,?,?,?,?)')
        .run(guard.id, siteId, clockIn, today, SITES.find(s => s.key === g.site).lat, SITES.find(s => s.key === g.site).lng);
    }
  }

  // Clean slate for the customer demo: remove any generic/seed data so only the
  // three Blackbelt sites and their demo guards show. (Demo DB only — no real data.)
  db.exec("DELETE FROM guards WHERE email NOT LIKE '%@demo.blackbelt.app'");
  const names = SITES.map(s => s.name);
  db.prepare(`DELETE FROM sites WHERE name NOT IN (${names.map(() => '?').join(',')})`).run(...names);
  db.exec('DELETE FROM incidents');
  db.exec("DELETE FROM alerts WHERE type != 'offsite'");
  // Drop tasks that belonged to purged guards (orphans from the generic seed).
  db.exec('DELETE FROM tasks WHERE guard_id IS NULL OR guard_id NOT IN (SELECT id FROM guards)');

  // A couple of sample field tasks at HRBR so the Tasks page isn't empty.
  if (db.prepare('SELECT COUNT(*) c FROM tasks').get().c === 0) {
    const hrbrSite = db.prepare("SELECT id FROM sites WHERE name = 'Blackbelt HRBR Office'").get()?.id;
    const g1 = db.prepare("SELECT id FROM guards WHERE employee_id = 'HRBR-01'").get()?.id;
    const g2 = db.prepare("SELECT id FROM guards WHERE employee_id = 'HRBR-03'").get()?.id;
    const insT = db.prepare("INSERT INTO tasks (org_id, guard_id, site_id, title, description, priority, status) VALUES (?,?,?,?,?,?,?)");
    if (hrbrSite && g1) insT.run(orgId, g1, hrbrSite, 'Verify visitor register', 'Check the front-desk visitor log is up to date', 'normal', 'open');
    if (hrbrSite && g2) insT.run(orgId, g2, hrbrSite, 'Perimeter round', 'Walk the building perimeter and report issues', 'high', 'in_progress');
  }

  // Patrol checkpoints at HRBR (inside the fence).
  const hrbrId = siteIds.hrbr;
  if (hrbrId && !db.prepare('SELECT id FROM checkpoints WHERE site_id = ?').get(hrbrId)) {
    const insCp = db.prepare('INSERT INTO checkpoints (site_id, label, code, lat, lng, radius_meters, sort_order) VALUES (?,?,?,?,?,?,?)');
    [['Main gate', 0.00085, 0.0000], ['Parking', -0.0006, 0.0007], ['Rear exit', -0.0004, -0.0008]]
      .forEach(([label, dlat, dlng], i) => insCp.run(hrbrId, label, `HRBR-CP${i + 1}`, 13.01160 + dlat, 77.64100 + dlng, 30, i + 1));
  }

  // Sample leave requests: two pending (for the approval demo) and one approved.
  if (!db.prepare('SELECT id FROM leave_requests LIMIT 1').get()) {
    const day = n => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
    const gid = emp => db.prepare('SELECT id FROM guards WHERE employee_id = ?').get(emp)?.id;
    const insL = db.prepare('INSERT INTO leave_requests (guard_id, leave_type, start_date, end_date, reason, status, reviewed_at) VALUES (?,?,?,?,?,?,?)');
    if (gid('HRBR-02')) insL.run(gid('HRBR-02'), 'sick', day(1), day(2), 'Fever, doctor advised rest', 'pending', null);
    if (gid('KOR-03')) insL.run(gid('KOR-03'), 'earned', day(5), day(7), 'Family function in Mysuru', 'pending', null);
    if (gid('IND-02')) insL.run(gid('IND-02'), 'casual', day(3), day(3), 'Bank work', 'approved', new Date().toISOString());
  }

  return { siteIds };
}

// Re-stamp each demo guard's latest GPS ping to "now" at its fixed position so the
// live views keep showing them (and the off-site guard stays outside the fence).
function refreshPings() {
  const ins = db.prepare('INSERT INTO guard_locations (guard_id, lat, lng, accuracy, battery, timestamp) VALUES (?,?,?,?,?,datetime(\'now\'))');
  const tx = db.transaction(() => {
    for (const g of GUARDS) {
      const email = g.emp.toLowerCase() + DEMO_DOMAIN;
      const guard = db.prepare('SELECT id FROM guards WHERE email = ?').get(email);
      if (!guard) continue;
      const site = SITES.find(s => s.key === g.site);
      // keep only the last few pings per demo guard to avoid unbounded growth
      db.prepare(`DELETE FROM guard_locations WHERE guard_id=? AND id NOT IN
        (SELECT id FROM guard_locations WHERE guard_id=? ORDER BY timestamp DESC LIMIT 3)`).run(guard.id, guard.id);
      ins.run(guard.id, site.lat + g.dlat, site.lng + g.dlng, 8, g.battery);
      if (g.offsite && !db.prepare('SELECT offsite_since FROM guards WHERE id=?').get(guard.id).offsite_since) {
        db.prepare("UPDATE guards SET offsite_since = datetime('now', ?) WHERE id=?").run(`-${g.offsiteMins || 16} minutes`, guard.id);
      }
    }
  });
  tx();
}

module.exports = { ensureDemo, refreshPings };

// Allow running directly: node seed-demo-hrbr.js
if (require.main === module) {
  ensureDemo();
  refreshPings();
  console.log('✓ HRBR demo data seeded (sites, guards, attendance, live pings).');
}
