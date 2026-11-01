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

  var CURRENT_SCHEMA_VERSION = 2;

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

  /* ---------------- schedules ----------------
   * schedule shapes:
   *   { type: 'daily' }
   *   { type: 'weekdays', days: [0..6] }   // 0 = Sunday
   *   { type: 'timesPerWeek', times: n }
   * A missing or invalid schedule is treated as daily. Rest days never break
   * or extend streaks; they are simply skipped.
   */

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

  /** Is this calendar day a scheduled day for the habit? */
  function isScheduledDay(schedule, key) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'weekdays') return s.days.indexOf(parseKey(key).getDay()) !== -1;
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

  /** ISO week key 'YYYY-Www' (Monday-first). */
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

  /** Monday's day-key for an ISO week key. */
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

  function weekDoneCount(days, hid, wkey) {
    var start = weekStartKey(wkey);
    if (!start) return 0;
    var n = 0;
    for (var i = 0; i < 7; i++) if (isDoneIn(days, addDays(start, i), hid)) n++;
    return n;
  }

  function scheduledDaysInWeek(schedule, wkey) {
    var start = weekStartKey(wkey);
    if (!start) return 0;
    var n = 0;
    for (var i = 0; i < 7; i++) if (isScheduledDay(schedule, addDays(start, i))) n++;
    return n;
  }

  /** Previous scheduled day strictly before `key` (searches back up to 8 days). */
  function prevScheduledDay(schedule, key) {
    var d = parseKey(key);
    for (var i = 0; i < 8; i++) {
      d.setDate(d.getDate() - 1);
      var k = dayKey(d);
      if (isScheduledDay(schedule, k)) return k;
    }
    return null;
  }

  /**
   * Day-keys in the current streak (for calendar highlighting). timesPerWeek
   * streaks are week-based and don't map to single days, so they return [].
   */
  function streakDays(days, hid, today, schedule) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return [];
    var out = [];
    var d = parseKey(today);
    var k = dayKey(d);
    if (isScheduledDay(schedule, k) && !isDoneIn(days, k, hid)) d.setDate(d.getDate() - 1);
    var guard = 0;
    for (;;) {
      k = dayKey(d);
      if (!isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); }
      else if (!isDoneIn(days, k, hid)) break;
      else { out.push(k); d.setDate(d.getDate() - 1); }
      if (++guard > 400) break; // safety cap
    }
    return out;
  }

  /**
   * Shared walk for streaks with the weekly grace day: one missed scheduled
   * day per ISO week is forgiven (frozen) instead of breaking the streak.
   * Returns { count, frozen } where frozen maps dayKeys to true - but only
   * for freezes that actually saved the streak, i.e. that bridge to an
   * older done day. timesPerWeek habits don't need this - their quota is
   * already forgiving.
   */
  function streakWalk(days, hid, today, schedule) {
    var events = []; // newest-first: { k, done }
    var frozenWeeks = {};
    var d = parseKey(today);
    var k = dayKey(d);
    if (isScheduledDay(schedule, k) && !isDoneIn(days, k, hid)) d.setDate(d.getDate() - 1);
    var guard = 0;
    for (;;) {
      if (guard++ > 400) break; // safety cap
      k = dayKey(d);
      if (!isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); continue; }
      if (isDoneIn(days, k, hid)) { events.push({ k: k, done: true }); d.setDate(d.getDate() - 1); continue; }
      var wk = isoWeekKey(k);
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

  /**
   * Consecutive periods ending today (or yesterday if today's period isn't
   * complete yet — the streak stays alive until the period is over).
   * For daily/weekdays the period is a scheduled day; for timesPerWeek it is
   * an ISO week meeting its quota.
   */
  function currentStreak(days, hid, today, schedule) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') {
      var wk = isoWeekKey(today);
      var n = 0;
      if (weekDoneCount(days, hid, wk) < s.times) wk = addWeeks(wk, -1);
      while (weekDoneCount(days, hid, wk) >= s.times) { n++; wk = addWeeks(wk, -1); }
      return n;
    }
    return streakWalk(days, hid, today, schedule).count;
  }

  /** Number of grace days consumed in the ISO week containing `today`. */
  function graceUsedThisWeek(days, hid, today, schedule) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return 0;
    var wk = isoWeekKey(today);
    var frozen = streakWalk(days, hid, today, schedule).frozen;
    var n = 0;
    Object.keys(frozen).forEach(function (k) { if (isoWeekKey(k) === wk) n++; });
    return n;
  }

  /**
   * Frozen (grace) days in a date range, via the same backward walk as the
   * streak: one missed scheduled day per ISO week is forgiven. Returns a
   * { dayKey: true } map. Used by the heatmap.
   */
  function frozenDaysInRange(days, hid, schedule, fromKey, toKey) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') return {};
    var frozen = {}, frozenWeeks = {};
    var d = parseKey(toKey), end = parseKey(fromKey);
    var guard = 0;
    while (dayKey(d) >= dayKey(end) && guard++ < 500) {
      var k = dayKey(d);
      if (!isScheduledDay(schedule, k)) { d.setDate(d.getDate() - 1); continue; }
      if (!isDoneIn(days, k, hid)) {
        var wk = isoWeekKey(k);
        if (!frozenWeeks[wk]) { frozenWeeks[wk] = true; frozen[k] = true; }
      }
      d.setDate(d.getDate() - 1);
    }
    return frozen;
  }

  /**
   * GitHub-style heatmap data: `weeks` columns (oldest first) of 7
   * Monday-first day cells, ending with the week containing endKey.
   * Each cell is { key, state } with state 'done' | 'frozen' | 'missed' |
   * 'off' (unscheduled) | 'future'.
   */
  function heatmapData(days, hid, schedule, endKey, weeks) {
    var endMonday = weekStartKey(isoWeekKey(endKey));
    var startMonday = addDays(endMonday, -(weeks - 1) * 7);
    // The final column runs to Sunday of endKey's week, which can be after endKey;
    // clamp to today since future days can't be frozen.
    var lastDay = addDays(startMonday, weeks * 7 - 1);
    if (lastDay > today) lastDay = today;
    var frozen = frozenDaysInRange(days, hid, schedule, startMonday, lastDay);
    var today = todayKey();
    var cols = [];
    for (var w = 0; w < weeks; w++) {
      var col = [];
      for (var i = 0; i < 7; i++) {
        var k = addDays(startMonday, w * 7 + i);
        var state;
        if (k > today) state = 'future';
        else if (isDoneIn(days, k, hid)) state = 'done';
        else if (frozen[k]) state = 'frozen';
        else if (isScheduledDay(schedule, k)) state = 'missed';
        else state = 'off';
        col.push({ key: k, state: state });
      }
      cols.push(col);
    }
    return cols;
  }

  /* ---------------- trends (Phase C) ----------------
   * Per-week completion rates and best-weekday analysis, built on
   * heatmapData. Grace-frozen days count as done.
   */

  /**
   * Completion rate per week over `weeks` weeks ending at endKey's week.
   * Returns [{weekStart, done, scheduled, rate}] oldest first; rate is null
   * when nothing was scheduled that week.
   */
  function weeklyRates(days, hid, schedule, endKey, weeks) {
    return heatmapData(days, hid, schedule, endKey, weeks).map(function (col) {
      var done = 0, scheduled = 0;
      col.forEach(function (c) {
        if (c.state === 'done' || c.state === 'frozen') { done++; scheduled++; }
        else if (c.state === 'missed') scheduled++;
      });
      return { weekStart: col[0].key, done: done, scheduled: scheduled, rate: scheduled ? done / scheduled : null };
    });
  }

  /**
   * Best weekday for a habit: {weekday (0=Sunday), rate, n}, based on REAL
   * check-ins only (grace-frozen days are ignored — the freeze always lands
   * on the latest missed day of the week, which would bias toward weekends).
   * Requires at least 4 scheduled occurrences and at least one real done;
   * null otherwise.
   */
  function bestWeekday(days, hid, schedule, endKey, weeks) {
    var endMonday = weekStartKey(isoWeekKey(endKey));
    var startMonday = addDays(endMonday, -(weeks - 1) * 7);
    var today = todayKey();
    var agg = {};
    for (var i = 0; i < weeks * 7; i++) {
      var k = addDays(startMonday, i);
      if (k > today) break;
      if (!isScheduledDay(schedule, k)) continue;
      var dow = parseKey(k).getDay();
      var a = agg[dow] || (agg[dow] = { done: 0, scheduled: 0 });
      a.scheduled++;
      if (isDoneIn(days, k, hid)) a.done++;
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

  /**
   * Longest run of consecutive scheduled periods. Compares calendar days, not
   * millisecond deltas, so DST transitions can't split a streak; rest days
   * are skipped so a Mon–Fri habit's weekend never breaks the run. One
   * missed scheduled day per ISO week is forgiven (grace day).
   */
  function bestStreak(days, hid, schedule) {
    var s = normSchedule({ schedule: schedule });
    if (s.type === 'timesPerWeek') {
      var keys = Object.keys(days || {}).sort();
      if (!keys.length) return 0;
      var wk = isoWeekKey(keys[0]);
      var end = isoWeekKey(todayKey());
      var best = 0, cur = 0, guard = 0;
      while (wk <= end && guard++ < 5200) {
        if (weekDoneCount(days, hid, wk) >= s.times) { cur++; if (cur > best) best = cur; }
        else cur = 0;
        wk = addWeeks(wk, 1);
      }
      return best;
    }
    var dkeys = Object.keys(days || {}).sort();
    if (!dkeys.length) return 0;
    var frozenWeeks = {};
    var bbest = 0, ccur = 0, gguard = 0;
    var d = parseKey(dkeys[0]);
    var dend = parseKey(dkeys[dkeys.length - 1]);
    while (dayKey(d) <= dayKey(dend) && gguard++ < 4000) {
      var k = dayKey(d);
      if (!isScheduledDay(schedule, k)) { d.setDate(d.getDate() + 1); continue; }
      if (isDoneIn(days, k, hid)) { ccur++; if (ccur > bbest) bbest = ccur; }
      else {
        var ww = isoWeekKey(k);
        if (!frozenWeeks[ww]) frozenWeeks[ww] = true; // grace day: streak survives
        else ccur = 0;
      }
      d.setDate(d.getDate() + 1);
    }
    return bbest;
  }

  function totalDone(days, hid) {
    return Object.keys(days || {}).filter(function (k) { return isDoneIn(days, k, hid); }).length;
  }

  /** Effective weekly target: explicit target, else the timesPerWeek quota, else null. */
  function weeklyTargetFor(habit) {
    if (habit && typeof habit.weeklyTarget === 'number' && habit.weeklyTarget > 0) {
      return Math.floor(habit.weeklyTarget);
    }
    var s = normSchedule(habit);
    if (s.type === 'timesPerWeek') return s.times;
    return null;
  }

  /**
   * This week's progress for a habit: { done, target }. When no explicit
   * target exists, the target defaults to the number of scheduled days in
   * the week.
   */
  function weekProgress(days, habit, wkey) {
    var done = weekDoneCount(days, habit.id, wkey);
    var target = weeklyTargetFor(habit);
    if (target == null) target = scheduledDaysInWeek(habit.schedule, wkey);
    return { done: done, target: target };
  }

  /* ---------------- encrypted backups + merge (Phase 5) ----------------
   * AES-GCM with a PBKDF2-SHA256 derived key. The helpers take the crypto
   * object as a parameter so they run in browsers (window.crypto) and in
   * Node tests (require('node:crypto').webcrypto) alike.
   */

  function b64encode(bytes) {
    var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var bin = '';
    for (var i = 0; i < arr.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
    }
    if (typeof btoa === 'function') return btoa(bin);
    return Buffer.from(bin, 'binary').toString('base64');
  }

  function b64decode(b64) {
    var bin;
    if (typeof atob === 'function') bin = atob(b64);
    else bin = Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function deriveBackupKey(cryptoObj, password, salt) {
    var enc = new TextEncoder();
    return cryptoObj.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return cryptoObj.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /** Encrypt a JSON string with a password. Resolves the backup payload object. */
  function encryptBackup(cryptoObj, jsonString, password) {
    var salt = cryptoObj.getRandomValues(new Uint8Array(16));
    var iv = cryptoObj.getRandomValues(new Uint8Array(12));
    return deriveBackupKey(cryptoObj, password, salt).then(function (key) {
      return cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(jsonString));
    }).then(function (ct) {
      return {
        app: 'daily-habits',
        enc: 'AES-GCM/PBKDF2-SHA256-200k',
        salt: b64encode(salt),
        iv: b64encode(iv),
        data: b64encode(new Uint8Array(ct))
      };
    });
  }

  /**
   * Decrypt a backup payload with a password. Resolves the JSON string.
   * Rejects on a wrong password, a corrupted payload, or a foreign format —
   * never mutates anything.
   */
  function decryptBackup(cryptoObj, payload, password) {
    if (!payload || payload.app !== 'daily-habits' || !payload.salt || !payload.iv || !payload.data) {
      return Promise.reject(new Error('Not a Daily Habits encrypted backup.'));
    }
    return deriveBackupKey(cryptoObj, password, b64decode(payload.salt)).then(function (key) {
      return cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv: b64decode(payload.iv) }, key, b64decode(payload.data));
    }).then(function (pt) {
      return new TextDecoder().decode(pt);
    });
  }

  /**
   * Merge an imported state into the current one — the cross-device sync
   * primitive. Habits union by id (the current device's definitions win);
   * day entries merge with done OR-wins and the current device's note
   * winning conflicts. Neither input is mutated.
   */
  function mergeStates(base, incoming) {
    var out = JSON.parse(JSON.stringify(base || { v: CURRENT_SCHEMA_VERSION, habits: [], days: {} }));
    if (!Array.isArray(out.habits)) out.habits = [];
    if (!out.days || typeof out.days !== 'object') out.days = {};
    var seen = {};
    out.habits.forEach(function (h) { seen[h.id] = true; });
    (incoming.habits || []).forEach(function (h) {
      if (h && h.id && !seen[h.id]) { out.habits.push(JSON.parse(JSON.stringify(h))); seen[h.id] = true; }
    });
    Object.keys(incoming.days || {}).forEach(function (k) {
      if (!out.days[k] || typeof out.days[k] !== 'object') out.days[k] = {};
      Object.keys(incoming.days[k]).forEach(function (hid) {
        var inc = incoming.days[k][hid] || {};
        var cur = out.days[k][hid] || {};
        var merged = {};
        if (cur.done || inc.done) merged.done = true;
        var note = cur.note || inc.note;
        if (note) merged.note = note;
        if (merged.done || merged.note) out.days[k][hid] = merged;
        else delete out.days[k][hid];
      });
      if (Object.keys(out.days[k]).length === 0) delete out.days[k];
    });
    out.v = CURRENT_SCHEMA_VERSION;
    return out;
  }

  /* ---------------- habit templates (Phase C) ----------------
   * One-tap starter packs. Pure data + instantiation; the app handles UI.
   */
  var TEMPLATES = [
    { id: 'morning-reset', name: 'Morning Reset', icon: '🌅',
      blurb: 'Own the first hour of the day.',
      habits: [
        { name: 'Make bed', icon: '🛌', schedule: { type: 'daily' }, description: 'Two minutes, done.' },
        { name: 'Drink a glass of water', icon: '💧', schedule: { type: 'daily' }, description: 'Before coffee.' },
        { name: '10-minute tidy', icon: '🧹', schedule: { type: 'daily' }, description: 'One room, ten minutes.' }
      ] },
    { id: 'deep-work', name: 'Deep Work', icon: '🧠',
      blurb: 'Protect your attention.',
      habits: [
        { name: 'No phone first hour', icon: '📵', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, description: 'Phone stays in another room.' },
        { name: 'Two focus blocks', icon: '🧠', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, description: '50 minutes each, no notifications.' },
        { name: 'Write 200 words', icon: '📝', schedule: { type: 'daily' }, description: 'Anything. Just ship words.' }
      ] },
    { id: 'fitness-starter', name: 'Fitness Starter', icon: '🏃',
      blurb: 'Small moves, every day.',
      habits: [
        { name: 'Walk 20 minutes', icon: '🏃', schedule: { type: 'daily' }, description: 'Around the block counts.' },
        { name: 'Stretch 5 minutes', icon: '💪', schedule: { type: 'daily' }, description: 'Hips and shoulders.' },
        { name: 'No sugary drinks', icon: '🚫', schedule: { type: 'daily' }, description: 'Water, tea, or black coffee.' }
      ] },
    { id: 'reading', name: 'Reading', icon: '📖',
      blurb: 'Twenty pages a day.',
      habits: [
        { name: 'Read 20 pages', icon: '📖', schedule: { type: 'daily' }, description: 'Paper or e-ink, not a feed.' },
        { name: 'Journal 5 minutes', icon: '📝', schedule: { type: 'daily' }, description: 'One honest paragraph.' }
      ] }
  ];

  function listTemplates() {
    return TEMPLATES.map(function (t) {
      return {
        id: t.id, name: t.name, icon: t.icon, blurb: t.blurb, habitCount: t.habits.length,
        habits: t.habits.map(function (h) {
          return { name: h.name, icon: h.icon, schedule: normSchedule({ schedule: h.schedule }), description: h.description };
        })
      };
    });
  }

  function getTemplate(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return null;
  }

  function newTemplateHabitId(taken) {
    var id;
    do { id = 'h_' + Math.random().toString(36).slice(2, 10); } while (taken[id]);
    taken[id] = true;
    return id;
  }

  /**
   * Build habit objects from a template. selectedIndexes picks which of the
   * template's habits to instantiate; existingIds guards against id
   * collisions. Returns null for an unknown template.
   */
  function instantiateTemplate(templateId, selectedIndexes, existingIds, nowMs) {
    var t = getTemplate(templateId);
    if (!t) return null;
    var taken = {};
    (existingIds || []).forEach(function (id) { taken[id] = true; });
    var now = nowMs || Date.now();
    return (selectedIndexes || []).map(function (idx) {
      var h = t.habits[idx];
      if (!h) return null;
      return {
        id: newTemplateHabitId(taken), name: h.name, icon: h.icon,
        createdAt: now, archived: false,
        schedule: normSchedule({ schedule: h.schedule }),
        description: h.description || '', category: '', weeklyTarget: null
      };
    }).filter(Boolean);
  }

  /* ---------------- insights (Phase 3) ----------------
   * Read-only computations over local data for the Stats tab. All take the
   * plain `days` map and habit objects; none touch storage or the DOM.
   */

  function scheduledDaysInRange(schedule, fromKey, toKey) {
    var n = 0;
    var d = parseKey(fromKey);
    var guard = 0;
    while (dayKey(d) <= toKey && guard++ < 370) {
      if (isScheduledDay(schedule, dayKey(d))) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  function doneInRange(days, hid, fromKey, toKey) {
    var n = 0;
    var d = parseKey(fromKey);
    var guard = 0;
    while (dayKey(d) <= toKey && guard++ < 370) {
      if (isDoneIn(days, dayKey(d), hid)) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  /**
   * Per-weekday completion over a date range: [{ dow, done, scheduled, rate }].
   */
  function weekdayCompletion(days, habits, fromKey, toKey) {
    var out = [];
    for (var d = 0; d < 7; d++) out.push({ dow: d, done: 0, scheduled: 0, rate: 0 });
    var dd = parseKey(fromKey);
    var guard = 0;
    while (dayKey(dd) <= toKey && guard++ < 370) {
      var k = dayKey(dd);
      var dow = dd.getDay();
      (habits || []).forEach(function (h) {
        if (isScheduledDay(h.schedule, k)) {
          out[dow].scheduled++;
          if (isDoneIn(days, k, h.id)) out[dow].done++;
        }
      });
      dd.setDate(dd.getDate() + 1);
    }
    out.forEach(function (o) { o.rate = o.scheduled ? o.done / o.scheduled : 0; });
    return out;
  }

  /**
   * Aggregate insights for the Stats tab:
   * {
   *   bestWeekday: { dow, rate } | null,       // last 28 days, needs >= 4 scheduled
   *   mostConsistent: { id, name, icon, rate, done, scheduled } | null,
   *   thisWeek: { done, total }, lastWeek: { done, total },
   *   longestActiveStreak: { id, name, icon, n } | null
   * }
   */
  function insights(days, habits, today) {
    var act = (habits || []).filter(function (h) { return !h.archived; });
    var from = addDays(today, -27);

    var bestWeekday = null;
    weekdayCompletion(days, act, from, today).forEach(function (w) {
      if (w.scheduled >= 4 && (!bestWeekday || w.rate > bestWeekday.rate)) {
        bestWeekday = { dow: w.dow, rate: w.rate };
      }
    });

    var mostConsistent = null;
    act.forEach(function (h) {
      var sched = scheduledDaysInRange(h.schedule, from, today);
      if (sched < 7) return; // not enough history to judge
      var done = doneInRange(days, h.id, from, today);
      var rate = done / sched;
      if (!mostConsistent || rate > mostConsistent.rate) {
        mostConsistent = { id: h.id, name: h.name, icon: h.icon, rate: rate, done: done, scheduled: sched };
      }
    });

    var cw = isoWeekKey(today);
    var lw = addWeeks(cw, -1);
    var tw = { done: 0, total: 0 };
    var lwk = { done: 0, total: 0 };
    act.forEach(function (h) {
      var p1 = weekProgress(days, h, cw);
      var p2 = weekProgress(days, h, lw);
      tw.done += Math.min(p1.done, p1.target); tw.total += p1.target;
      lwk.done += Math.min(p2.done, p2.target); lwk.total += p2.target;
    });

    var longestActiveStreak = null;
    act.forEach(function (h) {
      var n = currentStreak(days, h.id, today, h.schedule);
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
    if (v < 2) {
      // v1 -> v2: flexible schedules + habit metadata (Phase 2). Every habit
      // gets a normalized schedule plus the new optional fields.
      s.habits.forEach(function (h) {
        h.schedule = normSchedule(h);
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

  return {
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    dayKey: dayKey,
    parseKey: parseKey,
    todayKey: todayKey,
    addDays: addDays,
    isDoneIn: isDoneIn,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    graceUsedThisWeek: graceUsedThisWeek,
    frozenDaysInRange: frozenDaysInRange,
    heatmapData: heatmapData,
    totalDone: totalDone,
    validateImport: validateImport,
    migrateState: migrateState,
    normSchedule: normSchedule,
    isScheduledDay: isScheduledDay,
    scheduleLabel: scheduleLabel,
    isoWeekKey: isoWeekKey,
    weekStartKey: weekStartKey,
    addWeeks: addWeeks,
    weekDoneCount: weekDoneCount,
    scheduledDaysInWeek: scheduledDaysInWeek,
    prevScheduledDay: prevScheduledDay,
    streakDays: streakDays,
    weeklyTargetFor: weeklyTargetFor,
    weekProgress: weekProgress,
    scheduledDaysInRange: scheduledDaysInRange,
    doneInRange: doneInRange,
    weekdayCompletion: weekdayCompletion,
    insights: insights,
    b64encode: b64encode,
    b64decode: b64decode,
    encryptBackup: encryptBackup,
    decryptBackup: decryptBackup,
    mergeStates: mergeStates,
    weeklyRates: weeklyRates,
    bestWeekday: bestWeekday,
    listTemplates: listTemplates,
    getTemplate: getTemplate,
    instantiateTemplate: instantiateTemplate
  };
});
