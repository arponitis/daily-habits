/* Daily Habits — js/lib/merge.js
 * Union merge of two app states (check-ins unioned, habits deduped, local notes win).
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function mergeStates(base, incoming) {
    var out = JSON.parse(JSON.stringify(base || { v: DH.CURRENT_SCHEMA_VERSION, habits: [], days: {} }));
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
    out.v = DH.CURRENT_SCHEMA_VERSION;
    return out;
  }

  DH.mergeStates = mergeStates;
})();
