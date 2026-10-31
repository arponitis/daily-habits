# Daily Habits — Roadmap: making it the best daily habit tracker

## Goal

Make Daily Habits the best daily habit-tracking app. The strategy, backed by
2026 competitive research: the feature list is almost irrelevant — the
retention mechanism is everything. Streaks wins by disappearing into the
watch/widgets, Loop wins on free + private + forgiving scoring, Habitify on
sync-everywhere, Finch/Habitica on emotion.

**Our open lane: private + cross-platform.** Loop is Android-only; every
sync-everywhere player holds your data in the clear. Nobody owns *the habit
tracker that syncs without ever seeing your data.* Every phase below ladders
up to owning that.

## Where v1.5 stands

- Vanilla JS, zero dependencies, ~2,900 lines, no build step. Offline-first
  PWA. `lib.js` pure logic with 53 unit tests. AES-GCM encrypted backups,
  merge-on-import sync primitive, PWA shortcuts, deep-link check-in,
  share-your-streak. GitHub Pages hosting. No CI; no automated UI tests;
  reminders only fire while the app is open; sync is manual.

## Avenue 1 — Technical Architecture

Keep the zero-build, zero-dependency principle — it is a moat (fast, tiny,
auditable), not a limitation.

1. **Web Push reminders (backend).** The single biggest functional gap:
   reminders only fire with the app open. Web Push now works on iOS 16.4+
   (installed PWA), Android, and desktop. Needs: a tiny backend
   (Cloudflare Workers free tier), VAPID keys, push-subscription storage,
   and a service-worker push handler with a "Mark done" action button.
   Keep payloads opaque to preserve the privacy story.
2. **E2E-encrypted auto-sync.** Manual export → cloud drive → import+merge
   is a power-user feature, not a product. Next: upload encrypted blobs on
   change, pull + merge on launch, reusing the existing crypto and merge
   semantics. No CRDTs needed — per-day-entry merge is sufficient for this
   data model.
3. **localStorage → IndexedDB.** The 5 MB synchronous API blocks the main
   thread; IndexedDB is async with real quota headroom.
4. **Automated UI tests.** 93 top-level functions in `app.js`, 41 inline
   `onclick` handlers, zero UI tests. Add Playwright covering check-in,
   undo, import, and the encrypted round-trip.
5. Later: CSV export, richer schema migrations.

## Avenue 2 — Design and Appearance

Current design is clean and functional but generic — a competent prototype
with no signature.

1. **Forgiving streaks (streak freeze / rest days).** The #1 reason people
   abandon trackers is one missed day nuking a streak. Highest retention
   ROI per unit of effort in the category.
2. **GitHub-style heatmaps** per habit + a year view — the "visual proof"
   motivator. Canvas-based, no dependencies.
3. **Habit templates / starter packs in onboarding.** Cuts time-to-first-
   value; current onboarding just says hello.
4. **A real visual identity.** Distinctive iconography, typography, brand
   color — the app needs a signature.
5. **Widgets, honestly:** iOS home-screen widgets need WidgetKit (native);
   PWAs can't do widgets on either platform. Web Push notification action
   buttons ("Mark done" from the lock screen) get ~70% of the value with
   zero native code. True widgets wait for the native-wrapper decision.

## Avenue 3 — Deployment and Maintenance

1. **CI on every PR** (GitHub Actions running `npm test`). Tests currently
   only run on the maintainer's laptop.
2. **Preview deployments per PR** so UAT happens *before* merge. Evaluate
   **Cloudflare Pages** vs GitHub Pages: previews, cache control, and
   Workers for the push/sync backend in one platform.
3. **Opt-in remote error reporting** (Sentry). The on-device diagnostics
   card never surfaces real-world crashes.
4. **Release discipline:** changelog, versioned releases.
5. **Privacy-respecting analytics** (Plausible) to learn which features get
   used.
6. **App Store path:** Apple rejects pure PWA wrappers without native
   features, so this means a Capacitor wrapper — sequenced *after* push +
   sync + retention land, since a wrapper around today's app adds
   distribution without a reason to stay.

## Sequencing

- **Phase A (next, 2–3 weeks):** CI + preview deploys · Web Push reminders
  backend · streak freeze.
- **Phase B:** E2E-encrypted auto-sync · heatmaps · IndexedDB migration.
- **Phase C:** templates/onboarding refresh · visual identity · analytics.
- **Phase D (strategic bet):** Capacitor native wrapper for widgets +
  App Store — only once A–C prove people stay.
