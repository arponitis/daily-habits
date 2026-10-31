import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kvKey, isValidCode, normalizeCode, validatePushBody, shouldStore,
  CODE_ALPHABET, CODE_LENGTH,
} from './sync-protocol.js';

const CODE = 'ABCDEFGH23456789';
const BLOB = { app: 'daily-habits', enc: 'AES-GCM/PBKDF2-SHA256-200k', salt: 's', iv: 'i', data: 'd' };

test('kvKey namespaces the sync code', () => {
  assert.equal(kvKey(CODE), 'sync:' + CODE);
});

test('isValidCode accepts 8-32 unambiguous chars', () => {
  assert.ok(isValidCode(CODE));
  assert.ok(isValidCode('A'.repeat(8)));
  assert.ok(!isValidCode('A'.repeat(7)));
  assert.ok(!isValidCode('abcdefgh12345678')); // lowercase rejected (normalize first)
  assert.ok(!isValidCode('ABCD0FGH12345678')); // 0 not in alphabet
  assert.ok(!isValidCode(null));
});

test('normalizeCode uppercases and strips separators', () => {
  assert.equal(normalizeCode('abcd-efgh 2345 6789'), CODE);
});

test('CODE_ALPHABET has 31 unambiguous chars', () => {
  assert.equal(CODE_ALPHABET.length, 31);
  assert.equal(CODE_LENGTH, 16);
  assert.ok(!/[ILOO01]/.test(CODE_ALPHABET));
});

test('validatePushBody accepts a well-formed body', () => {
  assert.equal(validatePushBody({ id: CODE, blob: BLOB, updatedAt: 1, deviceId: 'd1' }), null);
});

test('validatePushBody rejects malformed bodies', () => {
  assert.ok(validatePushBody(null));
  assert.ok(validatePushBody({ id: 'nope', blob: BLOB, updatedAt: 1, deviceId: 'd1' }));
  assert.ok(validatePushBody({ id: CODE, blob: { app: 'nope' }, updatedAt: 1, deviceId: 'd1' }));
  assert.ok(validatePushBody({ id: CODE, blob: BLOB, updatedAt: -5, deviceId: 'd1' }));
  assert.ok(validatePushBody({ id: CODE, blob: BLOB, updatedAt: 1, deviceId: '' }));
});

test('shouldStore: empty store and newer wins', () => {
  assert.ok(shouldStore(null, { updatedAt: 1 }));
  assert.ok(shouldStore({ updatedAt: 1 }, { updatedAt: 2 }));
  assert.ok(!shouldStore({ updatedAt: 2 }, { updatedAt: 2 }));
  assert.ok(!shouldStore({ updatedAt: 3 }, { updatedAt: 2 }));
});
