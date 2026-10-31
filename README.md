# Daily Habits

A simple, private daily habit tracker. Check in once a day, watch the streaks grow.

**Live app:** https://arponitis.github.io/daily-habits/

No accounts, no servers, no tracking — everything is stored in your browser's
localStorage on the device you use it on.

## Install on your phone

**iPhone (Safari):** open the live app URL → Share → **Add to Home Screen**.
Launches full-screen like a native app.

**Android (Chrome):** open the live app URL → menu → **Add to Home screen**
(Chrome may offer "Install app" directly). Same full-screen app feel.

Your check-ins stay on the device — each browser keeps its own data.

## Features

- One-tap daily check-ins with a progress ring
- Current / best / total streaks per habit
- Last-7-days strip and a month calendar with backfill (fix past days)
- Per-day notes (e.g. what chapter you read)
- Add, rename, archive, and delete habits
- Export / import your data as JSON

## Run locally

Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Development

Pure logic (dates, streaks, import validation, migrations) lives in `lib.js`
with no DOM dependencies, so it is unit tested in Node:

```sh
npm test
```

The suite runs with `TZ=America/New_York` so DST boundary cases are exercised.

## Deploy

Live via **GitHub Pages**: repo Settings → Pages → Deploy from a branch →
`main` / root. No build step.

Any static host works too — Netlify, Vercel, or Cloudflare Pages pointed at
this repo.

## Project structure

```
index.html            markup + tab shell
styles.css            mobile-first styles
lib.js                pure logic (dates, streaks, validation, migrations) — no DOM
app.js                UI: state, rendering, interactions (consumes lib.js)
test/                 node:test unit suite (npm test)
manifest.webmanifest  PWA manifest
icon-*.png            app icons
```

## Roadmap ideas

- Daily reminder notifications
- Weekly review summary
- Home-screen widget / native wrapper (Capacitor)
