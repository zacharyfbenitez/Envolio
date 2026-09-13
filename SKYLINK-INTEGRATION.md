# FlightAware + Skylink

## Enabled

Server-only `SKYLINK_API_KEY` uses the direct v3.1 API. No key is sent to the browser.
FlightAware owns flight identity, scheduled/estimated/actual times and assigned inbound aircraft.
Skylink status is cross-checked against exact identifiers, route, origin-local date and scheduled time.
Only missing gate/terminal/baggage fields are offered as separately labeled additional details;
conflicts stay visible. Ambiguous `actual_time` is never used as a completed outcome.

`GET /api/flights/:ident/intelligence` follows a successful primary lookup (same date/origin/destination).
Loads status, METAR, departure/arrival TAF and filtered airport closure NOTAMs separately from primary results.
No current status/weather calls for far-future schedules. Published future-effective NOTAMs remain eligible.
TAF probability groups are modifiers, not the baseline and never flight-delay probabilities.
Skylink METAR also backs up unavailable/stale FlightAware observations before optional AWC.

`GET /api/flights/:ident/explore?product=...` is an on-demand allowlist:
tickets, duration, airport, routes, aircraft. The UI exposes itinerary alternatives,
typical duration, airport information and routes. No arbitrary paid upstream proxy.
Ticket results are not guaranteed inventory, a comprehensive schedule, or rebooking authority.

## Reliability and validation

6.5-second upstream deadlines, request coalescing, bounded caches, 429 cooldown and an
in-process 1,200-request/day Skylink safety budget. Budget is not a billing guarantee:
it resets on restart and is not shared across replicas. Provider billing controls remain necessary.
Stale responses retain original fetched timestamps and are excluded from current evidence.
Backtests use only verified actual gate departures available before each historical prediction.
No current-airline prior, test-set tuning, future outcomes, estimated outcomes or duplicate flights.
Only the route baseline is tested. The live weighted index is explicitly unvalidated.
Old and new index snapshots use distinct versioned keys.

## Deliberately not enabled yet

Not every Skylink catalog endpoint is consumed. Webhook subscriptions need scalable slot limits,
callback authentication and a persistent delivery worker; no subscriptions were created.
Historical ADS-B is not used as scheduled-versus-actual ground truth without verifying timestamp semantics
and retention/training rights. Charts, navigation aids, pilot briefings, winds aloft, SIGMET/PIREP,
carbon and aircraft-performance products need traveler-specific UX/validation rather than raw output.
Long-horizon ticket coverage does not replace FlightAware future schedules. No new purchase or plan upgrade.

## Traveler decision layer

The intelligence response now includes `brief`, with field evidence scores, traveler-confirmation
conflicts, assigned-inbound turnaround timing, exact-tail recent ADS-B position, airport operations,
route actual departure/arrival variance, and plain-language recommendations. FAA ground delays,
ground stops and airport closures are retrieved through `/delays/faa`; airspace-wide programs are
not attributed to an individual airport. Notice parsing is intentionally conservative: direct airport,
terminal and runway closures, plus runway entry/exit restrictions. Conditional/restricted notices
are withheld. Missing notices never mean an all-clear. No universal terminal-advisory coverage is claimed.

Field scores are a transparent evidence rubric (85 agreement, 55 one source, 20 conflict,
10 stale, 0 unavailable), **not calibrated correctness probabilities**. FlightAware and Skylink may
share upstream sources. Generic `Delayed` status and ambiguous `actual_time` are not compared as
departure delays. Weather, ATC and runway conditions are possible contributors, not confirmed causes.
The 45-minute turnaround allowance and historical p90 screen are labeled planning rules.

`GET /api/flights/:ident/connection` requires both flights to have a successful recent primary lookup.
Use the same first-flight query plus `next_ident`, `next_date`, `buffer` (20–360 minutes). The onward
lookup must specify the first flight's arrival IATA airport as `origin`. `alternates=true` requests
indicative Skylink tickets; departure times are interpreted in origin-local time and filtered after
arrival plus the traveler's allowance. Ambiguous DST times are rejected. Seats, internal itinerary
connections, fare eligibility and protected rebooking are **not** verified.

## Licensing gates and historical evaluation

No license approvals have been assumed. `docs/skylink-license-review.example.json` is an inactive
template, not an approval. After contractual and technical verification, an operator can maintain
`.data/skylink-license-review.json` server-side with an agreement reference and expiry. History and
alerts are independently default-deny. No public API can enable these permissions.

`POST /api/flights/:ident/watch` is gated and requires an HTTPS `SKYLINK_ALERT_WORKER_URL` and
server-only `SKYLINK_ALERT_WORKER_SECRET`. The external worker must enforce subscription capacity,
authenticate callbacks, deduplicate requests/events, route by exact flight instance/date, confirm
email consent, provide unsubscribe, and perform durable retries and delivery. The API only reports
activation after the worker returns `{active:true,subscription_id:...}`. That worker is not implemented
or configured in this pass; no subscriptions are active. Review these controls before enabling the gate.

Licensed historical inputs can be evaluated from `.data/skylink-reviewed-outcomes.jsonl` only after
storage/training rights and actual gate timestamp semantics are verified. Each normalized row needs:
`provider: "Skylink"`, `record_type: "actual_outcome"`, `actual_basis: "observed_gate_event"`,
`source_record_id`, `operating_ident`, ICAO `origin`/`destination`, UTC ISO `scheduled_out`/`actual_out`,
and `receipt: {endpoint, retrieved_at}`. The import rejects predictions, duplicates, wrong routes,
future outcomes and invalid receipts. Its expanding historical route-baseline evaluation remains
separate from live predictions and FlightAware history. No Skylink dataset has been imported,
no automatic historical collection is enabled, and no new model has been promoted to live use.

## Tests

`npm run test:providers`, `npm run test:reasoning`, `npm run test:e2e`, `npm run build`.
Provider adapter tests are deterministic. E2E fixtures mock both providers to avoid live latency.
`test:regression` still performs live FlightAware lookups; it is not a provider-isolated CI suite.
