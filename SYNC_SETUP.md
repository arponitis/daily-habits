# Sync worker setup (~10 minutes, needs your Cloudflare account)

The sync worker is a dumb encrypted-blob store. It never sees your habits:
the app encrypts everything with your sync passphrase before upload, and the
server only sees the ciphertext plus a sync ID derived from the passphrase.

## 1. Create the KV namespace

```bash
cd sync-worker
npx wrangler login
npx wrangler kv namespace create SYNC
```

Paste the returned `id` into `wrangler.toml` (replace
`REPLACE_WITH_KV_NAMESPACE_ID`).

## 2. Deploy

```bash
npx wrangler deploy
```

Note the worker URL, e.g. `https://daily-habits-sync.<you>.workers.dev`.

## 3. Point the app at it

In the app: More tab → Sync card → paste the worker URL (no trailing slash)
as the endpoint, e.g. `https://daily-habits-sync.<you>.workers.dev`.

## 4. Pick a sync passphrase

Enter the same passphrase on every device. It is stored on each device and
never sent anywhere — the server only sees `SHA-256(passphrase + id-salt)`.

- First sync on a new device: if the device has no check-ins yet, it adopts
  the synced data wholesale; otherwise it merges.
- Afterwards: check-ins upload automatically (debounced), and the app pulls
  + merges on launch and when you come back online.

## Cost

KV + Workers free tier covers this many times over for personal use.
