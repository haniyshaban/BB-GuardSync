// Black Belt - GuardSync Express App
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: true, // allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/org', require('./routes/org.routes'));
app.use('/api/guards', require('./routes/guards.routes'));
app.use('/api/sites', require('./routes/sites.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/locations', require('./routes/locations.routes'));
app.use('/api/face-checks', require('./routes/face-checks.routes'));
app.use('/api/payroll', require('./routes/payroll.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/stats', require('./routes/stats.routes'));
app.use('/api/config', require('./routes/config.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Black Belt - GuardSync API is running', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
