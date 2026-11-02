const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

test('weeklyRates returns one entry per week, oldest first', () => {
  const days = { '2026-10-26': { h1: { done: true } } };
  const r = DH.weeklyRates(days, 'h1', { type: 'daily' }, '2026-10-31', 3);
  assert.equal(r.length, 3);
  assert.ok(r[0].weekStart < r[1].weekStart && r[1].weekStart < r[2].weekStart);
  r.forEach((w) => {
    assert.ok(w.done <= w.scheduled);
    assert.ok(w.rate === null || (w.rate >= 0 && w.rate <= 1));
  });
});

test('weeklyRates rate is null when the week is entirely in the future', () => {
  const r = DH.weeklyRates({}, 'h1', { type: 'daily' }, '2026-12-31', 1);
  assert.equal(r.length, 1);
  assert.equal(r[0].scheduled, 0);
  assert.equal(r[0].rate, null);
});

test('weeklyRates counts a grace-frozen day as done', () => {
  // Monday-only habit, Monday missed -> frozen by the weekly grace day
  const r = DH.weeklyRates({}, 'h1', { type: 'weekdays', days: [1] }, '2026-10-31', 1);
  assert.equal(r[0].scheduled, 1);
  assert.equal(r[0].done, 1);
  assert.equal(r[0].rate, 1);
});

test('weeklyRates counts done days', () => {
  const days = {
    '2026-10-26': { h1: { done: true } },
    '2026-10-27': { h1: { done: true } },
  };
  const r = DH.weeklyRates(days, 'h1', { type: 'daily' }, '2026-10-28', 1);
  assert.ok(r[0].done >= 2);
});

test('bestWeekday picks the strongest weekday with enough data', () => {
  const days = {};
  ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].forEach((k) => { days[k] = { h1: { done: true } }; });
  const b = DH.bestWeekday(days, 'h1', { type: 'weekdays', days: [1, 2, 3, 4, 5] }, '2026-10-31', 4);
  assert.deepEqual(b, { weekday: 1, rate: 1, n: 4 });
});

test('bestWeekday returns null without enough data', () => {
  assert.equal(DH.bestWeekday({}, 'h1', { type: 'daily' }, '2026-10-31', 12), null);
  const b2 = DH.bestWeekday({ '2026-10-26': { h1: { done: true } } }, 'h1', { type: 'daily' }, '2026-10-31', 1);
  assert.equal(b2, null); // only 1 scheduled Monday
});

test('bestWeekday ignores grace-frozen days', () => {
  // No real check-ins: freezes alone must not produce a "best day"
  assert.equal(DH.bestWeekday({}, 'h1', { type: 'daily' }, '2026-10-31', 12), null);
});
