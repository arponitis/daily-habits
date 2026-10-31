const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

function daysFor(keys, hid = 'h1') {
  const days = {};
  for (const k of keys) days[k] = { [hid]: { done: true } };
  return days;
}

test('currentStreak counts back from today when today is done', () => {
  const days = daysFor(['2026-10-28', '2026-10-29', '2026-10-30']);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-30'), 3);
});

test('currentStreak stays alive when today is not done yet', () => {
  const days = daysFor(['2026-10-28', '2026-10-29']);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-30'), 2);
});

test('currentStreak is 0 with no recent activity', () => {
  assert.equal(DH.currentStreak(daysFor(['2026-10-20']), 'h1', '2026-10-30'), 0);
  assert.equal(DH.currentStreak({}, 'h1', '2026-10-30'), 0);
});

test('currentStreak stops at a gap', () => {
  const days = daysFor(['2026-10-25', '2026-10-29', '2026-10-30']);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-30'), 2);
});

test('bestStreak finds the longest run', () => {
  const days = daysFor(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']);
  assert.equal(DH.bestStreak(days, 'h1'), 3);
});

test('bestStreak survives DST transitions (regression)', () => {
  // A fixed 86400000ms day comparison breaks on these transitions.
  const spring = daysFor(['2026-03-07', '2026-03-08', '2026-03-09']);
  assert.equal(DH.bestStreak(spring, 'h1'), 3);
  const fall = daysFor(['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.equal(DH.bestStreak(fall, 'h1'), 3);
});

test('bestStreak ignores other habits and unchecked days', () => {
  const days = {
    '2026-10-01': { h1: { done: true }, h2: { done: true } },
    '2026-10-02': { h1: { done: false }, h2: { done: true } },
    '2026-10-03': { h1: { done: true } },
  };
  assert.equal(DH.bestStreak(days, 'h1'), 1);
  assert.equal(DH.bestStreak(days, 'h2'), 2);
});

test('bestStreak of empty history is 0', () => {
  assert.equal(DH.bestStreak({}, 'h1'), 0);
});

test('totalDone counts done days only', () => {
  const days = {
    '2026-10-01': { h1: { done: true } },
    '2026-10-02': { h1: { done: false } },
    '2026-10-03': { h1: { done: true, note: 'x' } },
  };
  assert.equal(DH.totalDone(days, 'h1'), 2);
  assert.equal(DH.totalDone(days, 'nope'), 0);
});
