const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

function daysFor(keys, hid = 'h1') {
  const days = {};
  for (const k of keys) days[k] = { [hid]: { done: true } };
  return days;
}

// Mon 2026-10-05 … Sun 2026-11-01 is a 28-day window ending on a Sunday.
test('weekdayCompletion finds the best weekday', () => {
  const days = daysFor([
    '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', // Mondays: 4/4
    '2026-10-07', '2026-10-21', // Wednesdays: 2/4
  ]);
  const h = { id: 'h1', schedule: { type: 'daily' } };
  const wc = DH.weekdayCompletion(days, [h], '2026-10-05', '2026-11-01');
  assert.equal(wc[1].rate, 1); // Monday
  assert.equal(wc[3].rate, 0.5); // Wednesday
  assert.equal(wc[6].rate, 0); // Saturday
});

test('insights picks the most consistent habit', () => {
  const days = {};
  for (let d = 5; d <= 28; d++) { // Oct 5–28: h1 done every day, h2 every 4th
    const k = '2026-10-' + String(d).padStart(2, '0');
    days[k] = { h1: { done: true } };
    if (d % 4 === 0) days[k].h2 = { done: true };
  }
  const habits = [
    { id: 'h1', name: 'Read', icon: '📖', schedule: { type: 'daily' } },
    { id: 'h2', name: 'Run', icon: '🏃', schedule: { type: 'daily' } },
  ];
  const ins = DH.insights(days, habits, '2026-11-01');
  assert.equal(ins.mostConsistent.id, 'h1');
  assert.ok(ins.mostConsistent.rate > 0.8);
});

test('insights compares this week with last week', () => {
  const days = daysFor([
    '2026-10-26', '2026-10-27', '2026-10-28', // this week (W44): 3
    '2026-10-19', // last week (W43): 1
  ]);
  const habits = [{ id: 'h1', name: 'Read', icon: '📖', schedule: { type: 'daily' } }];
  const ins = DH.insights(days, habits, '2026-10-30');
  assert.equal(ins.thisWeek.done, 3);
  assert.equal(ins.lastWeek.done, 1);
  assert.equal(ins.thisWeek.total, 7);
});

test('insights reports the longest active streak', () => {
  const days = daysFor(['2026-10-28', '2026-10-29', '2026-10-30']);
  const habits = [{ id: 'h1', name: 'Read', icon: '📖', schedule: { type: 'daily' } }];
  const ins = DH.insights(days, habits, '2026-10-30');
  assert.equal(ins.longestActiveStreak.n, 3);
  assert.equal(ins.longestActiveStreak.name, 'Read');
});

test('insights handles empty data gracefully', () => {
  const ins = DH.insights({}, [], '2026-10-30');
  assert.equal(ins.bestWeekday, null);
  assert.equal(ins.mostConsistent, null);
  assert.equal(ins.longestActiveStreak, null);
  assert.deepEqual(ins.thisWeek, { done: 0, total: 0 });
});

test('scheduledDaysInRange and doneInRange count correctly', () => {
  const days = daysFor(['2026-10-26', '2026-10-28']); // Mon, Wed
  const sched = { type: 'weekdays', days: [1, 2, 3, 4, 5] };
  assert.equal(DH.scheduledDaysInRange(sched, '2026-10-26', '2026-11-01'), 5);
  assert.equal(DH.doneInRange(days, 'h1', '2026-10-26', '2026-11-01'), 2);
});
