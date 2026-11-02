/* Daily Habits push worker (Cloudflare Workers).
 *
 * What it stores per subscriber (KV `REMINDERS`): the push endpoint +
 * encryption keys, reminder hour/minute, and IANA timezone. Habit data
 * NEVER touches this server - notifications carry a generic message and
 * tapping one just opens the app.
 */
import webpush from 'web-push';
import { computeNextFire, validateSubscription } from './push.js';

const APP_ORIGIN = 'https://arponitis.github.io';

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': APP_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: cors() });
}

async function sha256Hex(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function vapid(env) {
  webpush.setVapidDetails('mailto:habits@example.com', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/subscribe') {
      const body = await req.json().catch(() => null);
      const err = validateSubscription(body);
      if (err) return json({ ok: false, error: err }, 400);
      const id = await sha256Hex(body.endpoint);
      const now = Date.now();
      await env.REMINDERS.put(
        id,
        JSON.stringify({
          endpoint: body.endpoint,
          keys: body.keys,
          hour: body.hour,
          minute: body.minute,
          tz: body.tz,
          nextFire: computeNextFire(body.hour, body.minute, body.tz, now),
          updatedAt: now,
        })
      );
      return json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/unsubscribe') {
      const body = await req.json().catch(() => null);
      if (body && typeof body.endpoint === 'string') {
        await env.REMINDERS.delete(await sha256Hex(body.endpoint));
      }
      return json({ ok: true });
    }

    return new Response('daily-habits push worker', { status: 200 });
  },

  // Cron: every 10 minutes. Sends due reminders, reschedules, prunes dead endpoints.
  async scheduled(event, env, ctx) {
    vapid(env);
    const now = Date.now();
    const due = [];
    let cursor;
    do {
      const page = await env.REMINDERS.list({ cursor });
      for (const k of page.keys) {
        const raw = await env.REMINDERS.get(k.name);
        if (!raw) continue;
        const sub = JSON.parse(raw);
        if (sub.nextFire <= now) due.push([k.name, sub]);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    ctx.waitUntil(
      (async () => {
        for (const [id, sub] of due) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys },
              JSON.stringify({ title: 'Daily Habits', body: 'Time for your check-in' }),
              { TTL: 3600 }
            );
            sub.nextFire = computeNextFire(sub.hour, sub.minute, sub.tz, now + 60000);
            await env.REMINDERS.put(id, JSON.stringify(sub));
          } catch (e) {
            // 404/410 = subscription gone (uninstalled, revoked) - prune it.
            if (e && (e.statusCode === 404 || e.statusCode === 410)) {
              await env.REMINDERS.delete(id);
            }
          }
        }
      })()
    );
  },
};
