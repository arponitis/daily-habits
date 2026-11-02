/* Daily Habits — js/app/shell.js
 * App shell: tab switching, header, toasts, boot sequence, and global event wiring. Loads last.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var activeTab = 'checkin';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
}

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

function switchTab(tab) { activeTab = tab; sheetHabit = null; render(); window.scrollTo(0, 0); }

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
/* ---------------- boot ----------------
 * Storage is async now (IndexedDB), so state loads in boot() before the
 * first render. Everything above only defines functions. */

/* If db.js failed to load (e.g. a stale cache served index.html without it),
 * fall back to plain localStorage so the app still boots and saves. */
if (typeof DHStore === 'undefined') {
  var DHStore = {
    loadPersisted: function () {
      try {
        var raw = localStorage.getItem('daily-habits/v1');
        if (raw) { var s = JSON.parse(raw); if (s && typeof s === 'object') return Promise.resolve({ data: s, raw: raw }); }
      } catch (e) {}
      return Promise.resolve(null);
    },
    readRaw: function () {
      try { return Promise.resolve(localStorage.getItem('daily-habits/v1')); }
      catch (e) { return Promise.resolve(null); }
    },
    save: function (p) { try { localStorage.setItem('daily-habits/v1', p); } catch (e) {} },
    flush: function () { return Promise.resolve(); },
    clear: function () { try { localStorage.removeItem('daily-habits/v1'); } catch (e) {} return Promise.resolve(); },
    onSaveError: function () {}
  };
}

async function boot() {
  var persisted = null;
  try { persisted = await DHStore.loadPersisted(); } catch (e) { persisted = null; }
  var freshInstall = !persisted || !persisted.data;
  var startEmpty = freshInstall && !isOnboarded();
  try {
    state = DH.migrateState(persisted && persisted.data ? persisted.data : (startEmpty ? emptyState() : seedState()));
  } catch (e) {
    // Payload claims a schema newer than this build understands: back it up
    // and start fresh rather than destroying it.
    backupRaw(persisted ? persisted.raw : null);
    state = startEmpty ? emptyState() : seedState();
  }
  if (startEmpty) onboardingStep = 'choice';
  DHStore.onSaveError(function () {
    showToast('⚠️ Could not save — storage may be full. Export your data!', 'Export', exportData);
  });
  window.addEventListener('pagehide', function () { DHStore.flush(); });

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

  if (typeof DHSync !== 'undefined') {
    DHSync.registerApp({
      getState: function () { return state; },
      setState: function (merged) { state = merged; saveState(); render(); }
    });
    DHSync.syncNowApp(); // pull + merge on launch when enabled (silent when off)
    window.addEventListener('online', function () { DHSync.syncNowApp(); });
  }
}
boot();
