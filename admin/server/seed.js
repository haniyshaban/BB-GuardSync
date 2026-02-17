// Black Belt - GuardSync Seed Data
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Ensure data dir
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = require('./db');

console.log('⬛ Seeding Black Belt - GuardSync database...\n');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// ============ SITES ============
const sites = [
  { name: 'Whitefield Tech Park', address: '100 ITPL Main Rd, Whitefield, Bangalore 560066', contactPerson: 'Ramesh Kumar', contactPhone: '9876543210' },
  { name: 'Koramangala Business Hub', address: '80 Feet Rd, Koramangala, Bangalore 560034', contactPerson: 'Suresh Nair', contactPhone: '9876543211' },
  { name: 'Electronic City Campus', address: 'Phase 1, Electronic City, Bangalore 560100', contactPerson: 'Priya Sharma', contactPhone: '9876543212' },
  { name: 'MG Road Office Complex', address: 'MG Road, Bangalore 560001', contactPerson: 'Ajay Singh', contactPhone: '9876543213' },
  { name: 'Jayanagar Residences', address: '4th Block, Jayanagar, Bangalore 560041', contactPerson: 'Kavitha Reddy', contactPhone: '9876543214' },
];

const insertSite = db.prepare(
  'INSERT OR IGNORE INTO sites (name, address, contact_person, contact_phone) VALUES (?, ?, ?, ?)'
);

const siteIds = [];
for (const site of sites) {
  const existing = db.prepare('SELECT id FROM sites WHERE name = ?').get(site.name);
  if (existing) {
    siteIds.push(existing.id);
  } else {
    const result = insertSite.run(site.name, site.address, site.contactPerson, site.contactPhone);
    siteIds.push(result.lastInsertRowid);
  }
}
console.log(`✓ Created ${sites.length} sites`);

// ============ SHIFTS ============
const shiftsPerSite = [
  { label: 'Day Shift', startTime: '06:00', endTime: '14:00', daysOfWeek: ['mon','tue','wed','thu','fri','sat'] },
  { label: 'Evening Shift', startTime: '14:00', endTime: '22:00', daysOfWeek: ['mon','tue','wed','thu','fri','sat'] },
  { label: 'Night Shift', startTime: '22:00', endTime: '06:00', daysOfWeek: ['mon','tue','wed','thu','fri','sat','sun'] },
];

const insertShift = db.prepare(
  'INSERT OR IGNORE INTO site_shifts (site_id, label, start_time, end_time, days_of_week) VALUES (?, ?, ?, ?, ?)'
);

let shiftCount = 0;
const allShiftIds = {};
for (const siteId of siteIds) {
  allShiftIds[siteId] = [];
  for (const shift of shiftsPerSite) {
    const existing = db.prepare('SELECT id FROM site_shifts WHERE site_id = ? AND label = ?').get(siteId, shift.label);
    if (existing) {
      allShiftIds[siteId].push(existing.id);
    } else {
      const result = insertShift.run(siteId, shift.label, shift.startTime, shift.endTime, JSON.stringify(shift.daysOfWeek));
      allShiftIds[siteId].push(result.lastInsertRowid);
      shiftCount++;
    }
  }
}
console.log(`✓ Created ${shiftCount} shifts`);

// ============ GUARDS ============
const guards = [
  { name: 'Rajesh Kumar', phone: '9100000001', email: 'rajesh.k@guard.bb', dailyRate: 750 },
  { name: 'Sunil Yadav', phone: '9100000002', email: 'sunil.y@guard.bb', dailyRate: 750 },
  { name: 'Vikram Singh', phone: '9100000003', email: 'vikram.s@guard.bb', dailyRate: 800 },
  { name: 'Amit Patel', phone: '9100000004', email: 'amit.p@guard.bb', dailyRate: 750 },
  { name: 'Deepak Sharma', phone: '9100000005', email: 'deepak.s@guard.bb', dailyRate: 800 },
  { name: 'Manoj Tiwari', phone: '9100000006', email: 'manoj.t@guard.bb', dailyRate: 750 },
  { name: 'Ravi Shankar', phone: '9100000007', email: 'ravi.sh@guard.bb', dailyRate: 800 },
  { name: 'Ganesh Reddy', phone: '9100000008', email: 'ganesh.r@guard.bb', dailyRate: 750 },
  { name: 'Kiran Naidu', phone: '9100000009', email: 'kiran.n@guard.bb', dailyRate: 750 },
  { name: 'Sanjay Mishra', phone: '9100000010', email: 'sanjay.m@guard.bb', dailyRate: 800 },
  { name: 'Prakash Joshi', phone: '9100000011', email: 'prakash.j@guard.bb', dailyRate: 750 },
  { name: 'Arun Gupta', phone: '9100000012', email: 'arun.g@guard.bb', dailyRate: 750 },
  { name: 'Balu Hegde', phone: '9100000013', email: 'balu.h@guard.bb', dailyRate: 800 },
  { name: 'Chandan Das', phone: '9100000014', email: 'chandan.d@guard.bb', dailyRate: 750 },
  { name: 'Dinesh Verma', phone: '9100000015', email: 'dinesh.v@guard.bb', dailyRate: 750 },
  // 5 pending enrollment guards
  { name: 'Naveen Raj', phone: '9100000016', email: 'naveen.r@guard.bb', dailyRate: 0, pending: true },
  { name: 'Mohan Lal', phone: '9100000017', email: 'mohan.l@guard.bb', dailyRate: 0, pending: true },
  { name: 'Gopal Krishna', phone: '9100000018', email: 'gopal.k@guard.bb', dailyRate: 0, pending: true },
];

const insertGuard = db.prepare(`
  INSERT OR IGNORE INTO guards (name, phone, email, password, employee_id, site_id, shift_id, approval_status, daily_rate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let guardCount = 0;
for (let i = 0; i < guards.length; i++) {
  const g = guards[i];
  const existing = db.prepare('SELECT id FROM guards WHERE phone = ?').get(g.phone);
  if (existing) continue;

  if (g.pending) {
    insertGuard.run(g.name, g.phone, g.email, hash('guard123'), null, null, null, 'pending', 0);
  } else {
    const siteIdx = i % siteIds.length;
    const siteId = siteIds[siteIdx];
    const shiftIdx = i % 3;
    const shiftId = allShiftIds[siteId][shiftIdx];
    const empId = `BB-G${String(i + 1).padStart(3, '0')}`;
    insertGuard.run(g.name, g.phone, g.email, hash('guard123'), empId, siteId, shiftId, 'active', g.dailyRate);
  }
  guardCount++;
}
console.log(`✓ Created ${guardCount} guards (password: guard123)`);

// ============ STAFF / ADMIN ============
const staffMembers = [
  { name: 'Admin User', email: 'admin@blackbelt.app', password: 'admin123', role: 'admin', phone: '9200000001', siteId: null },
  { name: 'Whitefield Site Manager', email: 'staff.whitefield@blackbelt.app', password: 'staff123', role: 'staff', phone: '9200000002', siteId: siteIds[0] },
  { name: 'Koramangala Site Manager', email: 'staff.koramangala@blackbelt.app', password: 'staff123', role: 'staff', phone: '9200000003', siteId: siteIds[1] },
  { name: 'Electronic City Site Manager', email: 'staff.ecity@blackbelt.app', password: 'staff123', role: 'staff', phone: '9200000004', siteId: siteIds[2] },
];

const insertStaff = db.prepare(
  'INSERT OR IGNORE INTO staff (name, email, password, phone, role, site_id) VALUES (?, ?, ?, ?, ?, ?)'
);

let staffCount = 0;
for (const s of staffMembers) {
  const existing = db.prepare('SELECT id FROM staff WHERE email = ?').get(s.email);
  if (!existing) {
    insertStaff.run(s.name, s.email, hash(s.password), s.phone, s.role, s.siteId);
    staffCount++;
  }
}
console.log(`✓ Created ${staffCount} staff members`);

// ============ SAMPLE ATTENDANCE ============
const activeGuards = db.prepare("SELECT id, site_id FROM guards WHERE approval_status = 'active'").all();
const insertAttendance = db.prepare(
  'INSERT INTO guard_attendance (guard_id, site_id, clock_in, clock_out, date, hours_worked) VALUES (?, ?, ?, ?, ?, ?)'
);

let attendanceCount = 0;
// Generate last 14 days of attendance
for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
  const date = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
  const dateStr = date.toISOString().split('T')[0];
  
  // 80% attendance rate
  for (const guard of activeGuards) {
    if (Math.random() > 0.8) continue; // 20% absent

    const shiftStart = new Date(date);
    const hourOffset = (guard.id % 3) * 8; // Distribute across shifts
    shiftStart.setHours(6 + hourOffset, 0, 0, 0);
    
    const shiftEnd = new Date(shiftStart);
    shiftEnd.setHours(shiftStart.getHours() + 8);

    const hours = 7.5 + Math.random() * 1; // 7.5 - 8.5 hours
    
    insertAttendance.run(
      guard.id, guard.site_id,
      shiftStart.toISOString(), shiftEnd.toISOString(),
      dateStr, Math.round(hours * 100) / 100
    );
    attendanceCount++;
  }
}
console.log(`✓ Created ${attendanceCount} attendance records (last 14 days)`);

console.log('\n⬛ Seed complete!');
console.log('  Admin login: admin@blackbelt.app / admin123');
console.log('  Staff login (Whitefield): staff.whitefield@blackbelt.app / staff123');
console.log('  Staff login (Koramangala): staff.koramangala@blackbelt.app / staff123');
console.log('  Staff login (Electronic City): staff.ecity@blackbelt.app / staff123');
console.log('  Guard login: any guard phone or email / guard123\n');
