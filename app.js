'use strict';
/* Daily Habits — a private, offline-first habit tracker.
   All data lives in this device's localStorage under STORE_KEY. */

var STORE_KEY = 'daily-habits/v1';

var SEED_HABITS = [
  { name: 'Reading',    icon: '📖' },
  { name: 'Meditating', icon: '🧘' },
  { name: 'No sugar',   icon: '🚫' }
];

var EMOJI_CHOICES = ['📖','🧘','🚫','🏃','💧','📝','🎸','🧠','💪','🛌','🥗','🚭','📵','🎨','🌅','🧹'];

/* ---------------- state ---------------- */

function uid() { return 'h_' + Math.random().toString(36).slice(2, 10); }

function loadState() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && Array.isArray(s.habits) && s.days) return s;
    }
  } catch (e) { /* corrupted or unavailable storage -> start fresh */ }
  return {
    habits: SEED_HABITS.map(function (h) {
      return { id: uid(), name: h.name, icon: h.icon, createdAt: Date.now(), archived: false };
    }),
    days: {}
  };
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

var state = loadState();

/* UI state (not persisted) */
var viewDate  = todayKey();          // YYYY-MM-DD shown in check-in tab
var viewMonth = viewDate.slice(0, 7); // YYYY-MM shown in calendar tab
var activeTab = 'checkin';
var openCard  = null;                // habit id expanded in check-in tab
var newIcon   = EMOJI_CHOICES[3];    // default icon for the add-habit form

/* ---------------- date helpers (local time) ---------------- */

function pad(n) { return String(n).padStart(2, '0'); }

function dayKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseKey(k) {
  var p = k.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function todayKey() { return dayKey(new Date()); }

function addDays(key, n) {
  var d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function fmtLong(key) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ---------------- data access ---------------- */

function activeHabits() { return state.habits.filter(function (h) { return !h.archived; }); }

function dayEntry(key, hid) {
  return (state.days[key] && state.days[key][hid]) || null;
}

function isDone(key, hid) {
  var e = dayEntry(key, hid);
  return !!(e && e.done);
}

function setDone(key, hid, done) {
  if (!state.days[key]) state.days[key] = {};
  var e = state.days[key][hid] || (state.days[key][hid] = {});
  e.done = done;
  prune(key, hid);
  saveState();
}

function setNote(key, hid, note) {
  if (!state.days[key]) state.days[key] = {};
  var e = state.days[key][hid] || (state.days[key][hid] = {});
  e.note = note;
  prune(key, hid);
  saveState();
}

function prune(key, hid) {
  var e = state.days[key] && state.days[key][hid];
  if (e && !e.done && !e.note) delete state.days[key][hid];
  if (state.days[key] && Object.keys(state.days[key]).length === 0) delete state.days[key];
}

/* ---------------- stats ---------------- */

function currentStreak(hid) {
  var s = 0;
  var d = new Date();
  if (!isDone(dayKey(d), hid)) d.setDate(d.getDate() - 1); // today unchecked: streak alive from yesterday
  while (isDone(dayKey(d), hid)) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

function bestStreak(hid) {
  var best = 0, cur = 0, prev = null;
  var keys = Object.keys(state.days).sort();
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!isDone(k, hid)) { cur = 0; prev = null; continue; }
    var t = parseKey(k).getTime();
    cur = (prev !== null && t - prev === 86400000) ? cur + 1 : 1;
    prev = t;
    if (cur > best) best = cur;
  }
  return best;
}

function totalDone(hid) {
  return Object.keys(state.days).filter(function (k) { return isDone(k, hid); }).length;
}

/* ---------------- habit management ---------------- */

function addHabit() {
  var input = document.getElementById('newHabitName');
  var name = (input.value || '').trim();
  if (!name) { input.focus(); return; }
  state.habits.push({ id: uid(), name: name, icon: newIcon, createdAt: Date.now(), archived: false });
  saveState();
  render();
}

function pickIcon(el, icon) {
  newIcon = icon;
  var btns = document.querySelectorAll('.emoji-pick');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('sel');
  el.classList.add('sel');
}

function renameHabit(hid) {
  var h = state.habits.find(function (x) { return x.id === hid; });
  if (!h) return;
  var name = prompt('Rename habit', h.name);
  if (name && name.trim()) { h.name = name.trim(); saveState(); render(); }
}

function toggleArchive(hid) {
  var h = state.habits.find(function (x) { return x.id === hid; });
  if (!h) return;
  h.archived = !h.archived;
  saveState();
  render();
}

function deleteHabit(hid) {
  var h = state.habits.find(function (x) { return x.id === hid; });
  if (!h) return;
  if (!confirm('Delete "' + h.name + '" and all its history?')) return;
  state.habits = state.habits.filter(function (x) { return x.id !== hid; });
  Object.keys(state.days).forEach(function (k) {
    if (state.days[k][hid]) delete state.days[k][hid];
    if (Object.keys(state.days[k]).length === 0) delete state.days[k];
  });
  saveState();
  render();
}

/* ---------------- import / export ---------------- */

function exportData() {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'daily-habits-export-' + todayKey() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

function triggerImport() { document.getElementById('importFile').click(); }

function handleImport(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var s = JSON.parse(r.result);
      if (!s || !Array.isArray(s.habits) || !s.days) throw new Error('bad file');
      state = s;
      saveState();
      render();
      alert('Import complete.');
    } catch (e) {
      alert('Could not import that file — it is not a Daily Habits export.');
    }
    input.value = '';
  };
  r.readAsText(f);
}

function wipeData() {
  if (!confirm('Delete ALL habits and history on this device? This cannot be undone.')) return;
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  viewDate = todayKey();
  viewMonth = viewDate.slice(0, 7);
  saveState();
  render();
}

/* ---------------- rendering ---------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function renderHeader() {
  var habits = activeHabits();
  var key = todayKey();
  var done = habits.filter(function (h) { return isDone(key, h.id); }).length;
  document.getElementById('dateLine').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('dayRing').innerHTML = ring(habits.length ? done / habits.length : 0, done + '/' + habits.length);
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
  var e = dayEntry(key, h.id);
  var open = openCard === h.id;
  var note = e && e.note ? e.note : '';
  var html = '<div class="habit' + (done ? ' done' : '') + '">' +
    '<div class="habit-row" onclick="toggleCard(\'' + h.id + '\')">' +
      '<div class="habit-ico">' + esc(h.icon) + '</div>' +
      '<div class="habit-meta"><div class="habit-name">' + esc(h.name) + '</div>' +
      '<div class="habit-sub">🔥 ' + currentStreak(h.id) + '-day streak</div></div>' +
      '<button type="button" class="check' + (done ? ' on' : '') + '" ' +
        'onclick="event.stopPropagation();toggleDone(\'' + h.id + '\')" aria-label="Toggle ' + esc(h.name) + '">✓</button>' +
    '</div>';
  if (open) {
    html += '<div class="habit-detail">' +
      '<div class="stats">' +
        '<div class="stat"><b>' + currentStreak(h.id) + '</b><span>Current</span></div>' +
        '<div class="stat"><b>' + bestStreak(h.id) + '</b><span>Best</span></div>' +
        '<div class="stat"><b>' + totalDone(h.id) + '</b><span>Total</span></div>' +
      '</div>' +
      weekStrip(key, h.id) +
      '<textarea class="note" placeholder="Add a note for this day…" ' +
        'onchange="setNote(\'' + key + '\',\'' + h.id + '\',this.value)">' + esc(note) + '</textarea>' +
    '</div>';
  }
  return html + '</div>';
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

  if (!habits.length) {
    html += '<div class="empty"><div class="big">🌱</div><div>No habits yet.<br>Add your first one in the More tab.</div></div>';
  } else {
    html += habits.map(function (h) { return habitCard(h, key); }).join('');
  }
  document.getElementById('view').innerHTML = html;
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
    '<b>' + first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</b>' +
    '<button type="button" class="navbtn" onclick="moveMonth(1)" aria-label="Next month">›</button></div>';

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
    var cls = 'cal-day' + (k === viewDate ? ' sel' : '') + (k > today ? ' future' : '');
    var dots = '';
    for (var j = 0; j < Math.min(doneCount, 3); j++) dots += '<i></i>';
    html += '<button type="button" class="' + cls + '" onclick="pickDay(\'' + k + '\')">' +
            dt.getDate() + '<span class="dots">' + dots + '</span></button>';
  });
  html += '</div>';

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

function renderMore() {
  var html = '<div class="card"><h2>Add a habit</h2><p class="hint">Small, daily, checkable. That\'s the whole trick.</p>' +
    '<div class="field"><label for="newHabitName">Name</label>' +
    '<input id="newHabitName" class="text-in" maxlength="40" placeholder="e.g. Read 20 pages" autocomplete="off"></div>' +
    '<div class="field"><label>Icon</label><div class="emoji-row">' +
    EMOJI_CHOICES.map(function (e) {
      return '<button type="button" class="emoji-pick' + (e === newIcon ? ' sel' : '') +
             '" onclick="pickIcon(this,\'' + e + '\')">' + e + '</button>';
    }).join('') + '</div></div>' +
    '<button type="button" class="btn" onclick="addHabit()">Add habit</button></div>';

  html += '<div class="card"><h2>Your habits</h2><p class="hint">Archived habits keep their history but leave the daily list.</p>';
  if (!state.habits.length) {
    html += '<p class="hint">None yet.</p>';
  } else {
    html += state.habits.map(function (h) {
      return '<div class="manage-row"><div class="m-ico">' + esc(h.icon) + '</div>' +
        '<div class="m-name">' + esc(h.name) +
        (h.archived ? ' <small>archived</small>' : ' <small>🔥 ' + currentStreak(h.id) + ' day streak</small>') + '</div>' +
        '<button type="button" class="mini" onclick="renameHabit(\'' + h.id + '\')">Rename</button>' +
        '<button type="button" class="mini" onclick="toggleArchive(\'' + h.id + '\')">' + (h.archived ? 'Unarchive' : 'Archive') + '</button>' +
        '<button type="button" class="mini danger" onclick="deleteHabit(\'' + h.id + '\')">Delete</button></div>';
    }).join('');
  }
  html += '</div>';

  html += '<div class="card"><h2>Data</h2><p class="hint">Your data never leaves this device unless you export it.</p>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="exportData()">Export</button>' +
    '<button type="button" class="btn ghost" onclick="triggerImport()">Import</button></div>' +
    '<div style="height:10px"></div>' +
    '<button type="button" class="btn danger" onclick="wipeData()">Delete all data</button></div>';

  html += '<div class="card"><h2>About</h2><p class="hint">Daily Habits v1.0 — check in once a day, watch the streaks grow. ' +
    'Add to your home screen for the full app feel.</p></div>';

  document.getElementById('view').innerHTML = html;
}

function render() {
  renderHeader();
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.tab === activeTab);
  }
  if (activeTab === 'checkin') renderCheckin();
  else if (activeTab === 'calendar') renderCalendar();
  else renderMore();
  window.scrollTo(0, 0);
}

/* ---------------- UI actions (called from inline handlers) ---------------- */

function toggleCard(hid) { openCard = (openCard === hid) ? null : hid; render(); }

function toggleDone(hid) {
  setDone(viewDate, hid, !isDone(viewDate, hid));
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

function moveMonth(n) {
  var ym = viewMonth.split('-');
  var d = new Date(Number(ym[0]), Number(ym[1]) - 1 + n, 1);
  viewMonth = dayKey(d).slice(0, 7);
  render();
}

function pickDay(k) {
  if (k > todayKey()) return;
  viewDate = k;
  openCard = null;
  render();
}

function switchTab(tab) { activeTab = tab; render(); }

/* ---------------- boot ---------------- */

document.querySelectorAll('.tab').forEach(function (btn) {
  btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
});
document.getElementById('importFile').addEventListener('change', function () { handleImport(this); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'newHabitName') addHabit();
});

saveState(); // persist seed on first run
render();
