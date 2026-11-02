/* Daily Habits — js/app/stats.js
 * Stats tab: 12-week sparklines, strongest weekday, and weekly insights.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

function weekLabel(wkey, isCurrent) {
  if (isCurrent) return 'This wk';
  return parseKey(DH.weekStartKey(wkey)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderStats() {
  var habits = activeHabits();
  var today = todayKey();
  var curWeek = DH.isoWeekKey(today);
  var html = '';
  if (!habits.length) {
    html += '<div class="empty"><div class="big">📊</div><div>No habits yet.<br>Add your first one in the More tab.</div></div>';
  } else {
    var tDone = 0, tTotal = 0;
    var rows = habits.map(function (h) {
      var wp = DH.weekProgress(state.days, h, curWeek);
      tDone += Math.min(wp.done, wp.target);
      tTotal += wp.target;
      var weeks = [];
      for (var i = 3; i >= 0; i--) {
        var wk = DH.addWeeks(curWeek, -i);
        var wpr = DH.weekProgress(state.days, h, wk);
        weeks.push({ label: weekLabel(wk, i === 0), done: wpr.done, target: wpr.target });
      }
      return { h: h, wp: wp, weeks: weeks };
    });
    html += '<div class="card stats-top"><div><h2>This week</h2>' +
      '<p class="hint">' + tDone + ' of ' + tTotal + ' scheduled check-ins</p></div>' +
      '<div class="ring-wrap">' + ring(tTotal ? tDone / tTotal : 0, tDone + '/' + tTotal) + '</div></div>';
    html += insightsHtml(DH.insights(state.days, habits, today));
    rows.forEach(function (r) {
      var pct = r.wp.target ? Math.round(100 * Math.min(r.wp.done, r.wp.target) / r.wp.target) : 0;
      html += '<div class="card"><div class="srow-head"><span>' + esc(r.h.icon) + ' <b>' + esc(r.h.name) + '</b></span>' +
        '<span class="srow-num">' + r.wp.done + '/' + r.wp.target + '</span></div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="wk4">' + r.weeks.map(function (w) {
          var wpct = w.target ? Math.round(100 * Math.min(w.done, w.target) / w.target) : 0;
          return '<div class="wk"><div class="bar mini-bar"><div class="bar-fill" style="width:' + wpct + '%"></div></div>' +
                 '<div class="wk-l">' + esc(w.label) + '</div><div class="wk-n">' + w.done + '/' + w.target + '</div></div>';
        }).join('') + '</div></div>';
    });
  }
  document.getElementById('view').innerHTML = html;
}

var DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function insightsHtml(ins) {
  var items = [];
  if (ins.longestActiveStreak) {
    var s = ins.longestActiveStreak;
    items.push('<div class="insight"><span class="i-ico">🔥</span><div>Longest active streak: <b>' +
      esc(s.icon) + ' ' + esc(s.name) + '</b> at <b>' + s.n + '</b></div></div>');
  }
  if (ins.mostConsistent) {
    var m = ins.mostConsistent;
    items.push('<div class="insight"><span class="i-ico">🏆</span><div>Most consistent: <b>' +
      esc(m.icon) + ' ' + esc(m.name) + '</b> — ' + m.done + '/' + m.scheduled +
      ' (' + Math.round(100 * m.rate) + '%) over the last 4 weeks</div></div>');
  }
  if (ins.bestWeekday) {
    items.push('<div class="insight"><span class="i-ico">📅</span><div>Your best day is <b>' +
      DOW_NAMES[ins.bestWeekday.dow] + '</b> — ' + Math.round(100 * ins.bestWeekday.rate) +
      '% completion</div></div>');
  }
  if (ins.thisWeek.total || ins.lastWeek.total) {
    var arrow = ins.thisWeek.done > ins.lastWeek.done ? '📈'
      : (ins.thisWeek.done < ins.lastWeek.done ? '📉' : '➡️');
    items.push('<div class="insight"><span class="i-ico">' + arrow + '</span><div>This week <b>' +
      ins.thisWeek.done + '/' + ins.thisWeek.total + '</b> vs last week <b>' +
      ins.lastWeek.done + '/' + ins.lastWeek.total + '</b></div></div>');
  }
  if (!items.length) {
    return '<div class="card"><h2>Insights</h2>' +
      '<p class="hint">Check in for a few days and insights will appear here.</p></div>';
  }
  return '<div class="card"><h2>Insights</h2>' + items.join('') + '</div>';
}
