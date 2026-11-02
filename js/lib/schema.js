/* Daily Habits — js/lib/schema.js
 * Stored-data versioning: import validation and forward migrations.
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  var CURRENT_SCHEMA_VERSION = 2;

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
        if (h.description != null && typeof h.description !== 'string') errors.push('habits[' + i + '].description must be a string');
        if (h.category != null && typeof h.category !== 'string') errors.push('habits[' + i + '].category must be a string');
        if (h.weeklyTarget != null && typeof h.weeklyTarget !== 'number') errors.push('habits[' + i + '].weeklyTarget must be a number');
        if (h.schedule != null) {
          if (typeof h.schedule !== 'object' || Array.isArray(h.schedule)) {
            errors.push('habits[' + i + '].schedule must be an object');
          } else {
            var st = h.schedule.type;
            if (st !== 'daily' && st !== 'weekdays' && st !== 'timesPerWeek') {
              errors.push('habits[' + i + '].schedule.type is invalid');
            }
            if (st === 'weekdays' && !Array.isArray(h.schedule.days)) {
              errors.push('habits[' + i + '].schedule.days must be an array');
            }
            if (st === 'timesPerWeek' && typeof h.schedule.times !== 'number') {
              errors.push('habits[' + i + '].schedule.times must be a number');
            }
          }
        }
      });
    }
    if (!data.days || typeof data.days !== 'object' || Array.isArray(data.days)) {
      errors.push('days must be an object keyed by date');
    } else {
      Object.keys(data.days).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || isNaN(DH.parseKey(k).getTime())) {
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
    if (v < 2) {
      // v1 -> v2: flexible schedules + habit metadata (Phase 2). Every habit
      // gets a normalized schedule plus the new optional fields.
      s.habits.forEach(function (h) {
        h.schedule = DH.normSchedule(h);
        if (typeof h.description !== 'string') h.description = '';
        if (typeof h.category !== 'string') h.category = '';
        if (typeof h.weeklyTarget === 'undefined' ||
            (h.weeklyTarget !== null && typeof h.weeklyTarget !== 'number')) {
          h.weeklyTarget = null;
        }
      });
      s.v = 2;
    }
    return s;
  }

  DH.CURRENT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
  DH.validateImport = validateImport;
  DH.migrateState = migrateState;
})();
