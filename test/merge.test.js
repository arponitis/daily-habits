const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

test('merge unions habits by id (current device wins)', () => {
  const base = { v: 2, habits: [{ id: 'a', name: 'Read' }], days: {} };
  const inc = { v: 2, habits: [{ id: 'a', name: 'Read!' }, { id: 'b', name: 'Run' }], days: {} };
  const m = DH.mergeStates(base, inc);
  assert.equal(m.habits.length, 2);
  assert.equal(m.habits[0].name, 'Read');
  assert.equal(m.habits[1].name, 'Run');
});

test('merge unions day entries with done OR-wins', () => {
  const base = { v: 2, habits: [], days: { '2026-10-30': { a: { done: true } } } };
  const inc = {
    v: 2, habits: [],
    days: {
      '2026-10-30': { a: { note: 'ch 5' }, b: { done: true } },
      '2026-10-29': { b: { done: true } },
    },
  };
  const m = DH.mergeStates(base, inc);
  assert.equal(m.days['2026-10-30'].a.done, true);
  assert.equal(m.days['2026-10-30'].a.note, 'ch 5');
  assert.equal(m.days['2026-10-30'].b.done, true);
  assert.equal(m.days['2026-10-29'].b.done, true);
});

test('note conflict keeps the current device note', () => {
  const base = { v: 2, habits: [], days: { '2026-10-30': { a: { done: true, note: 'mine' } } } };
  const inc = { v: 2, habits: [], days: { '2026-10-30': { a: { done: true, note: 'theirs' } } } };
  const m = DH.mergeStates(base, inc);
  assert.equal(m.days['2026-10-30'].a.note, 'mine');
});

test('merge does not mutate its inputs', () => {
  const base = { v: 2, habits: [{ id: 'a', name: 'Read' }], days: {} };
  const inc = { v: 2, habits: [{ id: 'b', name: 'Run' }], days: { '2026-10-30': { b: { done: true } } } };
  const snapshot = JSON.stringify([base, inc]);
  DH.mergeStates(base, inc);
  assert.equal(JSON.stringify([base, inc]), snapshot);
});

test('merge handles empty/missing sections', () => {
  const m = DH.mergeStates(null, {});
  assert.deepEqual(m.habits, []);
  assert.deepEqual(m.days, {});
  assert.equal(m.v, DH.CURRENT_SCHEMA_VERSION);
});
