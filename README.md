# Daily Habits

A simple, private daily habit tracker. Check in once a day, watch the streaks grow.

No accounts, no servers, no tracking — everything is stored in your browser's
localStorage on the device you use it on.

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

## Deploy

This is a static site — it deploys anywhere:

- **GitHub Pages:** repo Settings → Pages → Deploy from a branch → `main` / root
- **Netlify / Vercel / Cloudflare Pages:** point at this repo, no build step

On iPhone: open the deployed URL in Safari → Share → **Add to Home Screen**.
It launches full-screen like a native app (manifest + apple-touch-icon included).

## Project structure

```
index.html            markup + tab shell
styles.css            mobile-first styles
app.js                all logic (state, streaks, rendering)
manifest.webmanifest  PWA manifest
icon-*.png            app icons
```

## Roadmap ideas

- Daily reminder notifications
- Weekly review summary
- Home-screen widget / native wrapper (Capacitor)
