# Public mobile smoke pass — 2026-09-13

Environment: https://envolio.travel, 390 × 844 touch/mobile Chromium. This is a mobile-sized browser, not a physical iPhone or Safari engine. Initial deployed commit: `52ff0fff1e9b9f4a231f3f39ae9d08b65c45ab0b`.

## Live provider flow

Searched “American 100 tomorrow”. The live provider resolved AA100, JFK–LHR, September 14, scheduled departure 22:20 UTC. Search → summary → Watch flight → Saved → notification settings completed. One saved trip remained; notification preferences could be reopened. No background messages were requested.

A separate controlled run explicitly toggled gate alerts from true to false and verified false persisted after navigating through Saved. Overnight arrival displayed September 15 / +1 day. Missing departure gate, terminal, arrival gate and baggage displayed “Not reported”. No horizontal overflow was found in the tested states.

## Reproduced defects and fixes

| Defect before fix | Change |
| --- | --- |
| Canceled flights retained green expected-on-time badges and a departure timeline | Cancellation now overrides stale status text; original schedule is labeled; on-time badges, boarding timeline and connection tool are suppressed. |
| Cancellation/diversion boolean flags were ignored by headline/advice when status text still said Scheduled | Shared flag-aware status and advice helpers. |
| Diverted flights said En route to LHR and retained an unverified on-time arrival estimate | Listed destination is explicitly unverified; arrival and operations ask for airline confirmation instead of claiming the original airport is current. |
| Partial position object without coordinates triggered the screen error boundary | Finite-coordinate checks and independent missing-field fallbacks. |
| Null altitude/speed rendered as 0 ft / null kt | Missing measurements now say Not reported; genuine numeric zero remains valid. |
| Saved navigation dropped the selected scheduled departure query parameter | Saved links carry the snapshot's scheduled departure. |
| Cancellation change strip displayed an unrelated gate-change instruction | Gate instruction is now conditional on an actual gate/terminal change. |

The canceled/diverted cases are controlled provider-response fixtures, not claims about AA100's real status. This pass establishes reproducible defects; it does not establish which earlier release introduced them.

## Repeatable checks

`ASSERT_FIXED=1 TEST_PUBLIC_URL=https://envolio.travel node tests/public-mobile-smoke.mjs` runs the complete flow and edge cases with intercepted API responses. It asserts a rendered summary, not only absence of browser page errors—the React error boundary can catch failures without emitting a pageerror event.

`LIVE_LOOKUP=1 node tests/public-mobile-smoke.mjs` performs one live-provider journey before switching to controlled cases. This may use provider quota. It does not subscribe to text/email delivery.

Remaining checks: physical iPhone Safari/keyboard behavior; actual background SMS/email delivery after infrastructure is enabled. A durable provider flight ID in saved-trip identity would further strengthen same-day multiple-leg disambiguation beyond preserving the departure timestamp.
