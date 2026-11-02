/* Daily Habits — js/app/state.js
 * App state: the in-memory `state` object (single source of truth for the UI), habit CRUD helpers, and data import/export (plain + encrypted).
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var STORE_KEY = 'daily-habits/v1';

var SEED_HABITS = [
  { name: 'Reading',    icon: '📖' },
  { name: 'Meditating', icon: '🧘' },
  { name: 'No sugar',   icon: '🚫' }
];

var EMOJI_CHOICES = ['📖','🧘','🚫','🏃','💧','📝','🎸','🧠','💪','🛌','🥗','🚭','📵','🎨','🌅','🧹'];

function uid() { return 'h_' + Math.random().toString(36).slice(2, 10); }

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
  if (!state) return; // boot() hasn't loaded yet
  state.v = DH.CURRENT_SCHEMA_VERSION;
  DHStore.save(JSON.stringify(state)); // debounced; errors surface via onSaveError
  if (typeof DHSync !== 'undefined') DHSync.schedulePush(); // encrypted sync, debounced
}

function backupRaw(raw) {
  try {
    if (raw) localStorage.setItem(STORE_KEY + '.backup-' + Date.now(), raw);
  } catch (e) {}
}

var state = null; // assigned in boot() once the persisted payload loads

var dayKey = DH.dayKey;
var parseKey = DH.parseKey;
var todayKey = DH.todayKey;
var addDays = DH.addDays;

function currentStreak(hid) { var h = habitById(hid); return DH.currentStreak(state.days, hid, todayKey(), h && h.schedule); }
function bestStreak(hid) { var h = habitById(hid); return DH.bestStreak(state.days, hid, h && h.schedule); }
function totalDone(hid) { return DH.totalDone(state.days, hid); }

function habitById(hid) { return state.habits.find(function (x) { return x.id === hid; }); }

function isScheduledOn(h, key) { return DH.isScheduledDay(h.schedule, key); }
function scheduleLabel(h) { return DH.scheduleLabel(h.schedule); }

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
  DHStore.readRaw().then(function (raw) {
    backupRaw(raw); // recoverable copy, just in case
    return DHStore.clear();
  }).then(function () {
    try { localStorage.removeItem(ONBOARD_KEY); localStorage.removeItem(TIP_KEY); } catch (e) {}
    state = emptyState();
    onboardingStep = 'choice';
    viewDate = todayKey();
    viewMonth = viewDate.slice(0, 7);
    saveState();
    render();
  });
}
