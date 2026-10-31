const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const DH = require('../lib.js');

test('encrypted backup round-trips', async () => {
  const payload = await DH.encryptBackup(webcrypto, '{"v":2,"habits":[]}', 's3cret-password');
  assert.equal(payload.app, 'daily-habits');
  assert.ok(payload.salt && payload.iv && payload.data);
  const back = await DH.decryptBackup(webcrypto, payload, 's3cret-password');
  assert.equal(back, '{"v":2,"habits":[]}');
});

test('wrong password fails cleanly', async () => {
  const payload = await DH.encryptBackup(webcrypto, 'hello', 'right-password');
  await assert.rejects(() => DH.decryptBackup(webcrypto, payload, 'wrong-password'));
});

test('foreign payload is rejected without touching crypto', async () => {
  await assert.rejects(() => DH.decryptBackup(webcrypto, { nope: true }, 'x'));
});

test('base64 helpers round-trip binary data', () => {
  const bytes = new Uint8Array([0, 1, 250, 255, 16, 32]);
  const back = DH.b64decode(DH.b64encode(bytes));
  assert.deepEqual(Array.from(back), Array.from(bytes));
});
