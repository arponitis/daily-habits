/* Daily Habits push worker — pure helpers (no Worker APIs, unit-tested).
   Time math is done in wall-clock time for the user's timezone so reminders
   stay pinned to e.g. 21:30 across DST transitions. */

function dtfParts(t, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = {};
  for (const x of fmt.formatToParts(new Date(t))) p[x.type] = x.value;
  return p;
}

/** Offset (ms) to add to a UTC epoch to get wall-clock-as-UTC in tz. */
function tzOffsetMs(t, tz) {
  const p = dtfParts(t, tz);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return asUTC - t;
}

/** Epoch ms for a wall-clock time (y, mo, d, h, mi) in tz. */
export function zonedTimeToMs(y, mo, d, h, mi, tz) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let t = target;
  for (let i = 0; i < 4; i++) t = target - tzOffsetMs(t, tz);
  return t;
}

function wallDateInTz(ms, tz) {
  const p = dtfParts(ms, tz);
  return { y: +p.year, mo: +p.month, d: +p.day };
}

/**
 * Next epoch ms at which a HH:MM reminder fires in tz, strictly after nowMs.
 * Stays pinned to wall-clock time across DST changes.
 */
export function computeNextFire(hour, minute, tz, nowMs) {
  const { y, mo, d } = wallDateInTz(nowMs, tz);
  let fire = zonedTimeToMs(y, mo, d, hour, minute, tz);
  if (fire <= nowMs) {
    const tmr = new Date(Date.UTC(y, mo - 1, d + 1)); // Date rolls month/year over
    fire = zonedTimeToMs(tmr.getUTCFullYear(), tmr.getUTCMonth() + 1, tmr.getUTCDate(), hour, minute, tz);
  }
  return fire;
}

/** Validate a /subscribe body. Returns an error string or null. */
export function validateSubscription(b) {
  if (!b || typeof b !== 'object') return 'body must be JSON';
  if (typeof b.endpoint !== 'string' || !/^https:\/\//.test(b.endpoint)) return 'bad endpoint';
  if (!b.keys || typeof b.keys.p256dh !== 'string' || typeof b.keys.auth !== 'string') return 'bad keys';
  if (!Number.isInteger(b.hour) || b.hour < 0 || b.hour > 23) return 'bad hour';
  if (!Number.isInteger(b.minute) || b.minute < 0 || b.minute > 59) return 'bad minute';
  try { new Intl.DateTimeFormat('en-US', { timeZone: b.tz }); }
  catch (e) { return 'bad timezone'; }
  return null;
}
