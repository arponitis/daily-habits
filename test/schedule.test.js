const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

const WEEKDAYS = { type: 'weekdays', days: [1, 2, 3, 4, 5] }; // Mon–Fri
const THREE_X = { type: 'timesPerWeek', times: 3 };

function daysFor(keys, hid = 'h1') {
  const days = {};
  for (const k of keys) days[k] = { [hid]: { done: true } };
  return days;
}

test('normSchedule defaults invalid schedules to daily', () => {
  assert.deepEqual(DH.normSchedule({}), { type: 'daily' });
  assert.deepEqual(DH.normSchedule({ schedule: { type: 'nope' } }), { type: 'daily' });
  assert.deepEqual(DH.normSchedule({ schedule: { type: 'weekdays', days: [] } }), { type: 'daily' });
  assert.deepEqual(DH.normSchedule({ schedule: { type: 'timesPerWeek', times: 99 } }), { type: 'timesPerWeek', times: 7 });
});

test('isScheduledDay respects weekday schedules', () => {
  assert.equal(DH.isScheduledDay(WEEKDAYS, '2026-10-30'), true); // Friday
  assert.equal(DH.isScheduledDay(WEEKDAYS, '2026-10-31'), false); // Saturday
  assert.equal(DH.isScheduledDay(WEEKDAYS, '2026-11-01'), false); // Sunday
  assert.equal(DH.isScheduledDay(WEEKDAYS, '2026-11-02'), true); // Monday
  assert.equal(DH.isScheduledDay({ type: 'daily' }, '2026-10-31'), true);
  assert.equal(DH.isScheduledDay(THREE_X, '2026-10-31'), true);
});

test('scheduleLabel renders friendly labels', () => {
  assert.equal(DH.scheduleLabel({ type: 'daily' }), 'Daily');
  assert.equal(DH.scheduleLabel(WEEKDAYS), 'Mon–Fri');
  assert.equal(DH.scheduleLabel(THREE_X), '3×/week');
  assert.equal(DH.scheduleLabel({ type: 'weekdays', days: [0, 6] }), 'Weekends');
});

test('isoWeekKey / weekStartKey / addWeeks round-trip', () => {
  assert.equal(DH.isoWeekKey('2026-10-30'), '2026-W44');
  assert.equal(DH.weekStartKey('2026-W44'), '2026-10-26'); // Monday
  assert.equal(DH.addWeeks('2026-W44', 1), '2026-W45');
  assert.equal(DH.addWeeks('2026-W44', -1), '2026-W43');
  assert.equal(DH.addWeeks('2026-W52', 1), '2026-W53'); // 2026 has 53 ISO weeks
  assert.equal(DH.addWeeks('2026-W53', 1), '2027-W01'); // year boundary
});

test('weekDoneCount counts done days in the ISO week', () => {
  const days = daysFor(['2026-10-26', '2026-10-28', '2026-10-30']);
  assert.equal(DH.weekDoneCount(days, 'h1', '2026-W44'), 3);
  assert.equal(DH.weekDoneCount(days, 'h1', '2026-W43'), 0);
});

test('currentStreak skips rest days for weekday schedules', () => {
  // Done Mon 10-26 … Fri 10-30, today Saturday 10-31 (rest day): streak stays 5.
  const days = daysFor(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-31', WEEKDAYS), 5);
  // Monday done too: streak continues across the weekend.
  days['2026-11-02'] = { h1: { done: true } };
  assert.equal(DH.currentStreak(days, 'h1', '2026-11-02', WEEKDAYS), 6);
});

test('currentStreak breaks on a missed scheduled day', () => {
  // Missed Wednesday 10-28 (no entry); done Thu+Fri.
  const days = daysFor(['2026-10-26', '2026-10-27', '2026-10-29', '2026-10-30']);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-30', WEEKDAYS), 2);
});

test('bestStreak spans weekends for weekday schedules', () => {
  const days = daysFor(['2026-10-23', '2026-10-26', '2026-10-27']); // Fri, Mon, Tue
  assert.equal(DH.bestStreak(days, 'h1', WEEKDAYS), 3);
});

test('timesPerWeek streak counts consecutive quota-meeting weeks', () => {
  // Week 44: 3 done (quota met). Week 43: 3 done. Week 42: 2 done (missed).
  const days = daysFor([
    '2026-10-26', '2026-10-28', '2026-10-30', // W44
    '2026-10-19', '2026-10-21', '2026-10-23', // W43
    '2026-10-12', '2026-10-14', // W42 — only 2
  ]);
  assert.equal(DH.currentStreak(days, 'h1', '2026-10-30', THREE_X), 2);
  assert.equal(DH.bestStreak(days, 'h1', THREE_X), 2);
});

test('streakDays returns the current run for highlighting', () => {
  const days = daysFor(['2026-10-28', '2026-10-29', '2026-10-30']);
  assert.deepEqual(DH.streakDays(days, 'h1', '2026-10-30', { type: 'daily' }),
    ['2026-10-30', '2026-10-29', '2026-10-28']);
  assert.deepEqual(DH.streakDays(days, 'h1', '2026-10-30', THREE_X), []);
});

test('weekProgress uses explicit target, quota, or scheduled days', () => {
  const days = daysFor(['2026-10-26', '2026-10-28']);
  const h = { id: 'h1', schedule: WEEKDAYS, weeklyTarget: 4 };
  assert.deepEqual(DH.weekProgress(days, h, '2026-W44'), { done: 2, target: 4 });
  const h2 = { id: 'h1', schedule: THREE_X, weeklyTarget: null };
  assert.deepEqual(DH.weekProgress(days, h2, '2026-W44'), { done: 2, target: 3 });
  const h3 = { id: 'h1', schedule: WEEKDAYS, weeklyTarget: null };
  assert.deepEqual(DH.weekProgress(days, h3, '2026-W44'), { done: 2, target: 5 });
});

test('migrateState upgrades v1 to v2 with schedule defaults', () => {
  const v1 = { v: 1, habits: [{ id: 'a', name: 'Read', icon: '📖', createdAt: 1, archived: false }], days: {} };
  const s = DH.migrateState(v1);
  assert.equal(s.v, 2);
  assert.deepEqual(s.habits[0].schedule, { type: 'daily' });
  assert.equal(s.habits[0].description, '');
  assert.equal(s.habits[0].category, '');
  assert.equal(s.habits[0].weeklyTarget, null);
});

test('validateImport accepts the new habit fields', () => {
  const good = {
    v: 2,
    habits: [{
      id: 'a', name: 'Run', icon: '🏃', createdAt: 1, archived: false,
      schedule: { type: 'timesPerWeek', times: 3 },
      description: 'Morning run', category: 'Health', weeklyTarget: 3,
    }],
    days: {},
  };
  assert.equal(DH.validateImport(good).ok, true);
  const bad = { v: 2, habits: [{ id: 'a', name: 'Run', schedule: { type: 'whenever' } }], days: {} };
  assert.equal(DH.validateImport(bad).ok, false);
});
