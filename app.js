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

function loadRaw() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && typeof s === 'object') return s;
    }
  } catch (e) { /* corrupted or unavailable storage -> start fresh */ }
  return null;
}

function seedState() {
  return {
    v: DH.CURRENT_SCHEMA_VERSION,
    habits: SEED_HABITS.map(function (h) {
      return { id: uid(), name: h.name, icon: h.icon, createdAt: Date.now(), archived: false,
               schedule: { type: 'daily' }, description: '', category: '', weeklyTarget: null };
    }),
    days: {}
  };
}

function saveState() {
  state.v = DH.CURRENT_SCHEMA_VERSION;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) {
    showToast('⚠️ Could not save — storage may be full. Export your data!', 'Export', exportData);
  }
}

/* Stash a copy under a backup key instead of ever silently wiping user data. */
function backupRaw(raw) {
  try {
    if (raw) localStorage.setItem(STORE_KEY + '.backup-' + Date.now(), raw);
  } catch (e) {}
}

var state;
try {
  state = DH.migrateState(loadRaw() || seedState());
} catch (e) {
  // Payload claims a schema newer than this build understands: back it up
  // and start fresh rather than destroying it.
  backupRaw(localStorage.getItem(STORE_KEY));
  state = seedState();
}

/* ---------------- shared pure logic (lib.js) ----------------
 * Date/streak logic lives in lib.js (globalThis.DH) so it is unit tested in
 * Node. These thin wrappers are defined before first use and keep the app.js
 * call sites readable. */
var dayKey = DH.dayKey;
var parseKey = DH.parseKey;
var todayKey = DH.todayKey;
var addDays = DH.addDays;

function currentStreak(hid) { var h = habitById(hid); return DH.currentStreak(state.days, hid, todayKey(), h && h.schedule); }
function bestStreak(hid) { var h = habitById(hid); return DH.bestStreak(state.days, hid, h && h.schedule); }
function totalDone(hid) { return DH.totalDone(state.days, hid); }

function habitById(hid) { return state.habits.find(function (x) { return x.id === hid; }); }

/* Phase 2 helpers */
function isScheduledOn(h, key) { return DH.isScheduledDay(h.schedule, key); }
function scheduleLabel(h) { return DH.scheduleLabel(h.schedule); }

/* UI state (not persisted) */
var viewDate  = todayKey();          // YYYY-MM-DD shown in check-in tab
var viewMonth = viewDate.slice(0, 7); // YYYY-MM shown in calendar tab
var activeTab = 'checkin';
var sheetHabit = null;               // habit id open in the bottom sheet
var newIcon   = EMOJI_CHOICES[3];    // default icon for the add-habit form
var newScheduleType = 'daily';       // add-habit form: daily | weekdays | timesPerWeek
var newWeekdays = [1, 2, 3, 4, 5];   // add-habit form weekday selection
var activeCat = 'All';               // check-in category filter
var editingHabit = null;             // habit id with open editor in More tab

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
  if (typeof e.done !== 'boolean') e.done = false; // keep entries valid for export/import
  prune(key, hid);
  saveState();
}

function prune(key, hid) {
  var e = state.days[key] && state.days[key][hid];
  if (e && !e.done && !e.note) delete state.days[key][hid];
  if (state.days[key] && Object.keys(state.days[key]).length === 0) delete state.days[key];
}

/* ---------------- stats (see lib.js) ---------------- */

/* ---------------- habit management ---------------- */

function newScheduleFromForm() {
  if (newScheduleType === 'weekdays') {
    return { type: 'weekdays', days: newWeekdays.slice().sort(function (a, b) { return a - b; }) };
  }
  if (newScheduleType === 'timesPerWeek') {
    var n = parseInt((document.getElementById('newTimes') || {}).value, 10);
    return { type: 'timesPerWeek', times: Math.max(1, Math.min(7, n || 3)) };
  }
  return { type: 'daily' };
}

function addHabit() {
  var input = document.getElementById('newHabitName');
  var name = (input.value || '').trim();
  if (!name) { input.focus(); return; }
  var descEl = document.getElementById('newDesc');
  var catEl = document.getElementById('newCat');
  state.habits.push({
    id: uid(), name: name, icon: newIcon, createdAt: Date.now(), archived: false,
    schedule: DH.normSchedule({ schedule: newScheduleFromForm() }),
    description: descEl ? descEl.value.trim().slice(0, 80) : '',
    category: catEl ? catEl.value.trim().slice(0, 24) : '',
    weeklyTarget: null
  });
  saveState();
  // reset the form
  newScheduleType = 'daily';
  newWeekdays = [1, 2, 3, 4, 5];
  newIcon = EMOJI_CHOICES[3];
  render();
}

function pickSchedType(el, type) {
  newScheduleType = type;
  var btns = document.querySelectorAll('#newSchedSeg .seg-btn');
  for (var i = 0; i < btns.length; i++) {
    var on = btns[i] === el;
    btns[i].classList.toggle('sel', on);
    btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.getElementById('newWeekdaysWrap').hidden = type !== 'weekdays';
  document.getElementById('newTimesWrap').hidden = type !== 'timesPerWeek';
}

function toggleNewWeekday(el) {
  var d = Number(el.getAttribute('data-d'));
  var i = newWeekdays.indexOf(d);
  if (i === -1) newWeekdays.push(d); else newWeekdays.splice(i, 1);
  var on = i === -1;
  el.classList.toggle('sel', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function pickIcon(el, icon) {
  newIcon = icon;
  var btns = document.querySelectorAll('.emoji-pick');
  for (var i = 0; i < btns.length; i++) {
    var on = btns[i] === el;
    btns[i].classList.toggle('sel', on);
    btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  el.classList.add('sel');
}

function toggleEditor(hid) { editingHabit = (editingHabit === hid) ? null : hid; render(); }

function toggleEditWeekday(el) {
  var on = !el.classList.contains('sel');
  el.classList.toggle('sel', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function editSchedChanged(hid) {
  var st = document.getElementById('edit-sched-' + hid).value;
  document.getElementById('edit-wdays-' + hid).hidden = st !== 'weekdays';
  document.getElementById('edit-times-' + hid).hidden = st !== 'timesPerWeek';
}

function editorHtml(h) {
  var s = DH.normSchedule(h);
  var dayBtns = ['S','M','T','W','T','F','S'].map(function (lbl, i) {
    var on = !!(s.days && s.days.indexOf(i) !== -1);
    return '<button type="button" class="day-btn' + (on ? ' sel' : '') + '" aria-pressed="' + on + '"' +
           ' data-d="' + i + '" onclick="toggleEditWeekday(this)" aria-label="' + DOW_NAMES[i] + '">' + lbl + '</button>';
  }).join('');
  return '<div class="editor">' +
    '<div class="field"><label>Name</label>' +
      '<input id="edit-name-' + h.id + '" class="text-in" maxlength="40" value="' + esc(h.name) + '"></div>' +
    '<div class="field"><label>Description</label>' +
      '<input id="edit-desc-' + h.id + '" class="text-in" maxlength="80" value="' + esc(h.description || '') + '"></div>' +
    '<div class="field"><label>Category</label>' +
      '<input id="edit-cat-' + h.id + '" class="text-in" maxlength="24" value="' + esc(h.category || '') + '"></div>' +
    '<div class="field"><label>Schedule</label>' +
      '<select id="edit-sched-' + h.id + '" class="text-in" onchange="editSchedChanged(\'' + h.id + '\')">' +
        '<option value="daily"' + (s.type === 'daily' ? ' selected' : '') + '>Daily</option>' +
        '<option value="weekdays"' + (s.type === 'weekdays' ? ' selected' : '') + '>Specific days</option>' +
        '<option value="timesPerWeek"' + (s.type === 'timesPerWeek' ? ' selected' : '') + '>Times per week</option>' +
      '</select></div>' +
    '<div class="field" id="edit-wdays-' + h.id + '"' + (s.type === 'weekdays' ? '' : ' hidden') + '>' +
      '<label>Which days</label><div class="day-pick">' + dayBtns + '</div></div>' +
    '<div class="field" id="edit-times-' + h.id + '"' + (s.type === 'timesPerWeek' ? '' : ' hidden') + '>' +
      '<label>Times per week</label>' +
      '<input id="edit-times-in-' + h.id + '" type="number" min="1" max="7" class="text-in" value="' + (s.times || 3) + '"></div>' +
    '<div class="field"><label>Weekly target <span class="opt">(optional)</span></label>' +
      '<input id="edit-target-' + h.id + '" type="number" min="1" max="21" class="text-in" ' +
        'placeholder="defaults to scheduled days" value="' + (h.weeklyTarget || '') + '"></div>' +
    '<div class="btn-row"><button type="button" class="btn" onclick="saveHabitEdit(\'' + h.id + '\')">Save</button>' +
    '<button type="button" class="btn ghost" onclick="toggleEditor(\'' + h.id + '\')">Cancel</button></div>' +
  '</div>';
}

function saveHabitEdit(hid) {
  var h = habitById(hid);
  if (!h) return;
  var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
  var name = val('edit-name-' + hid).trim();
  if (name) h.name = name.slice(0, 40);
  h.description = val('edit-desc-' + hid).trim().slice(0, 80);
  h.category = val('edit-cat-' + hid).trim().slice(0, 24);
  var st = val('edit-sched-' + hid);
  if (st === 'weekdays') {
    var days = [];
    var btns = document.querySelectorAll('#edit-wdays-' + hid + ' .day-btn.sel');
    for (var i = 0; i < btns.length; i++) days.push(Number(btns[i].getAttribute('data-d')));
    h.schedule = { type: 'weekdays', days: days };
  } else if (st === 'timesPerWeek') {
    var n = parseInt(val('edit-times-in-' + hid), 10);
    h.schedule = { type: 'timesPerWeek', times: Math.max(1, Math.min(7, n || 3)) };
  } else {
    h.schedule = { type: 'daily' };
  }
  h.schedule = DH.normSchedule(h);
  var t = parseInt(val('edit-target-' + hid), 10);
  h.weeklyTarget = (t > 0) ? Math.min(21, t) : null;
  editingHabit = null;
  saveState();
  render();
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

/* ---------------- encrypted backup ---------------- */

function downloadFile(name, text) {
  var blob = new Blob([text], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

function getWebCrypto() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) return window.crypto;
  return null;
}

async function exportEncrypted() {
  var c = getWebCrypto();
  if (!c) { alert('Encrypted backup needs WebCrypto (use HTTPS or localhost).'); return; }
  var pw = prompt('Set a password for this encrypted backup:');
  if (!pw) return;
  if (prompt('Repeat the password:') !== pw) { alert('Passwords did not match.'); return; }
  try {
    var payload = await DH.encryptBackup(c, JSON.stringify(state), pw);
    downloadFile('daily-habits-backup-' + todayKey() + '.enc.json', JSON.stringify(payload, null, 2));
    showToast('🔐 Encrypted backup downloaded');
  } catch (e) {
    alert('Could not create the backup: ' + (e && e.message ? e.message : e));
  }
}

function triggerEncryptedImport() { document.getElementById('importEncFile').click(); }

function applyImportedState(incoming, label) {
  var merge = confirm('Merge into your current data?\n\nOK = merge (union of both devices)\nCancel = replace everything');
  try {
    state = merge ? DH.migrateState(DH.mergeStates(state, incoming)) : DH.migrateState(incoming);
  } catch (merr) {
    alert('Could not import: ' + merr.message);
    return;
  }
  saveState();
  render();
  alert(label + (merge ? ' merged.' : ' replaced.'));
}

function handleEncryptedImport(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var c = getWebCrypto();
  if (!c) { alert('Encrypted import needs WebCrypto (use HTTPS or localhost).'); input.value = ''; return; }
  var r = new FileReader();
  r.onload = function () {
    (async function () {
      try {
        var payload = JSON.parse(r.result);
        var pw = prompt('Password for this backup:');
        if (!pw) return;
        var json;
        try { json = await DH.decryptBackup(c, payload, pw); }
        catch (de) { alert('Could not decrypt — wrong password or a corrupted file.'); return; }
        var s = JSON.parse(json);
        var check = DH.validateImport(s);
        if (!check.ok) {
          alert('Backup contents are invalid:\n- ' + check.errors.slice(0, 5).join('\n- '));
          return;
        }
        applyImportedState(s, 'Backup');
      } catch (e) {
        alert('Could not read that backup file.');
      } finally {
        input.value = '';
      }
    })();
  };
  r.readAsText(f);
}

/* ---------------- share ---------------- */

function shareHabit(hid) {
  var h = habitById(hid);
  if (!h) return;
  var unit = DH.normSchedule(h).type === 'timesPerWeek' ? 'week' : 'day';
  var text = '🔥 ' + currentStreak(h.id) + '-' + unit + ' streak on "' + h.name + '" — tracked with Daily Habits';
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Daily Habits', text: text }).catch(function () {});
  } else if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { showToast('Copied to clipboard!'); });
  } else {
    prompt('Copy your streak:', text);
  }
}

/* ---------------- deep link ---------------- */

function handleDeepLink() {
  if (typeof window === 'undefined' || !window.location || !window.location.search) return;
  var m = /[?&]toggle=([^&]+)/.exec(window.location.search);
  if (!m) return;
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  var h = habitById(decodeURIComponent(m[1]));
  if (!h || h.archived) return;
  var key = todayKey();
  if (!isDone(key, h.id)) {
    setDone(key, h.id, true);
    showToast('Checked in: ' + h.name + ' ✓');
  }
}

/* ---------------- import / export ---------------- */

function exportData() {
  downloadFile('daily-habits-export-' + todayKey() + '.json', JSON.stringify(state, null, 2));
}

function triggerImport() { document.getElementById('importFile').click(); }

function handleImport(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var s = JSON.parse(r.result);
      var check = DH.validateImport(s);
      if (!check.ok) {
        alert('Could not import that file:\n- ' + check.errors.slice(0, 5).join('\n- '));
        return;
      }
      applyImportedState(s, 'Import');
    } catch (e) {
      alert('Could not import that file — it is not valid JSON.');
    }
    input.value = '';
  };
  r.readAsText(f);
}

function wipeData() {
  if (!confirm('Delete ALL habits and history on this device? This cannot be undone.')) return;
  backupRaw(localStorage.getItem(STORE_KEY)); // recoverable copy, just in case
  localStorage.removeItem(STORE_KEY);
  state = seedState();
  viewDate = todayKey();
  viewMonth = viewDate.slice(0, 7);
  saveState();
  render();
}

/* ---------------- reminders ---------------- */

var REM_KEY = 'daily-habits/v1.reminder';

function getReminder() {
  try {
    var r = JSON.parse(localStorage.getItem(REM_KEY));
    if (r && typeof r === 'object') return { time: r.time || '', lastFired: r.lastFired || '' };
  } catch (e) {}
  return { time: '', lastFired: '' };
}

function setReminder(r) {
  try { localStorage.setItem(REM_KEY, JSON.stringify(r)); } catch (e) {}
}

function saveReminderTime() {
  var el = document.getElementById('reminderTime');
  var r = getReminder();
  r.time = el ? el.value : '';
  setReminder(r);
  render();
  if (r.time) showToast('⏰ Reminder set for ' + r.time);
  syncPushSubscription();
}

function enableNotifications(cb) {
  if (!('Notification' in window)) { alert('This browser does not support notifications.'); return; }
  if (Notification.permission === 'granted') { syncPushSubscription(); if (cb) cb(); return; }
  Notification.requestPermission().then(function (p) {
    if (p === 'granted') { syncPushSubscription(); if (cb) cb(); render(); }
    else alert('Notifications are blocked — enable them in your browser settings to get reminders.');
  });
}

function testReminder() {
  enableNotifications(function () { fireReminder(true); });
}

function fireReminder(isTest) {
  var key = todayKey();
  var remaining = activeHabits().filter(function (h) { return isScheduledOn(h, key) && !isDone(key, h.id); });
  var n = remaining.length;
  var body = isTest ? 'Reminders are working — you will be nudged at your set time.'
    : (n ? n + ' habit' + (n === 1 ? '' : 's') + ' left today — keep the streak alive!'
         : 'All done for today. Nice work!');
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Daily Habits ⏰', { body: body }); } catch (e) { /* ignore */ }
  }
  showToast('⏰ ' + body);
}

function checkReminder() {
  var r = getReminder();
  if (!r.time) return;
  var now = new Date();
  var hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var today = todayKey();
  if (hm >= r.time && r.lastFired !== today) {
    r.lastFired = today;
    setReminder(r);
    fireReminder(false);
  }
}

/* ---------------- web push reminders (Phase A #46) ----------------
   Server-assisted reminders that fire when the app is closed. Needs the
   push worker deployed (see worker/PUSH_SETUP.md). Until PUSH_ENDPOINT and
   VAPID_PUBLIC_KEY are set, this section is inert and reminders stay
   local-only via the in-app scheduler above. All network failures fall
   back to local reminders silently. */

var PUSH_ENDPOINT = ''; // e.g. 'https://daily-habits-push.<you>.workers.dev'
var VAPID_PUBLIC_KEY = ''; // public VAPID key — safe to commit

function urlBase64ToUint8Array(b64) {
  var padding = '='.repeat((4 - (b64.length % 4)) % 4);
  var raw = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  var bin = typeof atob === 'function' ? atob(raw) : Buffer.from(raw, 'base64').toString('binary');
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pushSupported() {
  return !!(PUSH_ENDPOINT && VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window);
}

/**
 * Best-effort sync of the push subscription with the worker:
 * subscribe/update when a reminder time is set and permission granted,
 * unsubscribe when the time is cleared or permission is gone.
 */
async function syncPushSubscription() {
  if (!pushSupported()) return;
  try {
    var r = getReminder();
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!r.time || Notification.permission !== 'granted') {
      if (sub) {
        try {
          await fetch(PUSH_ENDPOINT + '/unsubscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
        } catch (e) {}
        try { await sub.unsubscribe(); } catch (e) {}
      }
      return;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    var parts = r.time.split(':');
    var json = sub.toJSON();
    await fetch(PUSH_ENDPOINT + '/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: json.keys,
        hour: parseInt(parts[0], 10),
        minute: parseInt(parts[1], 10),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
  } catch (e) { /* push is best-effort; local reminders still work */ }
}

/* ---------------- theme ---------------- */

var THEME_KEY = 'daily-habits/theme';

function applyTheme() {
  var t = 'auto';
  try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
  var dark = t === 'dark' ||
    (t === 'auto' && typeof window.matchMedia === 'function' &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);
  try { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); } catch (e) {}
}

function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  applyTheme();
  render();
}

/* ---------------- onboarding ---------------- */

var ONBOARD_KEY = 'daily-habits/onboarded';

function isOnboarded() {
  try { return !!localStorage.getItem(ONBOARD_KEY); } catch (e) { return true; }
}

function dismissWelcome() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  render();
}

function welcomeGo() {
  dismissWelcome();
  switchTab('more');
  setTimeout(function () {
    var el = document.getElementById('newHabitName');
    if (el) el.focus();
  }, 60);
}

function welcomeHtml() {
  return '<div class="card welcome"><div class="w-ico">🌱</div>' +
    '<h2>Welcome to Daily Habits</h2>' +
    '<p class="hint">The whole system in three steps:</p>' +
    '<div class="w-steps"><div><b>1.</b> Add a small habit</div>' +
    '<div><b>2.</b> Check in once a day</div>' +
    '<div><b>3.</b> Watch the streak grow</div></div>' +
    '<div class="btn-row"><button type="button" class="btn" onclick="welcomeGo()">Add your first habit</button>' +
    '<button type="button" class="btn ghost" onclick="dismissWelcome()">Got it</button></div></div>';
}

/* ---------------- PWA install ---------------- */

var deferredInstallPrompt = null;

function isStandalone() {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
         (typeof navigator !== 'undefined' && navigator.standalone === true);
}

function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(function () { deferredInstallPrompt = null; render(); })
    .catch(function () { deferredInstallPrompt = null; render(); });
}

/* ---------------- offline status ---------------- */

function updateOnlinePill() {
  var offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  var pill = document.getElementById('offlinePill');
  if (pill) pill.hidden = !offline;
  if (offline) showToast('📡 You are offline — your data is safe on this device.');
}

/* ---------------- diagnostics ---------------- */

var ERR_KEY = 'daily-habits/v1.errors';
var APP_VERSION = '1.6.0';

function logError(msg, src) {
  try {
    var log = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
    log.push({ t: new Date().toISOString(), msg: String(msg).slice(0, 200), src: src || '' });
    while (log.length > 20) log.shift();
    localStorage.setItem(ERR_KEY, JSON.stringify(log));
  } catch (e) { /* logging must never throw */ }
}

function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); } catch (e) { return []; }
}

function clearErrors() {
  try { localStorage.removeItem(ERR_KEY); } catch (e) {}
  render();
}

function fillStorageDiag() {
  var el = document.getElementById('diagStorage');
  var done = function (txt) { if (el) el.textContent = txt; };
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(function (est) {
      done(Math.round((est.usage || 0) / 1024) + ' KB used');
    }).catch(function () { done('unavailable'); });
  } else done('unavailable');
}

function renderDiagnostics() {
  var log = getErrorLog();
  var swStatus = (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller)
    ? 'active' : 'not registered';
  var html = '<div class="card"><h2>Diagnostics</h2>' +
    '<div class="diag-row"><span>Version</span><b>' + APP_VERSION + '</b></div>' +
    '<div class="diag-row"><span>Service worker</span><b>' + esc(swStatus) + '</b></div>' +
    '<div class="diag-row"><span>Stored data</span><b id="diagStorage">…</b></div>' +
    '<h3 class="diag-h">Recent errors (' + log.length + ')</h3>';
  if (!log.length) html += '<p class="hint">None recorded.</p>';
  else html += '<div class="err-log">' + log.slice().reverse().map(function (e) {
    return '<div class="err"><span class="err-t">' + esc(String(e.t).slice(0, 16).replace('T', ' ')) + '</span> ' + esc(e.msg) + '</div>';
  }).join('') + '</div>';
  html += '<div class="btn-row"><button type="button" class="btn ghost" onclick="clearErrors()">Clear errors</button>' +
    '<button type="button" class="btn ghost" onclick="fillStorageDiag()">Check storage</button></div></div>';
  return html;
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
  // The ring tracks scheduled-today habits; rest-day habits are extra credit.
  var sched = habits.filter(function (h) { return isScheduledOn(h, key); });
  var list = sched.length ? sched : habits;
  var done = list.filter(function (h) { return isDone(key, h.id); }).length;
  document.getElementById('dateLine').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('dayRing').innerHTML = ring(list.length ? done / list.length : 0, done + '/' + list.length);
  var offlinePill = document.getElementById('offlinePill');
  if (offlinePill) offlinePill.hidden = !(typeof navigator !== 'undefined' && navigator.onLine === false);
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

/* ---------------- bottom sheet ---------------- */

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

/** GitHub-style 16-week check-in heatmap for the habit sheet. */
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

function setCat(c) { activeCat = c; render(); }

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

  if (!isOnboarded()) html += welcomeHtml();

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

function renderMore() {
  var html = '<div class="card"><h2>Add a habit</h2><p class="hint">Small, checkable, on your schedule.</p>' +
    '<div class="field"><label for="newHabitName">Name</label>' +
    '<input id="newHabitName" class="text-in" maxlength="40" placeholder="e.g. Read 20 pages" autocomplete="off"></div>' +
    '<div class="field"><label>Icon</label><div class="emoji-row">' +
    EMOJI_CHOICES.map(function (e) {
      return '<button type="button" class="emoji-pick' + (e === newIcon ? ' sel' : '') + '" aria-pressed="' + (e === newIcon) + '"' +
             ' onclick="pickIcon(this,\'' + e + '\')" aria-label="Icon ' + e + '">' + e + '</button>';
    }).join('') + '</div></div>' +
    '<div class="field"><label>Schedule</label><div class="seg" id="newSchedSeg" role="group" aria-label="Schedule">' +
      '<button type="button" class="seg-btn sel" aria-pressed="true" onclick="pickSchedType(this,\'daily\')">Daily</button>' +
      '<button type="button" class="seg-btn" aria-pressed="false" onclick="pickSchedType(this,\'weekdays\')">Days</button>' +
      '<button type="button" class="seg-btn" aria-pressed="false" onclick="pickSchedType(this,\'timesPerWeek\')">×/week</button>' +
    '</div></div>' +
    '<div class="field" id="newWeekdaysWrap" hidden><label>Which days</label><div class="day-pick" role="group" aria-label="Which days">' +
      ['S','M','T','W','T','F','S'].map(function (lbl, i) {
        var on = newWeekdays.indexOf(i) !== -1;
        return '<button type="button" class="day-btn' + (on ? ' sel' : '') + '" aria-pressed="' + on + '"' +
               ' data-d="' + i + '" onclick="toggleNewWeekday(this)" aria-label="' + DOW_NAMES[i] + '">' + lbl + '</button>';
      }).join('') + '</div></div>' +
    '<div class="field" id="newTimesWrap" hidden><label for="newTimes">Times per week</label>' +
      '<input id="newTimes" type="number" min="1" max="7" value="3" class="text-in"></div>' +
    '<div class="field"><label for="newDesc">Description <span class="opt">(optional)</span></label>' +
      '<input id="newDesc" class="text-in" maxlength="80" placeholder="e.g. 20 pages before bed" autocomplete="off"></div>' +
    '<div class="field"><label for="newCat">Category <span class="opt">(optional)</span></label>' +
      '<input id="newCat" class="text-in" maxlength="24" placeholder="e.g. Health" autocomplete="off"></div>' +
    '<button type="button" class="btn" onclick="addHabit()">Add habit</button></div>';

  html += '<div class="card"><h2>Your habits</h2><p class="hint">Archived habits keep their history but leave the daily list.</p>';
  if (!state.habits.length) {
    html += '<p class="hint">None yet.</p>';
  } else {
    html += state.habits.map(function (h) {
      var sub = h.archived ? 'archived'
        : '🔥 ' + currentStreak(h.id) + ' · ' + esc(scheduleLabel(h)) +
          (h.category ? ' · ' + esc(h.category) : '');
      var row = '<div class="manage-row"><div class="m-ico">' + esc(h.icon) + '</div>' +
        '<div class="m-name">' + esc(h.name) + ' <small>' + sub + '</small></div>' +
        '<button type="button" class="mini" onclick="toggleEditor(\'' + h.id + '\')">Edit</button>' +
        '<button type="button" class="mini" onclick="toggleArchive(\'' + h.id + '\')">' + (h.archived ? 'Unarchive' : 'Archive') + '</button>' +
        '<button type="button" class="mini danger" onclick="deleteHabit(\'' + h.id + '\')">Delete</button></div>';
      if (editingHabit === h.id) row += editorHtml(h);
      return row;
    }).join('');
  }
  html += '</div>';

  var curTheme = 'auto';
  try { curTheme = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
  html += '<div class="card"><h2>Appearance</h2><div class="seg" role="group" aria-label="Theme">' +
    ['auto', 'light', 'dark'].map(function (t) {
      return '<button type="button" class="seg-btn' + (curTheme === t ? ' sel' : '') + '" aria-pressed="' + (curTheme === t) + '"' +
             ' onclick="setTheme(\'' + t + '\')">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
    }).join('') + '</div></div>';

  var rem = getReminder();
  var notifState = ('Notification' in window) ? Notification.permission : 'unsupported';
  html += '<div class="card"><h2>Reminder</h2><p class="hint">A daily nudge while the app is open.</p>' +
    '<div class="field"><label for="reminderTime">Remind me at</label>' +
    '<input id="reminderTime" type="time" class="text-in" value="' + esc(rem.time) + '" onchange="saveReminderTime()"></div>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="enableNotifications()">Enable notifications</button>' +
    '<button type="button" class="btn ghost" onclick="testReminder()">Send test</button></div>' +
    '<p class="hint">Status: ' + esc(notifState) + (rem.time ? ' · set for ' + esc(rem.time) : ' · no time set') + '</p></div>';

  if (deferredInstallPrompt && !isStandalone()) {
    html += '<div class="card"><h2>Install the app</h2>' +
      '<p class="hint">Add Daily Habits to your home screen for the full app experience.</p>' +
      '<button type="button" class="btn" onclick="installApp()">Install app</button></div>';
  }

  html += renderDiagnostics();

  html += '<div class="card"><h2>Data</h2><p class="hint">Your data never leaves this device unless you export it.</p>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="exportData()">Export</button>' +
    '<button type="button" class="btn ghost" onclick="triggerImport()">Import</button></div>' +
    '<div style="height:10px"></div>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="exportEncrypted()">Export encrypted</button>' +
    '<button type="button" class="btn ghost" onclick="triggerEncryptedImport()">Import encrypted</button></div>' +
    '<p class="hint">Encrypted backups (AES-GCM, password-protected) are the way to move data between devices: ' +
    'export here, copy the file via your cloud drive, then import + merge on the other device.</p>' +
    '<div style="height:10px"></div>' +
    '<button type="button" class="btn danger" onclick="wipeData()">Delete all data</button></div>';

  html += '<div class="card"><h2>About</h2><p class="hint">Daily Habits v' + APP_VERSION +
    ' — check in once a day, watch the streaks grow. ' +
    'Add to your home screen for the full app feel.</p>' +
    '<p class="hint"><a href="landing.html">About this app</a> · ' +
    '<a href="https://github.com/arponitis/daily-habits">GitHub</a></p></div>';

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
  else if (activeTab === 'stats') renderStats();
  else renderMore();
  if (sheetHabit) {
    var sh = habitById(sheetHabit);
    if (sh) document.getElementById('view').innerHTML += sheetHtml(sh, viewDate);
    else sheetHabit = null;
  }
  window.scrollTo(0, 0);
}

/* ---------------- UI actions (called from inline handlers) ---------------- */

/* ---------------- undo ---------------- */

var undoStack = [];
var toastTimer = null;

function showToast(msg, actionLabel, onAction) {
  var t = document.getElementById('toast');
  t.innerHTML = '';
  var s = document.createElement('span');
  s.textContent = msg;
  t.appendChild(s);
  if (actionLabel) {
    var b = document.createElement('button');
    b.className = 'toast-btn';
    b.type = 'button';
    b.textContent = actionLabel;
    b.onclick = function () { hideToast(); onAction(); };
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  document.getElementById('toast').hidden = true;
  clearTimeout(toastTimer);
}

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

function switchTab(tab) { activeTab = tab; sheetHabit = null; render(); }

/* ---------------- boot ---------------- */

applyTheme();

window.addEventListener('error', function (e) { logError(e.message || 'Unknown error', 'window'); });
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  logError('Unhandled rejection: ' + (r && r.message ? r.message : String(r)), 'promise');
});

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  render();
});
window.addEventListener('appinstalled', function () {
  deferredInstallPrompt = null;
  showToast('🎉 Installed! Find Daily Habits on your home screen.');
  render();
});
window.addEventListener('online', updateOnlinePill);
window.addEventListener('offline', updateOnlinePill);

if (typeof window.matchMedia === 'function') {
  var colorSchemeMq = window.matchMedia('(prefers-color-scheme: dark)');
  if (colorSchemeMq.addEventListener) colorSchemeMq.addEventListener('change', applyTheme);
}
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('✨ A new version is ready', 'Refresh', function () { window.location.reload(); });
          }
        });
      });
    }).catch(function () { /* offline not available */ });
  });
}
setInterval(checkReminder, 30000);
checkReminder();
handleDeepLink();

document.querySelectorAll('.tab').forEach(function (btn) {
  btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
});
document.getElementById('importFile').addEventListener('change', function () { handleImport(this); });
document.getElementById('importEncFile').addEventListener('change', function () { handleEncryptedImport(this); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && sheetHabit) { closeSheet(); return; }
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'newHabitName') addHabit();
});

saveState(); // persist seed on first run
render();
