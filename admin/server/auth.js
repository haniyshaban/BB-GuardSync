// Black Belt - GuardSync JWT Authentication
const jwt = require('jsonwebtoken');

const DEFAULT_SECRET = 'blackbelt-guardsync-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = '7d';
const IS_PROD = process.env.NODE_ENV === 'production';

// In production a missing or default secret makes every token forgeable, so fail fast.
const usingInsecureSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET;
const secretTooShort = JWT_SECRET.length < 32;
if (IS_PROD && (usingInsecureSecret || secretTooShort)) {
  console.error('\n  ❌ FATAL: JWT_SECRET must be set to a unique random string of at least 32 characters in production.');
  console.error('     Refusing to start with a missing, default, or weak signing secret.\n');
  process.exit(1);
}
if (usingInsecureSecret) {
  console.warn('\n  ⚠️  WARNING: JWT_SECRET env var is not set. Using insecure default secret (development only).');
  console.warn('     Set JWT_SECRET to a long random string before deploying.\n');
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: require valid JWT
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { generateToken, verifyToken, authMiddleware, requireRole, JWT_SECRET };
