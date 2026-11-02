/* Daily Habits — js/lib/insights.js
 * Weekly insights: best day, most consistent habit, week-over-week trend, longest active streak.
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function insights(days, habits, today) {
    var act = (habits || []).filter(function (h) { return !h.archived; });
    var from = DH.addDays(today, -27);

    var bestWeekday = null;
    DH.weekdayCompletion(days, act, from, today).forEach(function (w) {
      if (w.scheduled >= 4 && (!bestWeekday || w.rate > bestWeekday.rate)) {
        bestWeekday = { dow: w.dow, rate: w.rate };
      }
    });

    var mostConsistent = null;
    act.forEach(function (h) {
      var sched = DH.scheduledDaysInRange(h.schedule, from, today);
      if (sched < 7) return; // not enough history to judge
      var done = DH.doneInRange(days, h.id, from, today);
      var rate = done / sched;
      if (!mostConsistent || rate > mostConsistent.rate) {
        mostConsistent = { id: h.id, name: h.name, icon: h.icon, rate: rate, done: done, scheduled: sched };
      }
    });

    var cw = DH.isoWeekKey(today);
    var lw = DH.addWeeks(cw, -1);
    var tw = { done: 0, total: 0 };
    var lwk = { done: 0, total: 0 };
    act.forEach(function (h) {
      var p1 = DH.weekProgress(days, h, cw);
      var p2 = DH.weekProgress(days, h, lw);
      tw.done += Math.min(p1.done, p1.target); tw.total += p1.target;
      lwk.done += Math.min(p2.done, p2.target); lwk.total += p2.target;
    });

    var longestActiveStreak = null;
    act.forEach(function (h) {
      var n = DH.currentStreak(days, h.id, today, h.schedule);
      if (n > 0 && (!longestActiveStreak || n > longestActiveStreak.n)) {
        longestActiveStreak = { id: h.id, name: h.name, icon: h.icon, n: n };
      }
    });

    return {
      bestWeekday: bestWeekday,
      mostConsistent: mostConsistent,
      thisWeek: tw,
      lastWeek: lwk,
      longestActiveStreak: longestActiveStreak
    };
  }

  DH.insights = insights;
})();
