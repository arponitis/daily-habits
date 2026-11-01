# Daily Habits

A simple, private daily habit tracker. Check in once a day, watch the streaks grow.

**Live app:** https://arponitis.github.io/daily-habits/

No accounts, no servers, no tracking — everything is stored in your browser
(IndexedDB) on the device you use it on.

## Install on your phone

**iPhone (Safari):** open the live app URL → Share → **Add to Home Screen**.
Launches full-screen like a native app.

**Android (Chrome):** open the live app URL → menu → **Add to Home screen**
(Chrome may offer "Install app" directly). Same full-screen app feel.

Your check-ins stay on the device — each browser keeps its own data.

## Features

- One-tap daily check-ins with a progress ring
- Habit templates: one-tap starter packs (Morning Reset, Deep Work, Fitness Starter, Reading)
- Flexible schedules: daily, specific weekdays, or N times per week (rest days never break streaks)
- Forgiving streaks: one automatic grace day per week — a single miss won't break your streak
- Current / best / total streaks per habit (schedule-aware)
- Per-habit GitHub-style 16-week check-in heatmap
- Stats tab: 12-week completion sparklines, strongest weekday, weekly targets
- Weekly insights: best day, most consistent habit, week-over-week trend, longest active streak
- Last-7-days strip and a month calendar with backfill, streak highlights, and month summaries
- Habit descriptions and categories with filtering
- Per-day notes (e.g. what chapter you read)
- Add, rename, archive, and delete habits
- Daily reminders (local notifications while the app is open)
- Encrypted backups (AES-GCM) with merge-vs-replace import
- Share your streak (Web Share API with clipboard fallback)
- PWA shortcuts: long-press the app icon to check in a habit directly
- Dark mode (Auto / Light / Dark, follows the OS)
- Offline support via service worker — install it and it works with no network
- Diagnostics card (version, service worker status, storage, error log) in More

## Sync between devices

Daily Habits keeps your data on-device by design — there is no account or cloud.
To use it on two devices today:

1. On device A: More → **Export encrypted**, set a password.
2. Move the `.enc.json` file to device B (iCloud Drive, Google Drive, AirDrop…).
3. On device B: More → **Import encrypted**, enter the password, choose **Merge**.

Merge unions both copies: check-ins from either device are kept, each habit
appears once, and your current device's notes win conflicts. Repeat in either
direction to stay in sync. Backups use AES-GCM with a PBKDF2-derived key —
without the password the file is unreadable.

(Automatic end-to-end encrypted sync is in development.)

## Landing page

[landing.html](https://arponitis.github.io/daily-habits/landing.html) — product page with
install instructions for iPhone and Android.

## Run locally

Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Development

Pure logic (dates, streaks, schedules, insights, trends, templates, crypto,
import validation, migrations) lives in `lib.js` with no DOM dependencies,
so it is unit tested in Node:

```sh
npm test
```

The suite runs with `TZ=America/New_York` so DST boundary cases are exercised.
`db.js` (IndexedDB persistence) is tested with `fake-indexeddb`.

## Schedules

Each habit has a schedule: `daily`, specific `weekdays`, or `timesPerWeek`.
Streaks are schedule-aware — a Mon–Fri habit keeps its streak across the
weekend, and a 3×/week habit streaks on consecutive quota-meeting weeks.
Stored data is versioned (`v: 2`) and migrated forward on load.

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
db.js                 IndexedDB persistence with localStorage fallback (DHStore)
sw.js                 service worker: offline app shell
test/                 node:test unit suite (npm test)
manifest.webmanifest  PWA manifest
icon-*.png            app icons
landing.html          product/marketing page
ROADMAP.md            product strategy and phase plan
TESTING.md            manual test checklist
```

## Roadmap

- End-to-end encrypted auto-sync (in progress)
- Web Push reminders (in progress)
- Onboarding refresh: template picker on first run (in progress)
- Repo restructure: modularize JS, workers, tests (no build step)
- Home-screen widget / native wrapper (Capacitor)
