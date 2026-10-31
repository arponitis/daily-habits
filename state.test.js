const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

test('migrateState upgrades v0 state to v1', () => {
  const v0 = {
    habits: [{ id: 'a', name: 'Read', icon: '📖', createdAt: 1 }],
    days: { '2026-10-30': { a: { note: 'ch 4' } } }, // done missing (older builds)
  };
  const s = DH.migrateState(v0);
  assert.equal(s.v, 1);
  assert.equal(s.habits[0].archived, false);
  assert.equal(s.days['2026-10-30'].a.done, false);
  assert.equal(s.days['2026-10-30'].a.note, 'ch 4');
});

test('migrateState leaves v1 state alone', () => {
  const v1 = { v: 1, habits: [], days: {} };
  const s = DH.migrateState(v1);
  assert.equal(s.v, 1);
  assert.deepEqual(s, v1);
});

test('migrateState refuses newer versions instead of overwriting', () => {
  assert.throws(
    () => DH.migrateState({ v: 99, habits: [], days: {} }),
    /newer than supported/
  );
});

test('migrateState repairs malformed payloads', () => {
  const s = DH.migrateState(null);
  assert.equal(s.v, 1);
  assert.deepEqual(s.habits, []);
  assert.deepEqual(s.days, {});
});

test('validateImport accepts a good export', () => {
  const good = {
    v: 1,
    habits: [{ id: 'a', name: 'Read', icon: '📖', createdAt: 1, archived: false }],
    days: { '2026-10-30': { a: { done: true, note: 'ch 4' } } },
  };
  const r = DH.validateImport(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('validateImport accepts exports without a version stamp', () => {
  const r = DH.validateImport({ habits: [], days: {} });
  assert.equal(r.ok, true);
});

test('validateImport rejects bad shapes with messages', () => {
  const badCases = [
    null,
    42,
    'x',
    {},
    { habits: 'nope', days: {} },
    { habits: [], days: { 'not-a-date': {} } },
    { habits: [{ id: 1, name: '' }], days: {} },
    { habits: [], days: { '2026-10-30': { a: { done: 'yes' } } } },
    { habits: [], days: { '2026-10-30': { a: { done: true, note: 5 } } } },
  ];
  for (const bad of badCases) {
    const r = DH.validateImport(bad);
    assert.equal(r.ok, false, 'expected invalid: ' + JSON.stringify(bad));
    assert.ok(r.errors.length > 0, 'expected error messages');
  }
});
