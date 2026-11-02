/* Daily Habits — js/lib/streaks.js
 * Streak computation: schedule-aware current/best streaks plus the weekly grace-day rule.
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function isDoneIn(days, key, hid) {
    return !!(days && days[key] && days[key][hid] && days[key][hid].done);
  }

  function streakDays(days, hid, today, schedule) {
    var s = DH.normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return [];
    var out = [];
    var d = DH.parseKey(today);
    var k = DH.dayKey(d);
    if (DH.isScheduledDay(schedule, k) && !isDoneIn(days, k, hid)) d.setDate(d.getDate() - 1);
    var guard = 0;
    for (;;) {
      k = DH.dayKey(d);
      if (!DH.isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); }
      else if (!isDoneIn(days, k, hid)) break;
      else { out.push(k); d.setDate(d.getDate() - 1); }
      if (++guard > 400) break; // safety cap
    }
    return out;
  }

  function streakWalk(days, hid, today, schedule) {
    var events = []; // newest-first: { k, done }
    var frozenWeeks = {};
    var d = DH.parseKey(today);
    var k = DH.dayKey(d);
    if (DH.isScheduledDay(schedule, k) && !isDoneIn(days, k, hid)) d.setDate(d.getDate() - 1);
    var guard = 0;
    for (;;) {
      if (guard++ > 400) break; // safety cap
      k = DH.dayKey(d);
      if (!DH.isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); continue; }
      if (isDoneIn(days, k, hid)) { events.push({ k: k, done: true }); d.setDate(d.getDate() - 1); continue; }
      var wk = DH.isoWeekKey(k);
      if (!frozenWeeks[wk]) { frozenWeeks[wk] = true; events.push({ k: k, done: false }); d.setDate(d.getDate() - 1); continue; }
      break;
    }
    var count = 0, frozen = {}, seenOlderDone = false;
    for (var i = events.length - 1; i >= 0; i--) {
      if (events[i].done) { count++; seenOlderDone = true; }
      else if (seenOlderDone) frozen[events[i].k] = true;
    }
    return { count: count, frozen: frozen };
  }

  function currentStreak(days, hid, today, schedule) {
    var s = DH.normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') {
      var wk = DH.isoWeekKey(today);
      var n = 0;
      if (DH.weekDoneCount(days, hid, wk) < s.times) wk = DH.addWeeks(wk, -1);
      while (DH.weekDoneCount(days, hid, wk) >= s.times) { n++; wk = DH.addWeeks(wk, -1); }
      return n;
    }
    return streakWalk(days, hid, today, schedule).count;
  }

  function bestStreak(days, hid, schedule) {
    var s = DH.normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') {
      var keys = Object.keys(days || {}).sort();
      if (!keys.length) return 0;
      var wk = DH.isoWeekKey(keys[0]);
      var end = DH.isoWeekKey(DH.todayKey());
      var best = 0, cur = 0, guard = 0;
      while (wk <= end && guard++ < 5200) {
        if (DH.weekDoneCount(days, hid, wk) >= s.times) { cur++; if (cur > best) best = cur; }
        else cur = 0;
        wk = DH.addWeeks(wk, 1);
      }
      return best;
    }
    var dkeys = Object.keys(days || {}).sort();
    if (!dkeys.length) return 0;
    var frozenWeeks = {};
    var bbest = 0, ccur = 0, gguard = 0;
    var d = DH.parseKey(dkeys[0]);
    var dend = DH.parseKey(dkeys[dkeys.length - 1]);
    while (DH.dayKey(d) <= DH.dayKey(dend) && gguard++ < 4000) {
      var k = DH.dayKey(d);
      if (!DH.isScheduledDay(schedule, k)) { d.setDate(d.getDate() + 1); continue; }
      if (isDoneIn(days, k, hid)) { ccur++; if (ccur > bbest) bbest = ccur; }
      else {
        var ww = DH.isoWeekKey(k);
        if (!frozenWeeks[ww]) frozenWeeks[ww] = true; // grace day: streak survives
        else ccur = 0;
      }
      d.setDate(d.getDate() + 1);
    }
    return bbest;
  }

  function graceUsedThisWeek(days, hid, today, schedule) {
    var s = DH.normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return 0;
    var wk = DH.isoWeekKey(today);
    var frozen = streakWalk(days, hid, today, schedule).frozen;
    var n = 0;
    Object.keys(frozen).forEach(function (k) { if (DH.isoWeekKey(k) === wk) n++; });
    return n;
  }

  function totalDone(days, hid) {
    return Object.keys(days || {}).filter(function (k) { return isDoneIn(days, k, hid); }).length;
  }

  DH.isDoneIn = isDoneIn;
  DH.streakDays = streakDays;
  DH.currentStreak = currentStreak;
  DH.bestStreak = bestStreak;
  DH.graceUsedThisWeek = graceUsedThisWeek;
  DH.totalDone = totalDone;
})();
