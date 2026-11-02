/* Daily Habits — js/lib/crypto.js
 * AES-GCM backup encryption with PBKDF2-derived keys. Pure functions taking a crypto object so they run in browser and Node.
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  function b64encode(bytes) {
    var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var bin = '';
    for (var i = 0; i < arr.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
    }
    if (typeof btoa === 'function') return btoa(bin);
    return Buffer.from(bin, 'binary').toString('base64');
  }

  function b64decode(b64) {
    var bin;
    if (typeof atob === 'function') bin = atob(b64);
    else bin = Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function deriveBackupKey(cryptoObj, password, salt) {
    var enc = new TextEncoder();
    return cryptoObj.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return cryptoObj.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function encryptBackup(cryptoObj, jsonString, password) {
    var salt = cryptoObj.getRandomValues(new Uint8Array(16));
    var iv = cryptoObj.getRandomValues(new Uint8Array(12));
    return deriveBackupKey(cryptoObj, password, salt).then(function (key) {
      return cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(jsonString));
    }).then(function (ct) {
      return {
        app: 'daily-habits',
        enc: 'AES-GCM/PBKDF2-SHA256-200k',
        salt: b64encode(salt),
        iv: b64encode(iv),
        data: b64encode(new Uint8Array(ct))
      };
    });
  }

  function decryptBackup(cryptoObj, payload, password) {
    if (!payload || payload.app !== 'daily-habits' || !payload.salt || !payload.iv || !payload.data) {
      return Promise.reject(new Error('Not a Daily Habits encrypted backup.'));
    }
    return deriveBackupKey(cryptoObj, password, b64decode(payload.salt)).then(function (key) {
      return cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv: b64decode(payload.iv) }, key, b64decode(payload.data));
    }).then(function (pt) {
      return new TextDecoder().decode(pt);
    });
  }

  DH.b64encode = b64encode;
  DH.b64decode = b64decode;
  DH.encryptBackup = encryptBackup;
  DH.decryptBackup = decryptBackup;
})();
