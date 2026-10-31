const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

test('dayKey/parseKey round-trip', () => {
  for (const k of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
    assert.equal(DH.dayKey(DH.parseKey(k)), k);
  }
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(DH.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(DH.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(DH.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(DH.addDays('2024-02-28', 1), '2024-02-29'); // leap year
  assert.equal(DH.addDays('2026-10-30', -30), '2026-09-30');
});

test('addDays is DST-safe (suite runs with TZ=America/New_York)', () => {
  // 2026-03-08 is the US spring-forward Sunday (23-hour day);
  // 2026-11-01 is fall-back (25-hour day).
  assert.equal(DH.addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(DH.addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(DH.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(DH.addDays('2026-11-01', 1), '2026-11-02');
});

test('todayKey returns local today in YYYY-MM-DD', () => {
  assert.match(DH.todayKey(), /^\d{4}-\d{2}-\d{2}$/);
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(DH.todayKey(), expected);
});
