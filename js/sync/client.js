'use strict';
/* Daily Habits — end-to-end encrypted sync client.
 *
 * How it works: the app encrypts the full state with your sync passphrase
 * (AES-GCM, same format as encrypted export) and PUTs the ciphertext to a
 * dumb Cloudflare Worker (sync-worker/), keyed by a random sync code you
 * copy from one device to the other. The server only ever sees ciphertext.
 * On pull, the client decrypts and merges with DH.mergeStates, which is
 * union-based, so concurrent edits on two devices converge without loss.
 *
 * The code is deliberately NOT derived from the passphrase: a mistyped
 * passphrase then fails loudly at decrypt time instead of silently
 * forking into an empty sync space, and a mistyped code 404s loudly.
 *
 * The passphrase lives on this device (localStorage) and is never sent
 * anywhere. Threat model: the server (or anyone reading the KV store)
 * learns nothing; device access is out of scope, as with the app itself.
 */

(function (global) {
  var S = {};

  var CFG_KEY = 'daily-habits/sync';       // {enabled, endpoint}
  var CODE_KEY = 'daily-habits/sync-code'; // random shareable code
  var PW_KEY = 'daily-habits/sync-pw';     // passphrase, device-stored
  var DEVICE_KEY = 'daily-habits/device-id';
  var PUSH_DEBOUNCE_MS = 2000;

  var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
  var CODE_LENGTH = 16;

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  S.getConfig = function () {
    try {
      var c = JSON.parse(lsGet(CFG_KEY) || '{}');
      return { enabled: !!c.enabled, endpoint: c.endpoint || '' };
    } catch (e) { return { enabled: false, endpoint: '' }; }
  };
  S.setConfig = function (c) { lsSet(CFG_KEY, JSON.stringify(c)); };
  S.getPassphrase = function () { return lsGet(PW_KEY) || ''; };
  S.setPassphrase = function (pw) { lsSet(PW_KEY, pw || ''); };

  S.getSyncCode = function () { return lsGet(CODE_KEY) || ''; };
  S.setSyncCode = function (code) { lsSet(CODE_KEY, S.normalizeCode(code)); };
  S.normalizeCode = function (code) {
    return String(code || '').toUpperCase().replace(/[\s-]/g, '');
  };
  S.isValidCode = function (code) {
    return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8,32}$/.test(S.normalizeCode(code));
  };

  /** Generate a fresh random sync code (16 unambiguous chars, 80 bits). */
  S.newSyncCode = function (cryptoObj) {
    var rnd = cryptoObj.getRandomValues(new Uint8Array(CODE_LENGTH));
    var out = '';
    for (var i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[rnd[i] % CODE_ALPHABET.length];
    return out;
  };

  S.getDeviceId = function () {
    var id = lsGet(DEVICE_KEY);
    if (!id) {
      id = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      lsSet(DEVICE_KEY, id);
    }
    return id;
  };

  /** True when the state has no check-ins at all (fresh install / new device). */
  S.isPristine = function (st) {
    var days = (st && st.days) || {};
    return !Object.keys(days).some(function (k) {
      var entries = days[k] || {};
      return Object.keys(entries).some(function (hid) { return !!(entries[hid] || {}).done; });
    });
  };

  function apiBase(endpoint) { return String(endpoint || '').replace(/\/+$/, ''); }

  /**
   * Create a sync client. opts: {fetchImpl, cryptoObj, DH, getState, setState}.
   * setState(merged) must persist + re-render.
   */
  S.createClient = function (opts) {
    function cfg() { return S.getConfig(); }
    function code() { return S.getSyncCode(); }

    async function pushState(pw) {
      var st = opts.getState();
      var payload = await opts.DH.encryptBackup(opts.cryptoObj, JSON.stringify(st), pw);
      var updatedAt = Date.now();
      var res = await opts.fetchImpl(apiBase(cfg().endpoint) + '/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code(), blob: payload, updatedAt: updatedAt, deviceId: S.getDeviceId() }),
      });
      if (!res.ok) throw new Error('push failed: HTTP ' + res.status);
      return { status: 'pushed', updatedAt: updatedAt };
    }

    async function pullMerge(pw) {
      var res = await opts.fetchImpl(apiBase(cfg().endpoint) + '/sync?id=' + code());
      if (res.status === 404) return { status: 'empty' };
      if (!res.ok) throw new Error('pull failed: HTTP ' + res.status);
      var rec = await res.json();
      var json;
      try {
        json = await opts.DH.decryptBackup(opts.cryptoObj, rec.blob, pw);
      } catch (e) {
        throw new Error('Wrong sync passphrase? Could not decrypt the synced data.');
      }
      var remote = opts.DH.migrateState(JSON.parse(json));
      var local = opts.getState();
      var merged = (S.isPristine(local) && !S.isPristine(remote))
        ? remote
        : opts.DH.migrateState(opts.DH.mergeStates(local, remote));
      var changed = JSON.stringify(merged) !== JSON.stringify(local);
      if (changed) opts.setState(merged);
      return { status: 'merged', changed: changed };
    }

    async function syncNow(pw) {
      var pulled = await pullMerge(pw); // pull first: never clobber remote with stale local
      var pushed = await pushState(pw);
      return { status: 'ok', pulled: pulled.status, pushed: pushed.status };
    }

    return { pushState: pushState, pullMerge: pullMerge, syncNow: syncNow };
  };

  /* ---- app wiring (browser globals) ---- */

  S.lastStatus = null; // {at, ok, text}
  function setStatus(ok, text) {
    S.lastStatus = { at: Date.now(), ok: !!ok, text: text };
  }

  var appHooks = null;
  S.registerApp = function (hooks) { appHooks = hooks; }; // {getState(), setState(merged)}

  function ready() {
    var c = S.getConfig();
    if (!c.enabled) return 'Sync is off.';
    if (!c.endpoint) return 'Set the worker URL first.';
    if (!S.isValidCode(S.getSyncCode())) return 'Set a sync code first.';
    if (!S.getPassphrase()) return 'Set a sync passphrase first.';
    if (!appHooks) return 'App not ready.';
    return null;
  }

  function appClient() {
    return S.createClient({
      fetchImpl: global.fetch.bind(global),
      cryptoObj: global.crypto,
      DH: global.DH,
      getState: appHooks.getState,
      setState: appHooks.setState,
    });
  }

  /** Full sync: pull + merge, then push. Updates lastStatus. */
  S.syncNowApp = function () {
    if (!S.getConfig().enabled) return Promise.resolve(null);
    var problem = ready();
    if (problem) { setStatus(false, problem); return Promise.resolve(S.lastStatus); }
    var pw = S.getPassphrase();
    return appClient().syncNow(pw).then(function () {
      setStatus(true, 'Synced just now');
      return S.lastStatus;
    }).catch(function (e) {
      setStatus(false, e && e.message ? e.message : 'Sync failed');
      return S.lastStatus;
    });
  };

  var pushTimer = null;
  /** Debounced push after local changes. Silent unless it fails. */
  S.schedulePush = function () {
    if (ready()) return;
    if (pushTimer) return;
    pushTimer = setTimeout(function () {
      pushTimer = null;
      var pw = S.getPassphrase();
      appClient().pushState(pw).catch(function (e) {
        setStatus(false, e && e.message ? e.message : 'Push failed');
      });
    }, PUSH_DEBOUNCE_MS);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else global.DHSync = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
