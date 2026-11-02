/* Daily Habits sync protocol — pure helpers shared by the worker and tests.
 *
 * The server is dumb by design: it stores one encrypted blob per sync code
 * and answers last-writer-wins at the blob level. All merging happens on
 * the client (see DH.mergeStates), which is union-based and self-healing,
 * so no data is ever lost to a race. The server never sees plaintext.
 *
 * The sync code is a random identifier the user copies from one device to
 * the other (shown in the app's Sync card). It is NOT derived from the
 * passphrase: that way a mistyped passphrase fails loudly at decrypt time
 * instead of silently forking into an empty sync space.
 */

export var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
export var CODE_LENGTH = 16;

export function kvKey(code) {
  return 'sync:' + code;
}

export function isValidCode(code) {
  return typeof code === 'string' && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8,32}$/.test(code);
}

/** Normalize user-typed codes: uppercase, drop spaces/dashes. */
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[\s-]/g, '');
}

/** Validate a PUT /sync body. Returns an error string or null. */
export function validatePushBody(b) {
  if (!b || typeof b !== 'object') return 'bad body';
  if (!isValidCode(b.id)) return 'bad id';
  if (!b.blob || typeof b.blob !== 'object') return 'bad blob';
  if (b.blob.app !== 'daily-habits' || !b.blob.salt || !b.blob.iv || !b.blob.data) return 'bad blob';
  if (typeof b.updatedAt !== 'number' || !(b.updatedAt > 0)) return 'bad updatedAt';
  if (typeof b.deviceId !== 'string' || !b.deviceId || b.deviceId.length > 64) return 'bad deviceId';
  return null;
}

/** Should an incoming record replace the stored one? Newer updatedAt wins. */
export function shouldStore(existing, incoming) {
  if (!existing) return true;
  return incoming.updatedAt > existing.updatedAt;
}
