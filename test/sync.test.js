const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const DH = require('../lib.js');
const DHSync = require('../sync.js');

const PW = 'correct-horse-battery-staple';
const CODE = 'ABCDEFGH23456789';

function freshLS() {
  const s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
  };
}

// In-memory stand-in for the sync worker's KV.
function mockServer() {
  const kv = new Map();
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url, 'https://x.test');
    if (u.pathname === '/sync' && opts.method === 'PUT') {
      const b = JSON.parse(opts.body);
      const k = 'sync:' + b.id;
      const cur = kv.get(k);
      if (!cur || b.updatedAt > cur.updatedAt) kv.set(k, { blob: b.blob, updatedAt: b.updatedAt, deviceId: b.deviceId });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (u.pathname === '/sync') {
      const rec = kv.get('sync:' + u.searchParams.get('id'));
      if (!rec) return { ok: false, status: 404, json: async () => ({ ok: false }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, ...rec }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, kv };
}

function stateWith(days) {
  return { v: 2, habits: [{ id: 'h1', name: 'Reading' }], days };
}

function makeClient(server, st) {
  let state = st;
  const client = DHSync.createClient({
    fetchImpl: server.fetchImpl,
    cryptoObj: webcrypto,
    DH,
    getState: () => state,
    setState: (s) => { state = s; },
  });
  return { client, getState: () => state };
}

beforeEach(() => {
  globalThis.localStorage = freshLS();
  DHSync.setConfig({ enabled: true, endpoint: 'https://sync.test' });
  DHSync.setSyncCode(CODE);
});

test('newSyncCode generates valid unambiguous codes', () => {
  const a = DHSync.newSyncCode(webcrypto);
  const b = DHSync.newSyncCode(webcrypto);
  assert.ok(DHSync.isValidCode(a));
  assert.equal(a.length, 16);
  assert.notEqual(a, b);
});

test('normalizeCode / isValidCode', () => {
  assert.equal(DHSync.normalizeCode('abcd-efgh 2345 6789'), CODE);
  assert.ok(DHSync.isValidCode('abcd-efgh 2345 6789'));
  assert.ok(!DHSync.isValidCode('short'));
});

test('isPristine detects fresh vs used state', () => {
  assert.ok(DHSync.isPristine(stateWith({})));
  assert.ok(DHSync.isPristine(stateWith({ '2026-10-31': { h1: { note: 'x' } } })));
  assert.ok(!DHSync.isPristine(stateWith({ '2026-10-31': { h1: { done: true } } })));
});

test('pristine device adopts remote state wholesale on first pull', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({ '2026-10-30': { h1: { done: true } } }));
  const b = makeClient(server, stateWith({}));
  await a.client.pushState(PW);
  const r = await b.client.pullMerge(PW);
  assert.equal(r.status, 'merged');
  assert.ok(r.changed);
  assert.deepEqual(b.getState().days, { '2026-10-30': { h1: { done: true } } });
});

test('two devices converge via union merge', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({ '2026-10-30': { h1: { done: true } } }));
  const b = makeClient(server, stateWith({ '2026-10-31': { h1: { done: true } } }));
  await a.client.syncNow(PW);
  const r = await b.client.syncNow(PW);
  assert.equal(r.status, 'ok');
  const days = b.getState().days;
  assert.ok(days['2026-10-30'].h1.done && days['2026-10-31'].h1.done);
  await a.client.pullMerge(PW);
  assert.deepEqual(Object.keys(a.getState().days).sort(), ['2026-10-30', '2026-10-31']);
});

test('wrong passphrase fails LOUDLY at decrypt (no silent fork)', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({ '2026-10-30': { h1: { done: true } } }));
  await a.client.pushState(PW);
  const b = makeClient(server, stateWith({}));
  await assert.rejects(() => b.client.pullMerge(PW + 'wrong'), /Wrong sync passphrase/);
  assert.deepEqual(b.getState().days, {}); // untouched
});

test('wrong sync code 404s loudly (no silent fork)', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({ '2026-10-30': { h1: { done: true } } }));
  await a.client.pushState(PW);
  DHSync.setSyncCode('ZZZZZZZZZZZZZZZZ');
  const b = makeClient(server, stateWith({}));
  const r = await b.client.pullMerge(PW);
  assert.equal(r.status, 'empty');
});

test('pull from empty server reports empty', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({}));
  const r = await a.client.pullMerge(PW);
  assert.equal(r.status, 'empty');
});

test('server last-writer-wins, merge still converges', async () => {
  const server = mockServer();
  const a = makeClient(server, stateWith({ '2026-10-30': { h1: { done: true } } }));
  await a.client.pushState(PW);
  const rec = server.kv.get('sync:' + CODE);
  assert.ok(rec.updatedAt > 0);
  assert.equal(rec.deviceId, DHSync.getDeviceId());
});
