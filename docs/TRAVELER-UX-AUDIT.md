# Traveler UX audit — September 13, 2026

## Changes

- Main upcoming-flight results use the backend's combined delay score as an explicitly experimental percentage for leaving 15+ minutes late. The UI does not recompute weights, pool additional providers, or substitute a route average.
- Only Why, Reliability, and Updated sit below that number. Missing modeled inputs lower the stated reliability; unavailable or saved-only data does not become a live estimate.
- Cancelled, airborne and landed flights do not show a forward-looking departure likelihood.
- Incoming aircraft now has reported departure/landing/gate states, previous-flight route, gate-arrival timing, and the time available before scheduled departure. An unassigned aircraft has an explicit empty state.
- A location link requires valid coordinates and a position timestamp within 15 minutes. No invented route progress or stale location is presented as live tracking.
- Landing does not imply gate arrival or readiness for boarding. The departure timeline no longer infers active boarding or cleaning from elapsed time alone.
- Existing weather summaries, source-conflict warnings, saved flights, search clarification, and optional connection tools remain available.

## Repeatable checks

`npm run test:audit` checks presentation logic and browser layouts at 320, 768 and 1440 pixels across home, saved flights, route landing, airport landing, premium, developer, upcoming flight, airborne flight, landed flight, cancellation and lookup failure pages. It checks horizontal overflow, browser runtime errors, headline percentage, experimental labeling, incoming-plane timing and correct suppression of forecasts after departure/cancellation.

Additional suites: `test:web-launch`, `test:search`, `test:providers`, `test:reasoning`, `test:docker-runtime`, and `node --test tests/intelligence.e2e.test.mjs`.

## Limits

Browser scenarios use deterministic fixtures; they do not establish live-provider availability, model accuracy, licensing, alert delivery, or production deployment success. The existing backend remains unchanged. Operational adjustments are not independently validated probabilities; source agreement is not independent evidence. Runway/ATC/weather notices shown elsewhere are not added a second time to the displayed backend score. Not every provider notice, language, device or rare flight state is covered by these checks.
