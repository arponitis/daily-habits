/* Daily Habits — js/app/more.js
 * More tab: settings, reminder card, diagnostics, theme, install prompt, and data management.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var activeCat = 'All';               // check-in category filter

function setCat(c) { activeCat = c; render(); }

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

function updateOnlinePill() {
  var offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  var pill = document.getElementById('offlinePill');
  if (pill) pill.hidden = !offline;
  if (offline) showToast('📡 You are offline — your data is safe on this device.');
}

var ERR_KEY = 'daily-habits/v1.errors';

var APP_VERSION = '1.13.0';

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

  html += templatesCardHtml();

  html += '<div class="card"><h2>Your habits</h2><p class="hint">Archived habits keep their history but leave the daily list.</p>';
  if (!state.habits.length) {
    html += '<p class="hint">None yet — try a starter pack in Templates above.</p>';
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

  html += syncCardHtml();

  html += '<div class="card"><h2>About</h2><p class="hint">Daily Habits v' + APP_VERSION +
    ' — check in once a day, watch the streaks grow. ' +
    'Add to your home screen for the full app feel.</p>' +
    '<p class="hint"><a href="landing.html">About this app</a> · ' +
    '<a href="https://github.com/arponitis/daily-habits">GitHub</a></p></div>';

  document.getElementById('view').innerHTML = html;
}
