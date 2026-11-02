/* Daily Habits — js/lib/schedule.js
 * Habit schedule shapes ({type: daily} | {type: weekdays, days:[0..6]} | {type: timesPerWeek, times:n}) and schedule-aware queries.
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function normSchedule(habit) {
    var s = habit && habit.schedule;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { type: 'daily' };
    if (s.type === 'weekdays') {
      var days = Array.isArray(s.days)
        ? s.days.filter(function (d) { return d >= 0 && d <= 6; })
        : [];
      if (!days.length) return { type: 'daily' };
      return { type: 'weekdays', days: days };
    }
    if (s.type === 'timesPerWeek') {
      return { type: 'timesPerWeek', times: Math.max(1, Math.min(7, Math.floor(Number(s.times) || 1))) };
    }
    return { type: 'daily' };
  }

  function isScheduledDay(schedule, key) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'weekdays') return s.days.indexOf(DH.parseKey(key).getDay()) !== -1;
    return true; // daily + timesPerWeek: every day is eligible
  }

  function scheduleLabel(schedule) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'weekdays') {
      var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var ds = s.days.slice().sort(function (a, b) { return a - b; });
      if (ds.join(',') === '1,2,3,4,5') return 'Mon–Fri';
      if (ds.join(',') === '0,6') return 'Weekends';
      return ds.map(function (d) { return names[d]; }).join(' ');
    }
    if (s.type === 'timesPerWeek') return s.times + '×/week';
    return 'Daily';
  }

  function scheduledDaysInWeek(schedule, wkey) {
    var start = DH.weekStartKey(wkey);
    if (!start) return 0;
    var n = 0;
    for (var i = 0; i < 7; i++) if (isScheduledDay(schedule, DH.addDays(start, i))) n++;
    return n;
  }

  function prevScheduledDay(schedule, key) {
    var d = DH.parseKey(key);
    for (var i = 0; i < 8; i++) {
      d.setDate(d.getDate() - 1);
      var k = DH.dayKey(d);
      if (isScheduledDay(schedule, k)) return k;
    }
    return null;
  }

  function scheduledDaysInRange(schedule, fromKey, toKey) {
    var n = 0;
    var d = DH.parseKey(fromKey);
    var guard = 0;
    while (DH.dayKey(d) <= toKey && guard++ < 370) {
      if (isScheduledDay(schedule, DH.dayKey(d))) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  function weekDoneCount(days, hid, wkey) {
    var start = DH.weekStartKey(wkey);
    if (!start) return 0;
    var n = 0;
    for (var i = 0; i < 7; i++) if (DH.isDoneIn(days, DH.addDays(start, i), hid)) n++;
    return n;
  }

  function weeklyTargetFor(habit) {
    if (habit && typeof habit.weeklyTarget === 'number' && habit.weeklyTarget > 0) {
      return Math.floor(habit.weeklyTarget);
    }
    var s = normSchedule(habit);
    if (s.type === 'timesPerWeek') return s.times;
    return null;
  }

  function weekProgress(days, habit, wkey) {
    var done = weekDoneCount(days, habit.id, wkey);
    var target = weeklyTargetFor(habit);
    if (target == null) target = scheduledDaysInWeek(habit.schedule, wkey);
    return { done: done, target: target };
  }

  DH.normSchedule = normSchedule;
  DH.isScheduledDay = isScheduledDay;
  DH.scheduleLabel = scheduleLabel;
  DH.scheduledDaysInWeek = scheduledDaysInWeek;
  DH.prevScheduledDay = prevScheduledDay;
  DH.scheduledDaysInRange = scheduledDaysInRange;
  DH.weekDoneCount = weekDoneCount;
  DH.weeklyTargetFor = weeklyTargetFor;
  DH.weekProgress = weekProgress;
})();
