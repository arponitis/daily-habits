import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNextFire, validateSubscription, zonedTimeToMs } from './push.js';

test('computeNextFire pins to wall-clock time (no-DST zone)', () => {
  // 2026-10-31T12:00:00Z = 05:00 in America/Phoenix (UTC-7, no DST)
  const now = Date.UTC(2026, 9, 31, 12, 0, 0);
  const fire = computeNextFire(21, 30, 'America/Phoenix', now);
  assert.equal(new Date(fire).toISOString(), '2026-11-01T04:30:00.000Z');
});

test('computeNextFire rolls to tomorrow when time passed', () => {
  // 2026-11-01T05:00:00Z = 22:00 wall in Phoenix; 21:30 already passed
  const now = Date.UTC(2026, 10, 1, 5, 0, 0);
  const fire = computeNextFire(21, 30, 'America/Phoenix', now);
  assert.equal(new Date(fire).toISOString(), '2026-11-02T04:30:00.000Z');
});

test('computeNextFire survives a DST transition', () => {
  // US DST ends 2026-11-01 02:00 -> 01:00. Now = 2026-11-01T04:30:00Z = 00:30 EDT.
  const now = Date.UTC(2026, 10, 1, 4, 30, 0);
  const fire = computeNextFire(9, 0, 'America/New_York', now);
  // 09:00 wall on Nov 1 is EST (UTC-5) -> 14:00Z
  assert.equal(new Date(fire).toISOString(), '2026-11-01T14:00:00.000Z');
});

test('zonedTimeToMs round-trips wall-clock time', () => {
  const ms = zonedTimeToMs(2026, 10, 31, 21, 30, 'America/Phoenix');
  assert.equal(new Date(ms).toISOString(), '2026-11-01T04:30:00.000Z');
});

test('validateSubscription accepts a good body', () => {
  assert.equal(validateSubscription({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'x', auth: 'y' },
    hour: 21, minute: 30, tz: 'America/Phoenix',
  }), null);
});

test('validateSubscription rejects bad bodies', () => {
  assert.ok(validateSubscription(null));
  assert.ok(validateSubscription({ endpoint: 'http://x', keys: { p256dh: 'x', auth: 'y' }, hour: 1, minute: 1, tz: 'America/Phoenix' }));
  assert.ok(validateSubscription({ endpoint: 'https://x', keys: {}, hour: 1, minute: 1, tz: 'America/Phoenix' }));
  assert.ok(validateSubscription({ endpoint: 'https://x', keys: { p256dh: 'x', auth: 'y' }, hour: 25, minute: 1, tz: 'America/Phoenix' }));
  assert.ok(validateSubscription({ endpoint: 'https://x', keys: { p256dh: 'x', auth: 'y' }, hour: 1, minute: 1, tz: 'Mars/Olympus' }));
});
