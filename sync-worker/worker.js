/* Daily Habits sync worker (Cloudflare Workers).
 *
 * Dumb encrypted-blob store. One record per sync code:
 *   { blob, updatedAt, deviceId }
 * The blob is an AES-GCM ciphertext (same format as the app's encrypted
 * export) — habit data NEVER touches this server in plaintext. Clients
 * merge with DH.mergeStates, which is union-based, so races self-heal.
 *
 * Endpoints:
 *   PUT /sync  {id, blob, updatedAt, deviceId}  -> {ok:true} (LWW)
 *   GET /sync?id=<code>                         -> {blob,updatedAt,deviceId} | 404
 */
import { kvKey, validatePushBody, shouldStore, isValidCode } from './sync-protocol.js';

const APP_ORIGIN = 'https://arponitis.github.io';

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: cors() });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    const url = new URL(req.url);

    if (url.pathname === '/sync' && req.method === 'PUT') {
      const body = await req.json().catch(() => null);
      const err = validatePushBody(body);
      if (err) return json({ ok: false, error: err }, 400);
      const key = kvKey(body.id);
      const existing = await env.SYNC.get(key, 'json');
      if (!shouldStore(existing, body)) return json({ ok: true, stored: false });
      await env.SYNC.put(key, JSON.stringify({
        blob: body.blob,
        updatedAt: body.updatedAt,
        deviceId: body.deviceId,
      }));
      return json({ ok: true, stored: true });
    }

    if (url.pathname === '/sync' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (!isValidCode(id)) return json({ ok: false, error: 'bad id' }, 400);
      const rec = await env.SYNC.get(kvKey(id), 'json');
      if (!rec) return json({ ok: false, error: 'not found' }, 404);
      return json({ ok: true, blob: rec.blob, updatedAt: rec.updatedAt, deviceId: rec.deviceId });
    }

    return json({ ok: false, error: 'not found' }, 404);
  },
};
