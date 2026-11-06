// Customer demo data: Blackbelt HRBR Office (geofenced) + other geotagged sites,
// guards with login (clock-in) times and live GPS pings — including one guard who
// has stepped outside the HRBR geofence to demonstrate the "Off-site" feature.
//
// ensureDemo(): idempotent — creates/updates the sites, guards and today's attendance.
// refreshPings(): re-stamps each demo guard's GPS ping to "now", placed against the site's
//                 current geofence (all inside except the designated out-of-location guard).
const db = require('./db');
const bcrypt = require('bcryptjs');
const { haversine, pointInPolygon, polygonPoints, checkFence } = require('./lib/geo');

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
  // Location and geofence are only set when the demo first creates the site.
  // After that they belong to the admin (Manage Site), so they are never overwritten.
  if (!row) {
    const fenceType = s.polygon ? 'polygon' : 'radius';
    const r = db.prepare(`INSERT INTO sites (org_id, name, address, lat, lng, geofence_radius_m, geofence_enabled, geofence_type)
      VALUES (?,?,?,?,?,?,1,?)`).run(orgId, s.name, s.address, s.lat, s.lng, s.radius, fenceType);
    row = { id: r.lastInsertRowid };
    if (s.polygon) {
      const ins = db.prepare('INSERT INTO site_geofence_points (site_id, lat, lng, point_order) VALUES (?,?,?,?)');
      s.polygon.forEach(([lat, lng], i) => ins.run(row.id, lat, lng, i));
    }
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

// ---------- Placing demo guards relative to each site's *current* geofence ----------

const M_PER_DEG = 111320;

// Small deterministic PRNG so positions are stable between refreshes.
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function siteFence(name) {
  const site = db.prepare('SELECT * FROM sites WHERE name = ?').get(name);
  if (!site) return null;
  const polygon = polygonPoints(site.id);
  return { site, polygon };
}

/**
 * Positions for a site's demo guards: `nInside` spread inside the fence and
 * `nOutside` placed beyond it. Works for radius and polygon fences.
 */
function placements(fence, fallback, nInside, nOutside, seed) {
  const { site, polygon } = fence;
  const usePolygon = site.geofence_type === 'polygon' && polygon.length >= 3;
  const inside = [], outside = [];

  if (usePolygon) {
    const lats = polygon.map(p => p.lat), lngs = polygon.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
    const rand = rng(seed);
    const minGap = 12; // metres between guards so markers don't stack
    for (let tries = 0; tries < 4000 && inside.length < nInside; tries++) {
      const lat = cLat + (rand() - 0.5) * (maxLat - minLat) * 0.8;
      const lng = cLng + (rand() - 0.5) * (maxLng - minLng) * 0.8;
      if (!pointInPolygon(lat, lng, polygon)) continue;
      if (inside.some(q => haversine(lat, lng, q.lat, q.lng) < minGap)) continue;
      inside.push({ lat, lng });
    }
    // If the area is tiny or oddly shaped, fall back to polygon vertices nudged inward.
    for (let i = 0; inside.length < nInside; i++) {
      const v = polygon[i % polygon.length];
      inside.push({ lat: v.lat + (cLat - v.lat) * 0.3, lng: v.lng + (cLng - v.lng) * 0.3 });
    }
    for (let i = 0; i < nOutside; i++) {
      outside.push({ lat: maxLat + (170 + i * 40) / M_PER_DEG, lng: cLng });
    }
  } else {
    const cLat = site.lat ?? fallback.lat, cLng = site.lng ?? fallback.lng;
    const r = site.geofence_radius_m || 150;
    const lngScale = M_PER_DEG * Math.cos((cLat * Math.PI) / 180);
    for (let i = 0; i < nInside; i++) {
      const ang = (i / Math.max(nInside, 1)) * 2 * Math.PI + 0.4;
      const d = r * (0.3 + 0.35 * ((i % 3) / 2)); // 30–65% of the radius
      inside.push({ lat: cLat + (d * Math.cos(ang)) / M_PER_DEG, lng: cLng + (d * Math.sin(ang)) / lngScale });
    }
    for (let i = 0; i < nOutside; i++) {
      outside.push({ lat: cLat + (r + 170 + i * 40) / M_PER_DEG, lng: cLng });
    }
  }
  return { inside, outside };
}

// Current target position for every demo guard, keyed by employee id.
function demoPositions() {
  const out = {};
  SITES.forEach((s, si) => {
    const fence = siteFence(s.name);
    if (!fence) return;
    const gs = GUARDS.filter(g => g.site === s.key);
    const pos = placements(fence, { lat: s.lat, lng: s.lng }, gs.filter(g => !g.offsite).length, gs.filter(g => g.offsite).length, 7919 * (si + 1));
    let a = 0, b = 0;
    for (const g of gs) out[g.emp] = g.offsite ? pos.outside[b++] : pos.inside[a++];
  });
  return out;
}

// Re-stamp each demo guard's GPS ping to "now", positioned against the site's
// current geofence, so the live views stay populated and follow fence edits.
function refreshPings() {
  const positions = demoPositions();
  const ins = db.prepare('INSERT INTO guard_locations (guard_id, lat, lng, accuracy, battery, timestamp) VALUES (?,?,?,?,?,datetime(\'now\'))');
  const tx = db.transaction(() => {
    for (const g of GUARDS) {
      const guard = db.prepare('SELECT id FROM guards WHERE email = ?').get(g.emp.toLowerCase() + DEMO_DOMAIN);
      const pos = positions[g.emp];
      if (!guard || !pos) continue;
      // keep only the last few pings per demo guard to avoid unbounded growth
      db.prepare(`DELETE FROM guard_locations WHERE guard_id=? AND id NOT IN
        (SELECT id FROM guard_locations WHERE guard_id=? ORDER BY timestamp DESC LIMIT 3)`).run(guard.id, guard.id);
      ins.run(guard.id, pos.lat, pos.lng, 8, g.battery);
      if (g.offsite) {
        if (!db.prepare('SELECT offsite_since FROM guards WHERE id=?').get(guard.id).offsite_since) {
          db.prepare("UPDATE guards SET offsite_since = datetime('now', ?) WHERE id=?").run(`-${g.offsiteMins || 16} minutes`, guard.id);
        }
      } else {
        db.prepare('UPDATE guards SET offsite_since = NULL WHERE id = ?').run(guard.id);
      }
    }
  });
  tx();
}

// One-line summary per site, logged at boot, to confirm placement against the live fence.
function describePlacement() {
  const positions = demoPositions();
  return SITES.map(s => {
    const fence = siteFence(s.name);
    if (!fence) return `${s.name}: missing`;
    const gs = GUARDS.filter(g => g.site === s.key && positions[g.emp]);
    const res = gs.map(g => ({ g, f: checkFence(fence.site, positions[g.emp].lat, positions[g.emp].lng, fence.polygon) }));
    const shape = fence.site.geofence_type === 'polygon' ? `polygon ${fence.polygon.length} pts` : `radius ${fence.site.geofence_radius_m} m`;
    const outs = res.filter(r => !r.f.inside).map(r => `${r.g.name} ${r.f.distance} m`).join(', ');
    return `${s.name} [${shape}${fence.site.geofence_enabled ? '' : ', disabled'}]: ${res.filter(r => r.f.inside).length} inside, ${res.filter(r => !r.f.inside).length} outside${outs ? ' (' + outs + ')' : ''}`;
  }).join(' | ');
}

module.exports = { ensureDemo, refreshPings, describePlacement, demoPositions };

// Allow running directly: node seed-demo-hrbr.js
if (require.main === module) {
  ensureDemo();
  refreshPings();
  console.log('✓ HRBR demo data seeded (sites, guards, attendance, live pings).');
}
