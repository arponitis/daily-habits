/* Daily Habits — js/app/checkin.js
 * Check-in tab: the daily habit list, progress ring, one-tap toggles, undo, and day navigation.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var viewDate  = todayKey();          // YYYY-MM-DD shown in check-in tab

var viewMonth = viewDate.slice(0, 7); // YYYY-MM shown in calendar tab

function fmtLong(key) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function ring(pct, label) {
  var r = 26, c = 2 * Math.PI * r;
  var off = c * (1 - Math.min(1, Math.max(0, pct)));
  return '<svg viewBox="0 0 64 64" class="ring" aria-hidden="true">' +
    '<circle cx="32" cy="32" r="' + r + '" class="ring-bg"/>' +
    '<circle cx="32" cy="32" r="' + r + '" class="ring-fg" stroke-dasharray="' + c.toFixed(1) +
    '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
    '<text x="32" y="33" class="ring-text">' + esc(label) + '</text></svg>';
}

function weekStrip(key, hid) {
  var html = '<div class="week">';
  for (var i = 6; i >= 0; i--) {
    var k = addDays(key, -i);
    var on = isDone(k, hid);
    var dl = parseKey(k).toLocaleDateString(undefined, { weekday: 'narrow' });
    html += '<div class="wday"><div class="dot' + (on ? ' on' : '') + '">✓</div>' +
            '<div class="dl">' + dl + '</div></div>';
  }
  return html + '</div>';
}

function habitCard(h, key) {
  var done = isDone(key, h.id);
  var scheduled = isScheduledOn(h, key);
  var streakUnit = DH.normSchedule(h).type === 'timesPerWeek' ? 'wk' : 'day';
  var sub = scheduled
    ? '🔥 ' + currentStreak(h.id) + '-' + streakUnit + ' streak · ' + esc(scheduleLabel(h))
    : 'Rest day · ' + esc(scheduleLabel(h));
  if (h.category) sub += ' · ' + esc(h.category);
  return '<div class="habit' + (done ? ' done' : '') + (scheduled ? '' : ' rest') + '">' +
    '<div class="habit-row" onclick="openSheet(\'' + h.id + '\')">' +
      '<div class="habit-ico">' + esc(h.icon) + '</div>' +
      '<div class="habit-meta"><div class="habit-name">' + esc(h.name) + '</div>' +
      '<div class="habit-sub">' + sub + '</div></div>' +
      '<button type="button" class="check' + (done ? ' on' : '') + '" aria-pressed="' + done + '" ' +
        'onclick="event.stopPropagation();toggleDone(\'' + h.id + '\')" aria-label="Toggle ' + esc(h.name) + '">✓</button>' +
    '</div></div>';
}

function renderCheckin() {
  var key = viewDate;
  var isToday = key === todayKey();
  var habits = activeHabits();
  var html = '<div class="daynav">' +
    '<button type="button" class="navbtn" onclick="moveDay(-1)" aria-label="Previous day">‹</button>' +
    '<div style="text-align:center"><div class="dlabel">' +
      (isToday ? 'Today' : fmtLong(key)) + '</div>' +
      (!isToday ? '<button type="button" class="today-pill" onclick="goToday()">Back to today</button>' : '') +
    '</div>' +
    '<button type="button" class="navbtn" onclick="moveDay(1)" ' + (isToday ? 'disabled' : '') + ' aria-label="Next day">›</button>' +
  '</div>';

  if (onboardingStep) html += onboardingHtml();
  else if (!isOnboarded()) html += welcomeHtml();
  else if (!isTipSeen() && !hasAnyCheckin() && activeHabits().length) html += tipCardHtml();

  // category filter chips
  var cats = [];
  habits.forEach(function (h) {
    var c = (h.category || '').trim();
    if (c && cats.indexOf(c) === -1) cats.push(c);
  });
  if (cats.length) {
    html += '<div class="chips" role="group" aria-label="Filter by category">' +
      '<button type="button" class="chip' + (activeCat === 'All' ? ' sel' : '') + '" aria-pressed="' + (activeCat === 'All') + '"' +
            '" onclick="setCat(\'All\')">All</button>' +
      cats.map(function (c) {
        return '<button type="button" class="chip' + (activeCat === c ? ' sel' : '') + '" aria-pressed="' + (activeCat === c) + '"' +
               ' data-c="' + esc(c) + '" onclick="setCat(this.getAttribute(\'data-c\'))">' + esc(c) + '</button>';
      }).join('') + '</div>';
    if (activeCat !== 'All') {
      habits = habits.filter(function (h) { return (h.category || '').trim() === activeCat; });
    }
  }

  if (!habits.length) {
    html += '<div class="empty"><div class="big">🌱</div><div>' +
      (activeHabits().length ? 'No habits in this category.' : 'No habits yet.<br>Add your first one in the More tab.') +
      '</div></div>';
  } else {
    // scheduled first, incomplete before done, rest days last
    habits = habits.slice().sort(function (a, b) {
      var sa = isScheduledOn(a, key) ? 0 : 1;
      var sb = isScheduledOn(b, key) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (isDone(key, a.id) ? 1 : 0) - (isDone(key, b.id) ? 1 : 0);
    });
    html += habits.map(function (h) { return habitCard(h, key); }).join('');
  }
  document.getElementById('view').innerHTML = html;
}

var undoStack = [];

function habitName(hid) {
  var h = habitById(hid);
  return h ? h.name : 'Habit';
}

function allScheduledDoneToday() {
  var key = todayKey();
  var sched = activeHabits().filter(function (h) { return isScheduledOn(h, key); });
  return sched.length > 0 && sched.every(function (h) { return isDone(key, h.id); });
}

function toggleDone(hid) {
  var key = viewDate;
  var prev = isDone(key, hid);
  setDone(key, hid, !prev);
  if (!prev && !isTipSeen()) { try { localStorage.setItem(TIP_KEY, '1'); } catch (e) {} }
  undoStack.push({ key: key, hid: hid, prev: prev });
  if (undoStack.length > 20) undoStack.shift();
  render();
  if (!prev && allScheduledDoneToday()) {
    var celebrated = null;
    try { celebrated = localStorage.getItem('daily-habits/celebrated'); } catch (e) {}
    if (celebrated !== key) {
      try { localStorage.setItem('daily-habits/celebrated', key); } catch (e) {}
      showToast('🎉 All done for today — streaks secured!', 'Undo', undoLast);
      return;
    }
  }
  showToast((prev ? 'Unchecked ' : 'Checked ') + habitName(hid), 'Undo', undoLast);
}

function undoLast() {
  var u = undoStack.pop();
  if (!u) return;
  setDone(u.key, u.hid, u.prev);
  render();
}

function moveDay(n) {
  var next = addDays(viewDate, n);
  if (next > todayKey()) return;
  viewDate = next;
  viewMonth = viewDate.slice(0, 7);
  render();
}

function goToday() {
  viewDate = todayKey();
  viewMonth = viewDate.slice(0, 7);
  render();
}
