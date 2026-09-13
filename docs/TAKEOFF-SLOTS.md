# Real takeoff slots: access and integration plan

Research checked 2026-09-13. Envolio has an adapter contract and presentation layer, **not an active FAA or EUROCONTROL slot subscription**. No applications, license purchases or vendor messages were sent. No public lookup pages are scraped. `estimated_off`, ETOT, airline ETD, airport delay averages and predicted runway times are never promoted to an assigned EDCT/CTOT.

## US: FAA EDCT / TFMS / SWIM

1. Register the business and responsible contact at the [SWIFT Portal](https://portal.swim.faa.gov/); review and sign applicable Service Access Agreements. Find Traffic Flow Management Data in the [FAA agreement catalog](https://aa.data.faa.gov/). Normal publicly released subscriptions can be automatic after agreement acceptance; that does NOT establish access to restricted slot/CDM services. [Onboarding](https://support.swim.faa.gov/hc/en-us/article_attachments/360096864051), [approval FAQ](https://support.swim.faa.gov/hc/en-us/articles/360034504091-How-long-is-the-approval-process-to-receive-the-desired-data-set-from-sending-the-request-until-receiving-access).
2. Email **Data-To-Industry@faa.gov** requesting the precise EDCT-capable subscription and, if required, TFMS Request/Reply/CDM eligibility review. The ordinary portal does not support those restricted services. Ask whether released TFMData flight updates provide the required assignments/revisions/removals or whether approved EDCT Check/List/Show access is necessary. [Current FAA access instructions](https://www.faa.gov/air_traffic/technology/swim/products/get_connected), [FAA TFMS service presentation](https://www.faa.gov/air_traffic/technology/swim/swift/2021-november-10-swift-16-meeting-presentation.pdf).
3. Obtain service description, schemas, field-release scope, filter limits, approved credentials, maintenance notifications and written confirmation for traveler-facing website/iframe display. Access approval timing for restricted services is not published in the reviewed instructions. Do not assume access to other airlines' restricted CDM data.
4. Build a persistent TLS/Solace JMS consumer using approved schemas. Reconcile initial state and updates, retain removals, handle reconnect/replay and normalize records into the contract below. A sustained consumer with durable state belongs in a background worker, not inside a browser or per-search HTTP request.

**Costs:** FAA's published SWIM FAQ says data currently has no cost; consumers pay their own interface-development costs. Worker hosting, storage, monitoring and engineering are ours. Confirm restricted service terms and any third-party adapter fees before budgeting; a free data feed is not a turnkey free API. [FAA cost FAQ](https://www.faa.gov/air_traffic/technology/swim/questions_answers). Observe the [SCDS usage guidelines](https://www.faa.gov/sites/faa.gov/files/air_traffic/technology/swim/governance/SCDS-Guideline-Document_v1.1_09.11.2024), including subscription/egress constraints; filter early rather than consuming duplicate national feeds.

The [public EDCT lookup](https://www.fly.faa.gov/edct/) is a manual operator reference, not our supported ingestion endpoint. Its existence does not establish bulk API or redistribution rights.

## Europe: EUROCONTROL CTOT / NM B2B

Apply through [NM Requests](https://www.eurocontrol.int/form/nm-requests) with business details and a designated contact. Be explicit that Envolio is a consumer travel product, not an airline or flight-plan filer. Ordinary eligibility is operational; commercial value-added/public display use is restricted and requires explicit arrangements. Ordinary access alone is insufficient. [Eligibility and data rules](https://www.eurocontrol.int/info/agreements-rules-and-policies).

Request read-only flight data retrieval/updates containing CTOT plus regulation and slot-removal/revision information, exact scope, and written public-display rights. Do not request flight-plan filing or slot modification privileges. Approved access uses TLS/PKI certificates and XML via SOAP/POX or AMQP. Pre-OPS validation precedes an operational certificate. Published fees describe two free certificates per location, then €200 each, but the page flags a revised charging scheme for 2025/2026: obtain a current written quote; this is not a consumer redistribution price. [NM B2B service/access/fees](https://www.eurocontrol.int/service/network-manager-business-business-b2b-web-services).

**Recommendation:** pursue a licensed intermediary for Europe while checking direct eligibility. We cannot promise direct approval, commercial redistribution rights, coverage or an approval timeline.

## Existing vendors: concrete procurement request

Ask FlightAware and Skylink for an actual schema and a replayable sample of assigned, revised and removed slots for one US and one European flight. Require: FAA EDCT/EUROCONTROL CTOT provenance; operating callsign + route + flight date correlation; message identifier; source-issued and source-verified timestamps; reason/regulation; completeness and heartbeat semantics; coverage, latency and outage SLA; quotas; history rights; consumer website and Ghost iframe redistribution rights; and price by volume/territory.

FlightAware documents streaming flight-status layers and subscription-dependent pricing, but that is not proof of EDCT/CTOT entitlement. [Firehose](https://www.flightaware.com/firehose/documentation). Skylink's reviewed [flight-status schema](https://skylinkapi.com/docs/v31/flight-status/) describes ordinary departure/arrival timing, while [FAA Delays](https://skylinkapi.com/docs/v31/faa-delays/) is an advisory integration; neither establishes a flight-specific EDCT/CTOT contract. Treat both vendors as confirmation paths, not already-connected slot sources. Never substitute simulator/VATSIM slot APIs for real-world data.

Suggested FAA request text (owner should send):

> Envolio (https://envolio.travel) is developing a read-only traveler information website, including embedded flight checks. We need flight-specific EDCT assignments, revisions and removals for commercial flights, with source timestamps and restriction reasons. Which released TFMData service provides these fields? If TFMS Request/Reply or CDM approval is required, please advise eligibility and the application process. Please confirm permitted public consumer display/redistribution, required agreements, costs, filters/quotas, technical schemas, and validation requirements. We will not use the feed for operational clearance, dispatch or slot modification.

Before applications: owner supplies legal business name, address, authorized contact and business email directly to the agency/vendor. Agreements must be accepted by an authorized representative. Store issued credentials/certificates as deployment secrets—not in chat or Git.

## Implemented adapter contract

`takeoff-slots.js` issues a server-only authenticated GET to a **trusted adapter we control or contract**, not directly to a fictional FAA/NM REST endpoint. That adapter still needs to be built against the approved source schema. Query parameters: `operating_ident`, `origin`, `destination`, `scheduled_out`. Airports are ICAO; times include UTC/offset. The adapter must correlate native flight-plan identifiers to the selected operating flight/date/route and preserve authority identity.

Response envelope:

```json
{"records":[{
  "authority":"FAA",
  "kind":"EDCT",
  "operating_ident":"RPA4397",
  "origin":"KJFK",
  "destination":"KBOS",
  "scheduled_out":"2026-09-13T19:30:00Z",
  "status":"revised",
  "assigned_time":"2026-09-13T20:15:00Z",
  "previous_time":"2026-09-13T20:00:00Z",
  "issued_at":"2026-09-13T18:54:00Z",
  "verified_at":"2026-09-13T18:55:00Z",
  "valid_until":"2026-09-13T19:00:00Z",
  "message_id":"EXAMPLE-NOT-LIVE",
  "reason":"Example only — do not ingest as production data"
}]}
```

For Europe: `authority: EUROCONTROL`, `kind: CTOT`. Statuses: `assigned`, `revised`, `removed`, `not_assigned`. Empty records means **unavailable**, never “no slot.” `not_assigned` requires an explicit current source response. A removal must not be mistaken for cancellation of the flight. `verified_at` means the adapter reconciled current assignment state with the upstream source, NOT that somebody fetched an old cached message. Reasons must be publishable and translated from the genuine source, not invented.

Render/server environment for each authority (`FAA` or `EUROCONTROL`):

- `SLOT_<AUTHORITY>_ENABLED=true`
- `SLOT_<AUTHORITY>_PUBLIC_DISPLAY_APPROVED=true` — only after written approval
- `SLOT_<AUTHORITY>_RIGHTS_EXPIRES_AT=<ISO timestamp>` — contractual expiry or internal re-review deadline
- `SLOT_<AUTHORITY>_URL=<HTTPS adapter URL>`
- `SLOT_<AUTHORITY>_TOKEN=<secret bearer token>`
- `SLOT_<AUTHORITY>_PROVIDER_NAME=<public attribution>`

All default disabled. The URL and credentials are never returned to clients. No direct FAA/NM passwords, endpoints or certificates are exposed. No secret is needed for testing fixtures.

## Product behavior and limits

The flight API exposes `takeoff_slot`. Assigned/revised records show a dedicated card with airport-local time, authority, verified time and reason. Missing/expired/conflicting records produce an unavailable state; removal has distinct copy. Saved-flight fallback strips the assignment. Departed/cancelled/schedule-only flights do not receive current slot assertions. Aircraft taxiing can still have a valid assignment. Slots are not gate-departure estimates or takeoff clearances.

Exact operating identity, route and selected scheduled departure must match. Five-minute verification age, one-minute future-clock allowance, 15-minute past-slot cutoff and 24-hour schedule proximity are conservative **Envolio display guards**, not official slot-tolerance rules. Providers must reconcile schedule changes; mismatches fail closed rather than guess. No flight-delay percentage weights were changed, so no duplicate ATC/model adjustment was introduced.

Three-second timeout, HTTPS only, redirects rejected, 128 KiB response limit, 50-record maximum, 30-second cache, concurrent-request coalescing and bounded per-process revision guards. Provider failure monitoring uses existing alert plumbing. Cache/revision guards reset on restart; the authorized adapter MUST maintain durable sequence/reconciliation state and prevent old assignments from reappearing after withdrawals. Multi-authority simultaneous assignments are not silently merged. Rights are rechecked per lookup. No durable agency consumer, automatic traveler slot alerts or real-data end-to-end validation exists until access is granted.

Tests: `npm run test:slots`, `npm run build`, `npm run test:audit`, `npm run test:docker-runtime`. Fixtures test genuine-field semantics, wrong route/date/codeshare, CTOT, expiry, conflicting revisions, withdrawal, rollback, permissions, network errors and oversized payloads. These verify our ingestion boundary, not live agency coverage.
