// Application-level encryption for statutory PII (Aadhaar/PAN/EPF/bank numbers).
// AES-256-GCM. Ciphertext is stored as  enc:v1:<base64(iv | authTag | ciphertext)>.
// Plaintext (legacy) values are read back unchanged, so existing rows migrate lazily
// on their next write.
const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const IV_LEN = 12;   // GCM standard nonce length
const TAG_LEN = 16;

let cachedKey = null;

// Resolve a 32-byte key. Prefer an explicit PII_ENCRYPTION_KEY (hex-64 or base64);
// otherwise derive one deterministically from JWT_SECRET (which is enforced strong
// in production). Setting PII_ENCRYPTION_KEY explicitly is recommended so that
// rotating JWT_SECRET does not render stored PII undecryptable.
function getKey() {
  if (cachedKey) return cachedKey;
  const explicit = process.env.PII_ENCRYPTION_KEY;
  if (explicit) {
    let raw;
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) raw = Buffer.from(explicit, 'hex');
    else raw = Buffer.from(explicit, 'base64');
    if (raw.length !== 32) throw new Error('PII_ENCRYPTION_KEY must decode to exactly 32 bytes (hex-64 or base64).');
    cachedKey = raw;
  } else {
    const secret = process.env.JWT_SECRET || 'blackbelt-guardsync-secret-key-change-in-production';
    cachedKey = crypto.scryptSync(secret, 'bb-guardsync-pii-salt', 32);
  }
  return cachedKey;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// Encrypt a string. Empty/null pass through untouched. Already-encrypted values
// are returned as-is so repeated writes stay idempotent.
function encryptPII(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

// Decrypt a value. Legacy plaintext (no prefix) is returned unchanged.
function decryptPII(value) {
  if (!isEncrypted(value)) return value;
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key or tampered ciphertext
  }
}

// Mask to the last 4 characters, e.g. "••••3333". Decrypts first if needed.
function maskPII(value) {
  const plain = decryptPII(value);
  if (plain == null || plain === '') return plain;
  const s = String(plain).replace(/\s+/g, '');
  if (s.length <= 4) return '••' + s;
  return '••••' + s.slice(-4);
}

// Statutory fields on a guard row that hold sensitive numbers.
const GUARD_PII_FIELDS = ['aadhaar_number', 'pan_number', 'epf_number', 'bank_account'];

// Return a copy of a guard row with PII fields masked (default) or fully decrypted
// (reveal=true, for an explicit admin reveal action). Mutates nothing in place.
function viewGuardPII(guard, { reveal = false } = {}) {
  if (!guard) return guard;
  const out = { ...guard };
  for (const f of GUARD_PII_FIELDS) {
    if (out[f] != null && out[f] !== '') out[f] = reveal ? decryptPII(out[f]) : maskPII(out[f]);
  }
  return out;
}

module.exports = { encryptPII, decryptPII, maskPII, isEncrypted, viewGuardPII, GUARD_PII_FIELDS };
