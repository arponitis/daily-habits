/* Daily Habits — js/lib/trends.js
 * 12-week completion trends and weekday analysis (real check-ins only — frozen days excluded).
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function weeklyRates(days, hid, schedule, endKey, weeks) {
    return DH.heatmapData(days, hid, schedule, endKey, weeks).map(function (col) {
      var done = 0, scheduled = 0;
      col.forEach(function (c) {
        if (c.state === 'done' || c.state === 'frozen') { done++; scheduled++; }
        else if (c.state === 'missed') scheduled++;
      });
      return { weekStart: col[0].key, done: done, scheduled: scheduled, rate: scheduled ? done / scheduled : null };
    });
  }

  function bestWeekday(days, hid, schedule, endKey, weeks) {
    var endMonday = DH.weekStartKey(DH.isoWeekKey(endKey));
    var startMonday = DH.addDays(endMonday, -(weeks - 1) * 7);
    var today = DH.todayKey();
    var agg = {};
    for (var i = 0; i < weeks * 7; i++) {
      var k = DH.addDays(startMonday, i);
      if (k > today) break;
      if (!DH.isScheduledDay(schedule, k)) continue;
      var dow = DH.parseKey(k).getDay();
      var a = agg[dow] || (agg[dow] = { done: 0, scheduled: 0 });
      a.scheduled++;
      if (DH.isDoneIn(days, k, hid)) a.done++;
    }
    var best = null;
    Object.keys(agg).forEach(function (dow) {
      var a = agg[dow];
      if (a.scheduled < 4 || a.done === 0) return;
      var rate = a.done / a.scheduled;
      if (!best || rate > best.rate) best = { weekday: +dow, rate: rate, n: a.scheduled };
    });
    return best;
  }

  function doneInRange(days, hid, fromKey, toKey) {
    var n = 0;
    var d = DH.parseKey(fromKey);
    var guard = 0;
    while (DH.dayKey(d) <= toKey && guard++ < 370) {
      if (DH.isDoneIn(days, DH.dayKey(d), hid)) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  function weekdayCompletion(days, habits, fromKey, toKey) {
    var out = [];
    for (var d = 0; d < 7; d++) out.push({ dow: d, done: 0, scheduled: 0, rate: 0 });
    var dd = DH.parseKey(fromKey);
    var guard = 0;
    while (DH.dayKey(dd) <= toKey && guard++ < 370) {
      var k = DH.dayKey(dd);
      var dow = dd.getDay();
      (habits || []).forEach(function (h) {
        if (DH.isScheduledDay(h.schedule, k)) {
          out[dow].scheduled++;
          if (DH.isDoneIn(days, k, h.id)) out[dow].done++;
        }
      });
      dd.setDate(dd.getDate() + 1);
    }
    out.forEach(function (o) { o.rate = o.scheduled ? o.done / o.scheduled : 0; });
    return out;
  }

  DH.weeklyRates = weeklyRates;
  DH.bestWeekday = bestWeekday;
  DH.doneInRange = doneInRange;
  DH.weekdayCompletion = weekdayCompletion;
})();
