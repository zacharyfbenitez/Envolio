# Account / signup implementation — 14 September 2026

## Implemented

- Email-code sign-in followed by a two-step signup: private international phone, name/handle, home airport, favorite airline and aircraft. Verified email is enforced by the onboarding database function. Profile and contact creation is atomic.
- Account overview, 30/90-day/year/all-time statistics, explicit travel log, profile editing, friends and settings. Favorites appear in compact profile tiles.
- Exact-handle opt-in discovery, requests, accept/decline/remove, friend profile viewing, block/unblock, report capture and separate sharing controls. Private contacts and future saved flights are never shared with friends.
- Missing flight times stay missing. Saving is not counted as travel; manual records do not acquire invented timings. No aviation scoring/model-weight changes.
- Bounded account requests, retry/empty states, modal focus handling, field error associations, reduced-motion support, responsive layout, account/profile noindex headers, sign-out state isolation.

## Evidence

- Production Vite build passed, including lazy-loaded account assets.
- Real PostgreSQL integration passed after final migration changes: owner isolation, denied anonymous/unverified signup, protected phone/saved-flight/log access, accepted-friend sharing, opt-in statistics/history, recipient-only acceptance, blocking and request cooldown. Hosted Supabase is not used by this test.
- Signup/helper unit tests passed: private phone formatting, required favorites, reserved handles, airport-code shape, impossible/future log dates and no invented timings.
- Account infrastructure tests passed: per-user RLS/outbox isolation and refusal to send from a disabled worker.
- Extended browser test passed with mocked Supabase: recover from sign-in failure, verify code, complete both signup steps, create favorites, save a flight, edit profile, request a friend, add/remove a trip and change privacy settings; no page runtime errors.
- Browser account layout checks passed at 320, 390, 768 and 1440px without document overflow. Mobile screenshot visually inspected. This is Chromium viewport testing, not physical iOS/Safari testing.
- A combined browser run exceeded its 180-second test budget under machine load; the isolated expanded run passed in 188 seconds with a 300-second outer budget. Do not report the timed-out run as a pass.
- Existing departure-label regressions passed: green On time within 48 hours only with eligible reported data; no promotion of stale, missing or schedule-only data.
- Final regression batch: 8/8 passed, including PD604 saving/reload/removal and blocked-storage feedback. The expanded account browser suite passed separately (1/1).

## Not a public-account launch yet

Accounts remain feature-gated. Provision Supabase and apply the three migrations in documented order, configure production email-code delivery and abuse protection, then verify with real accounts on two devices before enabling registration. No passwords or service keys should be posted in chat.

Phone capture is private but unverified; SMS is not implemented. Background notification monitoring/delivery is not activated. Assign report moderation and verified account-deletion handling; a self-service deletion workflow is still outstanding. The current export explicitly limits travel-log entries to 1,000. See `ACCOUNTS-NOTIFICATIONS.md` for exact configuration and rollout constraints.
