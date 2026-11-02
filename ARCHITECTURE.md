# Daily Habits — Architecture

## Layers

```
index.html
├── js/lib/*        pure logic: dates, schedules, streaks, trends, crypto, merge, templates, schema
│                   no DOM, no I/O — runs in browser (globalThis.DH) and Node (tests)
├── js/store/db.js  persistence: IndexedDB primary, localStorage fallback (globalThis.DHStore)
├── js/sync/client.js  E2E-encrypted sync client (globalThis.DHSync)
└── js/app/*        UI: state, tabs, sheets, editors, reminders, onboarding (globals)
workers/
├── push/           Cloudflare Worker: Web Push reminders (VAPID, KV, cron)
└── sync/           Cloudflare Worker: dumb encrypted-blob store for sync
```

**Data flow:** `js/app` holds the in-memory `state` (single source of truth for
the UI). It persists via `DHStore` (async) and syncs via `DHSync`. Pure
computations go through `DH` (the `js/lib` layer). The workers never see
plaintext habits — push stores only endpoints + reminder times, sync stores
only ciphertext.

## ADR-1: No build step

We ship vanilla JS as classic `<script>` tags — no bundler, no transpiler, no
ES modules. This is deliberate:

- **Copy-deploy:** any static host serves the repo as-is (GitHub Pages,
  Cloudflare Pages, Netlify). No CI build, no artifact drift.
- **Auditable:** what you read in the repo is what runs in the browser.
- **Inline handlers:** `onclick="toggleDone('h_abc')"` needs globals; classic
  scripts give us that for free.

The cost is discipline: modules communicate through documented globals
(`DH`, `DHStore`, `DHSync`) instead of imports. Cross-module calls inside
`js/lib` go through `DH.*` at call time (never at load time), so script order
within a layer doesn't matter — only layer order does
(lib → store → sync → app).

If the codebase ever needs npm dependencies in the browser bundle or code
splitting, this ADR gets revisited — but that's a rewrite of the deploy story,
not a gradual migration.

## Naming

- `js/lib/<topic>.js` — one topic per file, named for what it computes.
- `js/app/<area>.js` — one UI area per file, named for the screen/feature.
- `js/store/db.js`, `js/sync/client.js` — the "what" is the folder, the file
  is the role.
- `workers/<push|sync>/` — one folder per backend, each self-contained
  (worker.js + wrangler.toml + setup doc + tests).
- Tests mirror source: `test/lib/dates.test.js` tests `js/lib/dates.js`.

## Service worker discipline

`sw.js` uses a **cache-first** strategy: the app shell only updates when
`sw.js` itself byte-changes. Rule: **every deploy that changes app code must
bump `CACHE`** (`daily-habits-vN`). The inventory test
(`test/inventory.test.js`) asserts every JS file referenced by `index.html`
is also in the `sw.js` precache list, so a new script tag can't silently miss
the offline cache.
