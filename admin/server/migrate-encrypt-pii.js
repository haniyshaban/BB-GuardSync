// One-time migration: encrypt existing plaintext statutory PII in place.
// Idempotent — rows already encrypted (enc:v1:) are skipped. Safe to re-run.
// Usage: node migrate-encrypt-pii.js   (set PII_ENCRYPTION_KEY / JWT_SECRET as in prod)
const db = require('./db');
const { encryptPII, isEncrypted, GUARD_PII_FIELDS } = require('./lib/crypto');

let guardUpdates = 0;
const guards = db.prepare('SELECT id, ' + GUARD_PII_FIELDS.join(', ') + ' FROM guards').all();
const setClause = GUARD_PII_FIELDS.map(f => `${f} = ?`).join(', ');
const updateGuard = db.prepare(`UPDATE guards SET ${setClause} WHERE id = ?`);

const tx = db.transaction(() => {
  for (const g of guards) {
    let changed = false;
    const vals = GUARD_PII_FIELDS.map(f => {
      const v = g[f];
      if (v != null && v !== '' && !isEncrypted(v)) { changed = true; return encryptPII(v); }
      return v;
    });
    if (changed) { updateGuard.run(...vals, g.id); guardUpdates++; }
  }

  let docUpdates = 0;
  const docs = db.prepare('SELECT id, doc_number FROM guard_documents WHERE doc_number IS NOT NULL').all();
  const updateDoc = db.prepare('UPDATE guard_documents SET doc_number = ? WHERE id = ?');
  for (const d of docs) {
    if (d.doc_number && !isEncrypted(d.doc_number)) { updateDoc.run(encryptPII(d.doc_number), d.id); docUpdates++; }
  }
  return docUpdates;
});

const docUpdates = tx();
console.log(`✓ PII migration complete — encrypted ${guardUpdates} guard row(s), ${docUpdates} document(s).`);
