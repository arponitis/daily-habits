# Device testing checklist

Run through this on at least one iPhone (Safari) and one Android phone (Chrome)
before calling a release done. Check off what you verify.

## Install (PWA)
- [ ] iOS: Share → Add to Home Screen installs; icon looks right (no white bars)
- [ ] Android: ⋮ → Install app works; splash screen shows
- [ ] App opens standalone (no browser chrome) from the home-screen icon
- [ ] App name under the icon reads "Habits"

## Offline
- [ ] First visit online, then airplane mode: app still loads
- [ ] Check-ins made offline persist; "Offline" pill shows in the header
- [ ] Back online: pill hides, no data loss

## Core flows
- [ ] Add a habit with each schedule type (daily / weekdays / × per week)
- [ ] Check in, undo via toast, add a note
- [ ] Bottom sheet opens/closes (tap, ✕, backdrop, swipe-down, Escape on desktop)
- [ ] Stats tab renders; insights appear after a few days of data
- [ ] Calendar backfill works for past days

## Appearance & motion
- [ ] Dark mode: Auto follows the OS; Light/Dark switch instantly; all tabs readable
- [ ] No flash of wrong theme on cold start
- [ ] Animations feel smooth; enable reduced-motion in OS settings → animations stop

## Reminders
- [ ] Permission prompt appears; test notification arrives
- [ ] Daily reminder fires at the set time while the app is open (once per day)

## Data
- [ ] Export downloads a JSON file; import restores it
- [ ] Diagnostics card in More shows version, SW status, storage

## Viewport & safe area
- [ ] No content hidden behind the notch / home indicator
- [ ] Tab bar reachable with one thumb; no horizontal scrolling
