/* Daily Habits — shared pure logic (lib.js)
 *
 * Dependency-free functions with no DOM access, so the same code runs in the
 * browser (exposed as globalThis.DH) and under Node for the unit test suite.
 * All date handling uses the device's local calendar: a "day" is what the
 * user sees on their clock, and day arithmetic goes through the Date object
 * so it stays correct across DST transitions (23/25-hour days).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.DH = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CURRENT_SCHEMA_VERSION = 1;

  function pad(n) { return String(n).padStart(2, '0'); }

  /** Local-calendar day key: 'YYYY-MM-DD'. */
  function dayKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function todayKey() { return dayKey(new Date()); }

  /** Calendar-day arithmetic. DST-safe: never assumes a day is 86400000 ms. */
  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }

  function isDoneIn(days, key, hid) {
    return !!(days && days[key] && days[key][hid] && days[key][hid].done);
  }

  /**
   * Consecutive done-days ending today (or yesterday if today isn't done yet —
   * the streak stays alive until the day is over).
   */
  function currentStreak(days, hid, today) {
    var s = 0;
    var d = parseKey(today);
    if (!isDoneIn(days, dayKey(d), hid)) d.setDate(d.getDate() - 1);
    while (isDoneIn(days, dayKey(d), hid)) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  /**
   * Longest run of consecutive done-days. Compares calendar days, not
   * millisecond deltas, so DST transitions can't split a streak.
   */
  function bestStreak(days, hid) {
    var best = 0, cur = 0, prev = null;
    var keys = Object.keys(days || {}).sort();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!isDoneIn(days, k, hid)) { cur = 0; prev = null; continue; }
      cur = (prev !== null && addDays(prev, 1) === k) ? cur + 1 : 1;
      prev = k;
      if (cur > best) best = cur;
    }
    return best;
  }

  function totalDone(days, hid) {
    return Object.keys(days || {}).filter(function (k) { return isDoneIn(days, k, hid); }).length;
  }

  /**
   * Validate an imported payload before it touches stored state.
   * Returns { ok: boolean, errors: string[] }.
   */
  function validateImport(data) {
    var errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['file does not contain a Daily Habits object'] };
    }
    if (!Array.isArray(data.habits)) {
      errors.push('habits must be an array');
    } else {
      data.habits.forEach(function (h, i) {
        if (!h || typeof h !== 'object') { errors.push('habits[' + i + '] must be an object'); return; }
        if (typeof h.id !== 'string' || !h.id) errors.push('habits[' + i + '].id must be a non-empty string');
        if (typeof h.name !== 'string' || !h.name.trim()) errors.push('habits[' + i + '].name must be a non-empty string');
        if (h.icon != null && typeof h.icon !== 'string') errors.push('habits[' + i + '].icon must be a string');
        if (h.archived != null && typeof h.archived !== 'boolean') errors.push('habits[' + i + '].archived must be a boolean');
      });
    }
    if (!data.days || typeof data.days !== 'object' || Array.isArray(data.days)) {
      errors.push('days must be an object keyed by date');
    } else {
      Object.keys(data.days).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || isNaN(parseKey(k).getTime())) {
          errors.push('invalid day key: ' + k);
          return;
        }
        var day = data.days[k];
        if (!day || typeof day !== 'object' || Array.isArray(day)) {
          errors.push('days[' + k + '] must be an object');
          return;
        }
        Object.keys(day).forEach(function (hid) {
          var e = day[hid];
          if (!e || typeof e !== 'object' || Array.isArray(e)) {
            errors.push('days[' + k + '].' + hid + ' must be an object');
            return;
          }
          if (typeof e.done !== 'boolean') errors.push('days[' + k + '].' + hid + '.done must be a boolean');
          if (e.note != null && typeof e.note !== 'string') errors.push('days[' + k + '].' + hid + '.note must be a string');
        });
      });
    }
    if (data.v != null && typeof data.v !== 'number') errors.push('v (schema version) must be a number');
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Bring any stored payload up to the current schema. Migrations run in
   * order; each step handles exactly one version hop. Throws when the payload
   * claims a newer version than this build understands — the caller must back
   * the data up rather than overwrite it.
   */
  function migrateState(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) s = { habits: [], days: {} };
    var v = (typeof s.v === 'number') ? s.v : 0;
    if (v > CURRENT_SCHEMA_VERSION) {
      throw new Error('data schema v' + v + ' is newer than supported v' + CURRENT_SCHEMA_VERSION);
    }
    if (v < 1) {
      // v0 -> v1: stamp version, default archived flags, normalize entries
      // (older builds could store { note } without done).
      if (!Array.isArray(s.habits)) s.habits = [];
      s.habits.forEach(function (h) {
        if (typeof h.archived !== 'boolean') h.archived = false;
      });
      if (!s.days || typeof s.days !== 'object' || Array.isArray(s.days)) s.days = {};
      Object.keys(s.days).forEach(function (k) {
        var day = s.days[k];
        if (!day || typeof day !== 'object') { delete s.days[k]; return; }
        Object.keys(day).forEach(function (hid) {
          if (!day[hid] || typeof day[hid] !== 'object') { delete day[hid]; return; }
          if (typeof day[hid].done !== 'boolean') day[hid].done = false;
        });
      });
      s.v = 1;
    }
    return s;
  }

  return {
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    dayKey: dayKey,
    parseKey: parseKey,
    todayKey: todayKey,
    addDays: addDays,
    isDoneIn: isDoneIn,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    totalDone: totalDone,
    validateImport: validateImport,
    migrateState: migrateState
  };
});
