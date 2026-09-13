# Trip protection MVP

The results intelligence response contains `strategy.timeline`, `playbooks`, `airline_view`
and airport pressure cards. The homepage also exposes an airport-only check.

## Data boundaries

- The timeline samples the next 72 hours at three-hour intervals. TAF periods and notices
  are evaluated at each point. Uncovered periods are null, never filled with synthetic curves.
  Current ATC/congestion is not forecast into future bins. Short inbound turnaround appears
  only in the departure bin. Connection advice is shown separately after the onward check.
- Scores are disclosed heuristic severity/margin indices, **not calibrated probabilities**.
  Their formulas are in the API and expandable UI. Changed future-bin scores explain which
  signals apply; they are not claimed to be observed changes over time.
- Actual inbound timing comes from FlightAware's assigned previous leg, with tail checks.
  There is no claimed historical minimum turnaround. The existing 45-minute allowance
  remains explicitly an assumption. Actual aircraft assignment changes are detected across
  in-memory primary lookups; restarting loses that comparison history.
- Crew duty/legality, staffing, gate walking distance, internal maintenance, airport-wide
  cancellation comparisons, security and baggage queues are not available. They are visibly
  marked missing and are not inferred from a delayed flight.
- Airport Chaos Index uses returned weather/airport advisories with partial coverage.
  It does not claim a complete airport-wide disruption census or TSA/security prediction.
- Connection Survival Score is a transfer-margin index. The user chooses the allowance;
  terminal changes are flagged, not converted into invented walking minutes. Gate arrival
  estimates already include taxi time. Actual historical arrivals provide context, not a
  calibrated connection success probability or an official minimum connection time.

## Backups and preferences

`GET /api/flights/:ident/backups` uses the same primary lookup query, plus `priority`
(`price`, `simpler`, `earliest`), `avoidRedeye`, `avoidAirportChanges`, `avoidRegional`,
`minLayover` and `readyMinutes`. It requires a primary lookup within 15 minutes and no
actual departure. It searches the original local travel date and the following day.

Same endpoint airports, valid endpoint local times, readiness cutoff, published layovers,
same-airport connection chronology and deduplication are checked. Red-eye preference
means departures 22:00–05:59 local; it does not detect every itinerary flying overnight.
Unknown aircraft is disclosed, not claimed to satisfy a regional-jet restriction.
Alternative airport origins/destinations are not searched. Allowed connecting airport
changes are flagged because ground transport is unverified.

At most three first legs are cross-checked with Skylink status by exact route/date/time.
Matched cancellation/diversion is excluded. The remaining legs, seat inventory, fare
refundability, cancellation patterns and protected rebooking remain unverified. Skylink
quotes may be cached upstream for an hour; a new local fetch is not a new seat-inventory check.
No booking, cancellation, payment or email subscription is performed.

Users enable a per-flight page-open watch, saved locally with the last successful options.
The primary result refreshes every five minutes while visible, then refreshes secondary
data and enabled backups. No polling is promised after closing the page. Preferences
persist locally; provider failures preserve saved options with a stale warning. No new
server storage rights are assumed for historical training or customer profiles.

## Airport lookup

`GET /api/airports/:code/pressure` requires an exact IATA/ICAO airport match, then requests
METAR/TAF/NOTAMs, applicable FAA advisories and FlightAware airport delays. It shares
the existing bounded caches, provider budget and API rate limiter. Failure is unknown,
not an all-clear. FAA coverage remains FAA-jurisdiction only.

## Validation

`npm run test:providers` includes pure strategy tests for coverage gaps, stale evidence,
connection margins, preferences, backup chronology and safe action language.
`npm run test:e2e` includes mocked browser flows for the timeline, preferences, watch
persistence/provider fallback and standalone airport checks at desktop and narrow mobile widths.
Webhooks and licensed historical training retain the separate gates in SKYLINK-INTEGRATION.md.
