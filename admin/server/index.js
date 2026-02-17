// Black Belt - GuardSync Server Entry Point
const app = require('./app');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database (creates tables via import)
const db = require('./db');

// Auto-create default admin if none exists
function seedDefaultAdmin() {
  try {
    const bcrypt = require('bcryptjs');
    const existing = db.prepare('SELECT id FROM staff WHERE role = ?').get('admin');
    if (!existing) {
      const email = process.env.ADMIN_EMAIL || 'admin@blackbelt.app';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(
        'INSERT OR IGNORE INTO staff (name, email, password, phone, role, site_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('Admin User', email, hash, '0000000000', 'admin', null);
      console.log(`  ✓ Default admin created: ${email}`);
    }
  } catch (err) {
    console.error('Auto-seed error:', err.message);
  }
}

seedDefaultAdmin();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n  ⬛ Black Belt - GuardSync API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

