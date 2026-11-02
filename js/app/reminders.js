/* Daily Habits — js/app/reminders.js
 * Daily reminders: local in-app nudges plus Web Push subscription sync (push worker).
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

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

var PUSH_ENDPOINT = 'https://daily-habits-push.daily-habits-tracker.workers.dev';

var VAPID_PUBLIC_KEY = 'BBPywod1ljYbeegwtyiE9Zkvygt1LtGREC44JoK5ECMzk8iUNvDp8A4pWh14nwZfAGIy8_cc5rx9Px_9kNa2tg0'; // public VAPID key — safe to commit

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
