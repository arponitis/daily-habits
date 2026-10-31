const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('fake-indexeddb/auto'); // sets globalThis.indexedDB once
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const store = require('../db.js');

const LEGACY = 'daily-habits/v1';
const PAYLOAD = JSON.stringify({ v: 2, habits: [], days: {} });

function freshLS() {
  const s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
  };
}

beforeEach(() => {
  globalThis.indexedDB = new FDBFactory(); // isolated IDB per test
  globalThis.localStorage = freshLS();
  store._resetForTests();
});

test('save -> flush -> loadPersisted round-trips through IndexedDB', async () => {
  store.save(PAYLOAD);
  await store.flush();
  const p = await store.loadPersisted();
  assert.ok(p);
  assert.equal(p.raw, PAYLOAD);
  assert.deepEqual(p.data, JSON.parse(PAYLOAD));
  // primary store is IndexedDB, not localStorage
  assert.equal(globalThis.localStorage.getItem(LEGACY), null);
});

test('migrates the legacy localStorage payload into IndexedDB once', async () => {
  globalThis.localStorage.setItem(LEGACY, PAYLOAD);
  const p = await store.loadPersisted();
  assert.ok(p);
  assert.equal(p.raw, PAYLOAD);
  assert.equal(globalThis.localStorage.getItem(LEGACY), null); // legacy key removed
  const p2 = await store.loadPersisted(); // second load comes from IndexedDB
  assert.equal(p2.raw, PAYLOAD);
});

test('falls back to localStorage when IndexedDB is unavailable', async () => {
  const real = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  store._resetForTests();
  try {
    globalThis.localStorage.setItem(LEGACY, PAYLOAD);
    const p = await store.loadPersisted();
    assert.ok(p);
    assert.equal(p.raw, PAYLOAD);
    store.save(PAYLOAD);
    await store.flush();
    assert.equal(globalThis.localStorage.getItem(LEGACY), PAYLOAD);
  } finally {
    globalThis.indexedDB = real;
  }
});

test('loadPersisted returns null when nothing is stored', async () => {
  assert.equal(await store.loadPersisted(), null);
});

test('clear removes the persisted payload', async () => {
  store.save(PAYLOAD);
  await store.flush();
  await store.clear();
  assert.equal(await store.loadPersisted(), null);
});

test('corrupt payload is treated as empty', async () => {
  const real = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  store._resetForTests();
  try {
    globalThis.localStorage.setItem(LEGACY, 'not-json{{{');
    assert.equal(await store.loadPersisted(), null);
  } finally {
    globalThis.indexedDB = real;
  }
});
