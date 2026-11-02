/* Daily Habits — js/lib/heatmap.js
 * GitHub-style per-habit check-in heatmap data (Monday-first week columns).
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function frozenDaysInRange(days, hid, schedule, fromKey, toKey) {
    var s = DH.normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return {};
    var frozen = {}, frozenWeeks = {};
    var d = DH.parseKey(toKey), end = DH.parseKey(fromKey);
    var guard = 0;
    while (DH.dayKey(d) >= DH.dayKey(end) && guard++ < 500) {
      var k = DH.dayKey(d);
      if (!DH.isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); continue; }
      if (!DH.isDoneIn(days, k, hid)) {
        var wk = DH.isoWeekKey(k);
        if (!frozenWeeks[wk]) { frozenWeeks[wk] = true; frozen[k] = true; }
      }
      d.setDate(d.getDate() - 1);
    }
    return frozen;
  }

  function heatmapData(days, hid, schedule, endKey, weeks) {
    var endMonday = DH.weekStartKey(DH.isoWeekKey(endKey));
    var startMonday = DH.addDays(endMonday, -(weeks - 1) * 7);
    // The final column runs to Sunday of endKey's week, which can be after endKey;
    // clamp to today since future days can't be frozen.
    var lastDay = DH.addDays(startMonday, weeks * 7 - 1);
    if (lastDay > today) lastDay = today;
    var frozen = frozenDaysInRange(days, hid, schedule, startMonday, lastDay);
    var today = DH.todayKey();
    var cols = [];
    for (var w = 0; w < weeks; w++) {
      var col = [];
      for (var i = 0; i < 7; i++) {
        var k = DH.addDays(startMonday, w * 7 + i);
        var state;
        if (k > today) state = 'future';
        else if (DH.isDoneIn(days, k, hid)) state = 'done';
        else if (frozen[k]) state = 'frozen';
        else if (DH.isScheduledDay(schedule, k)) state = 'missed';
        else state = 'off';
        col.push({ key: k, state: state });
      }
      cols.push(col);
    }
    return cols;
  }

  DH.frozenDaysInRange = frozenDaysInRange;
  DH.heatmapData = heatmapData;
})();
