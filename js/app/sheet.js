/* Daily Habits — js/app/sheet.js
 * Bottom-sheet habit detail: per-day info, notes, and the 16-week heatmap.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var sheetHabit = null;               // habit id open in the bottom sheet

function openSheet(hid) { sheetHabit = hid; render(); }

function closeSheet() { sheetHabit = null; render(); }

var sheetTouchY = null;

function sheetTouchStart(e) { sheetTouchY = e.touches[0].clientY; }

function sheetTouchEnd(e) {
  if (sheetTouchY == null) return;
  var dy = e.changedTouches[0].clientY - sheetTouchY;
  sheetTouchY = null;
  if (dy > 90) closeSheet();
}

function fmtShort(key) {
  return parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sheetHtml(h, key) {
  var done = isDone(key, h.id);
  var e = dayEntry(key, h.id);
  var note = e && e.note ? e.note : '';
  var wp = DH.weekProgress(state.days, h, DH.isoWeekKey(key));
  var streakUnit = DH.normSchedule(h).type === 'timesPerWeek' ? 'wk' : 'day';
  return '<div class="sheet-backdrop" onclick="closeSheet()"></div>' +
  '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(h.name) + '"' +
    ' ontouchstart="sheetTouchStart(event)" ontouchend="sheetTouchEnd(event)">' +
    '<div class="sheet-grab"></div>' +
    '<div class="sheet-head"><div class="habit-ico">' + esc(h.icon) + '</div>' +
      '<div class="habit-meta"><div class="habit-name">' + esc(h.name) + '</div>' +
      '<div class="habit-sub">🔥 ' + currentStreak(h.id) + '-' + streakUnit + ' streak · ' + esc(scheduleLabel(h)) + '</div></div>' +
      '<button type="button" class="navbtn" onclick="closeSheet()" aria-label="Close">✕</button></div>' +
    (h.description ? '<p class="hint">' + esc(h.description) + '</p>' : '') +
    '<div class="stats">' +
      '<div class="stat"><b>' + currentStreak(h.id) + '</b><span>Current</span></div>' +
      '<div class="stat"><b>' + bestStreak(h.id) + '</b><span>Best</span></div>' +
      '<div class="stat"><b>' + totalDone(h.id) + '</b><span>Total</span></div>' +
    '</div>' +
    graceLine(h) +
    '<div class="sched-line">This week <b>' + wp.done + '/' + wp.target + '</b></div>' +
    weekStrip(key, h.id) +
    heatmapHtml(h) +
    '<div class="field"><label>Note for ' + esc(fmtLong(key)) + '</label>' +
      '<textarea class="note" placeholder="Add a note for this day…" ' +
      'onchange="setNote(\'' + key + '\',\'' + h.id + '\',this.value)">' + esc(note) + '</textarea></div>' +
    '<button type="button" class="btn sheet-cta" onclick="toggleDone(\'' + h.id + '\');closeSheet();">' +
      (done ? 'Uncheck for ' + esc(fmtShort(key)) : 'Mark done for ' + esc(fmtShort(key))) + '</button>' +
    '<button type="button" class="btn ghost" style="width:100%;margin-top:8px" onclick="shareHabit(\'' + h.id + '\')">Share streak</button>' +
  '</div>';
}

function heatmapHtml(h) {
  var cols = DH.heatmapData(state.days, h.id, h.schedule, todayKey(), 16);
  var html = '<div class="hm-label">Last 16 weeks</div>' +
    '<div class="heatmap" role="img" aria-label="Check-in history heatmap">';
  for (var w = 0; w < cols.length; w++) {
    html += '<div class="hm-col">';
    for (var i = 0; i < 7; i++) {
      var c = cols[w][i];
      html += '<div class="hm-cell hm-' + c.state + '" title="' + c.key + '"></div>';
    }
    html += '</div>';
  }
  return html + '</div>';
}

function graceLine(h) {
  if (DH.normSchedule(h).type === 'timesPerWeek') return '';
  var used = DH.graceUsedThisWeek(state.days, h.id, todayKey(), h.schedule);
  return '<p class="hint">' + (used > 0
    ? '❄️ Grace day saved your streak this week'
    : '❄️ One grace day per week — a single miss won\'t break your streak') + '</p>';
}
