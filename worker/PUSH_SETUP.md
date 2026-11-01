# Web Push reminders — setup

The app's in-app reminders only fire while the page is open. This worker
sends real push notifications (Web Push) that arrive with the app closed —
on Android, desktop, and iOS 16.4+ (installed PWA).

**Privacy:** the worker stores only the push endpoint + encryption keys,
reminder hour/minute, and timezone. Habit names, check-ins, and streaks
never leave the device. Notification text is generic.

## One-time setup (~15 minutes, all free)

1. **Cloudflare account** — sign up at dash.cloudflare.com (free tier covers
   this: Workers + KV + cron all fit in the free plan).

2. **Install wrangler and log in:**
   ```
   cd worker
   npm install
   npx wrangler login
   ```

3. **Create the KV namespace:**
   ```
   npx wrangler kv namespace create REMINDERS
   ```
   Paste the returned `id` into `wrangler.toml` (`[[kv_namespaces]]`).

4. **Generate VAPID keys** (do this on your own machine — the private key
   must never be committed):
   ```
   npx web-push generate-vapid-keys
   ```

5. **Store the keys:**
   ```
   npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key
   ```
   Put the public key in two places:
   - `wrangler.toml` → `[vars] VAPID_PUBLIC_KEY`
   - `app.js` → `VAPID_PUBLIC_KEY` const (next to `PUSH_ENDPOINT`)

6. **Deploy:**
   ```
   npm run deploy
   ```
   Note the worker URL, e.g.
   `https://daily-habits-push.<your-subdomain>.workers.dev`.

7. **Point the app at it:** in `app.js`, set
   ```
   var PUSH_ENDPOINT = 'https://daily-habits-push.<your-subdomain>.workers.dev';
   ```
   Commit, merge, and the site redeploys. Done — enabling notifications in
   the app now subscribes for push; the local in-app reminder keeps working
   as a fallback.

## How it works

- App: on "Enable notifications" (permission granted), the app subscribes
  via `pushManager` and POSTs `{endpoint, keys, hour, minute, tz}` to
  `/subscribe`. Clearing the reminder time unsubscribes.
- Worker cron (every 10 min): sends due reminders, reschedules each for the
  next day pinned to wall-clock time (DST-safe), and deletes endpoints the
  push service reports as gone (404/410).
- Service worker: `push` event shows the notification; tapping it opens the
  app.

## Alternatives

If you'd rather not use Cloudflare: the same design ports to Supabase Edge
Functions, Vercel/Netlify scheduled functions, or Fly.io in under an hour —
the worker is one file plus the pure helpers in `push.js`.
