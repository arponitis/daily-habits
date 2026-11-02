/* Daily Habits — js/app/calendar.js
 * Calendar tab: month grid with backfill, streak highlights, and month summaries.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

function monthSummary(y, m, habits, today) {
  var done = 0, total = 0;
  var dim = new Date(y, m + 1, 0).getDate();
  for (var d = 1; d <= dim; d++) {
    var k = dayKey(new Date(y, m, d));
    for (var i = 0; i < habits.length; i++) {
      if (DH.isScheduledDay(habits[i].schedule, k)) {
        total++;
        if (isDone(k, habits[i].id)) done++;
      }
    }
  }
  return { done: done, total: total };
}

function renderCalendar() {
  var ym = viewMonth.split('-');
  var y = Number(ym[0]), m = Number(ym[1]) - 1;
  var first = new Date(y, m, 1);
  var startOffset = (first.getDay() + 6) % 7; // Monday-first
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var habits = activeHabits();
  var today = todayKey();

  var html = '<div class="cal-head">' +
    '<button type="button" class="navbtn" onclick="moveMonth(-1)" aria-label="Previous month">‹</button>' +
    '<div style="text-align:center"><b>' + first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</b>' +
    '<div><button type="button" class="today-pill" onclick="goToday()">Today</button></div></div>' +
    '<button type="button" class="navbtn" onclick="moveMonth(1)" aria-label="Next month">›</button></div>';

  // highlight days that belong to any habit's current streak
  var streakSet = {};
  habits.forEach(function (h) {
    DH.streakDays(state.days, h.id, today, h.schedule).forEach(function (k) { streakSet[k] = true; });
  });

  html += '<div class="cal-grid">';
  ['M','T','W','T','F','S','S'].forEach(function (d) { html += '<div class="cal-dow">' + d + '</div>'; });

  var cells = [];
  for (var i = 0; i < startOffset; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7) cells.push(null);

  cells.forEach(function (dt) {
    if (!dt) { html += '<div></div>'; return; }
    var k = dayKey(dt);
    var doneCount = habits.filter(function (h) { return isDone(k, h.id); }).length;
    var cls = 'cal-day' + (k === viewDate ? ' sel' : '') + (k > today ? ' future' : '') + (streakSet[k] ? ' streak' : '');
    var dots = '';
    for (var j = 0; j < Math.min(doneCount, 3); j++) dots += '<i></i>';
    html += '<button type="button" class="' + cls + '" onclick="pickDay(\'' + k + '\')">' +
            dt.getDate() + '<span class="dots">' + dots + '</span></button>';
  });
  html += '</div>';

  var ms = monthSummary(y, m, habits, today);
  html += '<div class="month-sum">' + ms.done + ' of ' + ms.total + ' scheduled check-ins this month</div>';

  // selected day detail
  html += '<div class="day-detail"><h3>' +
    (viewDate === today ? 'Today' : fmtLong(viewDate)) + '</h3>';
  if (!habits.length) {
    html += '<div class="empty"><div class="big">🌱</div><div>No habits yet.</div></div>';
  } else if (viewDate > today) {
    html += '<div class="empty"><div class="big">🔮</div><div>The future hasn\'t happened yet.</div></div>';
  } else {
    html += habits.map(function (h) { return habitCard(h, viewDate); }).join('');
  }
  html += '</div>';

  document.getElementById('view').innerHTML = html;
}

function moveMonth(n) {
  var ym = viewMonth.split('-');
  var d = new Date(Number(ym[0]), Number(ym[1]) - 1 + n, 1);
  viewMonth = dayKey(d).slice(0, 7);
  render();
}

function pickDay(k) {
  if (k > todayKey()) return;
  viewDate = k;
  sheetHabit = null;
  render();
}
