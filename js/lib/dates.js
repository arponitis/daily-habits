/* Daily Habits — js/lib/dates.js
 * Local-calendar date helpers. A "day" is what the user sees on their clock; arithmetic goes through the Date object so it stays correct across DST transitions (23/25-hour days).
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function pad(n) { return String(n).padStart(2, '0'); }

  function dayKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function todayKey() { return dayKey(new Date()); }

  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }

  function isoWeekKey(key) {
    var d = parseKey(key);
    var dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow + 3); // Thursday decides the ISO year/week
    var jan4 = new Date(d.getFullYear(), 0, 4);
    var jan4dow = (jan4.getDay() + 6) % 7;
    jan4.setDate(jan4.getDate() - jan4dow + 3);
    var week = 1 + Math.round((d - jan4) / 604800000);
    return d.getFullYear() + '-W' + String(week).padStart(2, '0');
  }

  function weekStartKey(wkey) {
    var m = /^(\d{4})-W(\d{2})$/.exec(wkey || '');
    if (!m) return null;
    var jan4 = new Date(Number(m[1]), 0, 4);
    var dow = (jan4.getDay() + 6) % 7;
    var monday = new Date(jan4.getFullYear(), jan4.getMonth(), jan4.getDate() - dow + (Number(m[2]) - 1) * 7);
    return dayKey(monday);
  }

  function addWeeks(wkey, n) {
    return isoWeekKey(addDays(weekStartKey(wkey), n * 7));
  }

  DH.dayKey = dayKey;
  DH.parseKey = parseKey;
  DH.todayKey = todayKey;
  DH.addDays = addDays;
  DH.isoWeekKey = isoWeekKey;
  DH.weekStartKey = weekStartKey;
  DH.addWeeks = addWeeks;
})();
