const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

function daysFor(keys, hid = 'h1') {
  const days = {};
  for (const k of keys) days[k] = { [hid]: { done: true } };
  return days;
}

const stateOf = (cols, key) => {
  for (const col of cols) for (const c of col) if (c.key === key) return c.state;
  return null;
};

test('heatmapData returns weeks columns of 7 Monday-first cells', () => {
  const cols = DH.heatmapData({}, 'h1', undefined, '2026-10-24', 2);
  assert.equal(cols.length, 2);
  assert.ok(cols.every((c) => c.length === 7));
  assert.equal(cols[0][0].key, '2026-10-12'); // Monday
  assert.equal(cols[1][0].key, '2026-10-19'); // Monday
  assert.equal(cols[1][6].key, '2026-10-25'); // Sunday
});

test('heatmapData assigns done / frozen / missed states', () => {
  const days = daysFor(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23']);
  const cols = DH.heatmapData(days, 'h1', undefined, '2026-10-24', 2);
  assert.equal(stateOf(cols, '2026-10-19'), 'done');
  assert.equal(stateOf(cols, '2026-10-21'), 'done');
  assert.equal(stateOf(cols, '2026-10-22'), 'missed'); // second miss of the week
  assert.equal(stateOf(cols, '2026-10-24'), 'missed'); // third miss of the week
  assert.equal(stateOf(cols, '2026-10-25'), 'frozen'); // most recent miss, forgiven
});

test('heatmapData marks unscheduled days as off', () => {
  const wd = { type: 'weekdays', days: [1, 2, 3, 4, 5] };
  const cols = DH.heatmapData({}, 'h1', wd, '2026-10-24', 1);
  assert.equal(stateOf(cols, '2026-10-25'), 'off'); // Sunday
  assert.equal(stateOf(cols, '2026-10-19'), 'missed'); // Monday, scheduled
});

test('heatmapData marks future days', () => {
  const cols = DH.heatmapData({}, 'h1', undefined, '2099-06-15', 1);
  assert.ok(cols[0].every((c) => c.state === 'future'));
});

test('frozenDaysInRange forgives one miss per ISO week', () => {
  const days = daysFor(['2026-10-19', '2026-10-20']);
  const frozen = DH.frozenDaysInRange(days, 'h1', undefined, '2026-10-12', '2026-10-25');
  // Walking back: 10-25 frozen (W43), 10-24/23/22 used up, 10-18 frozen (W42)
  assert.ok(frozen['2026-10-25']);
  assert.ok(frozen['2026-10-18']);
  assert.ok(!frozen['2026-10-24']);
  assert.equal(Object.keys(frozen).length, 2);
});

test('frozenDaysInRange is empty for timesPerWeek', () => {
  const frozen = DH.frozenDaysInRange({}, 'h1', { type: 'timesPerWeek', times: 3 }, '2026-10-12', '2026-10-25');
  assert.deepEqual(frozen, {});
});
