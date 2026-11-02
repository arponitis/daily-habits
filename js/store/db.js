'use strict';
/* Daily Habits — persistence layer.
 *
 * Primary store: IndexedDB (async, generous quota, off the main thread).
 * Falls back to localStorage when IndexedDB is unavailable (private mode,
 * very old browsers). The in-memory `state` object in app.js remains the
 * single source of truth for the UI; this module only persists/restores it.
 *
 * Migration: on first run after the switch, the legacy localStorage payload
 * is copied into IndexedDB and the legacy key is removed, so there is never
 * a stale copy to confuse a later load.
 */

(function (global) {
  var DB_NAME = 'daily-habits';
  var DB_VERSION = 1;
  var STORE = 'kv';
  var KEY = 'state';
  var LEGACY_KEY = 'daily-habits/v1';
  var SAVE_DELAY = 400;

  var store = {};

  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        if (!global.indexedDB) return resolve(null);
        var req = global.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }

  function idbReq(db, mode, op) {
    return new Promise(function (resolve, reject) {
      var tx, rq;
      try {
        tx = db.transaction(STORE, mode);
        rq = op(tx.objectStore(STORE));
      } catch (e) { reject(e); return; }
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error || new Error('indexeddb request failed')); };
      tx.onerror = function () { reject(tx.error || new Error('indexeddb transaction failed')); };
    });
  }

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { throw e; } }
  function lsDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  function parsePayload(raw) {
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (s && typeof s === 'object') return { data: s, raw: raw };
    } catch (e) { /* corrupted -> treat as empty, like before */ }
    return null;
  }

  /**
   * Load the persisted payload: { data, raw } or null.
   * IndexedDB first; one-time migration from the legacy localStorage key;
   * plain localStorage when IndexedDB is unavailable.
   */
  store.loadPersisted = async function () {
    var db = await openDB();
    if (db) {
      var v = await idbReq(db, 'readonly', function (os) { return os.get(KEY); })
        .catch(function () { return null; });
      if (v != null) return parsePayload(v);
      var legacy = lsGet(LEGACY_KEY);
      if (legacy) {
        try { await idbReq(db, 'readwrite', function (os) { return os.put(legacy, KEY); }); lsDel(LEGACY_KEY); }
        catch (e) { /* migration failed: keep serving the legacy copy */ }
        return parsePayload(legacy);
      }
      return null;
    }
    return parsePayload(lsGet(LEGACY_KEY));
  };

  /** Current raw payload string, for recoverable backups (wipe/export). */
  store.readRaw = async function () {
    var p = await store.loadPersisted();
    return p ? p.raw : null;
  };

  var onSaveError = null;
  store.onSaveError = function (fn) { onSaveError = fn; };
  function saveFailed(e) { if (onSaveError) { try { onSaveError(e); } catch (_) {} } }

  function writeNow(payload) {
    return openDB().then(function (db) {
      if (db) return idbReq(db, 'readwrite', function (os) { return os.put(payload, KEY); });
      lsSet(LEGACY_KEY, payload); // throws on quota -> caller surfaces it
      return null;
    });
  }

  var saveTimer = null;
  var pending = null;

  /** Schedule a debounced persist of the JSON payload string. */
  store.save = function (payload) {
    pending = payload;
    if (!saveTimer) {
      saveTimer = setTimeout(function () {
        saveTimer = null;
        var p = pending; pending = null;
        writeNow(p).catch(saveFailed);
      }, SAVE_DELAY);
    }
  };

  /** Write any pending payload immediately (pagehide). */
  store.flush = function () {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (pending == null) return Promise.resolve();
    var p = pending; pending = null;
    return writeNow(p).catch(saveFailed);
  };

  /** Remove all persisted data (wipe). Keeps backup keys untouched. */
  store.clear = async function () {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    pending = null;
    var db = await openDB();
    if (db) {
      try { await idbReq(db, 'readwrite', function (os) { return os.delete(KEY); }); }
      catch (e) {}
    }
    lsDel(LEGACY_KEY);
  };

  // Test hooks (not part of the app contract).
  store._resetForTests = function () { dbPromise = null; saveTimer = null; pending = null; };

  if (typeof module !== 'undefined' && module.exports) module.exports = store;
  else (global.DHStore = store);
})(typeof globalThis !== 'undefined' ? globalThis : this);
