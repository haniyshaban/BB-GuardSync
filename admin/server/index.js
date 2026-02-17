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
require('./db');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n  ⬛ Black Belt - GuardSync API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
