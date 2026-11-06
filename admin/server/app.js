// Black Belt - GuardSync Express App
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Behind Railway's (or any single) reverse proxy, trust exactly one hop so
// express-rate-limit keys on the real client IP from X-Forwarded-For instead
// of erroring (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR). One hop only — not `true` —
// so clients can't spoof X-Forwarded-For to dodge rate limits.
app.set('trust proxy', 1);

// Security & parsing
app.use(helmet());

// CORS: restrict to known origins via ALLOWED_ORIGINS env var (comma-separated).
// Falls back to dev + known production origins if the env var is not set.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'capacitor://localhost',
      'https://localhost',
      'https://bb-guard-sync.vercel.app',
      'https://bb-guard-sync-admin.vercel.app',
      'https://bb-guard-sync-orcin.vercel.app',
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Capacitor WebView, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Confine the read-only 'client' role to its own endpoints. A client token is
// still a valid JWT, so without this it could read global admin/staff routes.
const { verifyToken } = require('./auth');
const CLIENT_ALLOWED_PREFIXES = ['/api/client', '/api/staff/login', '/api/staff/me', '/api/staff/change-password', '/api/health'];
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (decoded.role === 'client' && !CLIENT_ALLOWED_PREFIXES.some(p => req.path.startsWith(p))) {
      return res.status(403).json({ success: false, error: 'Client accounts have read-only access to their assigned sites only' });
    }
  } catch {
    // Invalid token — let the route's own authMiddleware produce the 401.
  }
  next();
});

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
// Raksham modules
app.use('/api/overtime', require('./routes/overtime.routes'));
app.use('/api/assets', require('./routes/assets.routes'));
app.use('/api/documents', require('./routes/documents.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/incidents', require('./routes/incidents.routes'));
app.use('/api/alerts', require('./routes/alerts.routes'));
app.use('/api/patrol', require('./routes/patrol.routes'));
app.use('/api/command', require('./routes/command.routes'));
app.use('/api/client', require('./routes/client.routes'));

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
