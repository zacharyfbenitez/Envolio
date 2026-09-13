# Risk audit release

Release `risk-audit-v4` adds source-classified factor receipts, per-factor point contribution changes (including missing data and renormalization), verified aircraft journey, airport-specific FAA/FlightAware indicators, and actual-departure historical comparison windows.

The estimate remains experimental. A weather probability is not a flight delay probability. No new arbitrary weights or duplicated inbound/weather factors were added. Earlier storms warn but do not imply afternoon thunderstorms. Airline history is explicitly limited to completed departures returned by the operator endpoint, not a representative airline-wide archive. Missing samples show an unavailable state.

FAA older than 30 minutes and airport delay reports older than 10 minutes are not displayed as current favorable evidence. Existing NOAA forecast and METAR expiry checks remain. Existing last-successful flight lookup fallback remains labeled as saved, never a new live estimate.

## Monitoring

Server logs emit rate-limited structured alerts for weighted-score invariant violations, repeated provider failures, and extreme distributions (90% of 30+ scores at 0–5 or 95–100). Distribution alerts are investigative signals, not proof of bad scoring. No flight identifiers, travelers, keys, or full payloads are sent.

Set `MONITOR_WEBHOOK_URL` securely in Render for optional HTTPS Slack-compatible delivery. Do not commit its value. Configure `TELEMETRY_ADMIN_TOKEN` to read `/api/monitoring` with a Bearer token. Without it the endpoint returns 404. Delivery is best-effort; events are bounded to 500 per process, reset on restart, and repeated searches are not independent samples. This is an MVP, not durable monitoring or paging. Production log retention/external alert delivery must be configured by the operator.

## Release verification

Run `npm run test:operational-risk`, `npm run build`, `npm run test:audit`, and `npm run test:docker-runtime`. The AA4397-shaped storm/inbound fixture evaluates the actual production scoring function without billable API requests. Browser fixtures expand the source audit at 320, 768 and 1440 pixels and check overflow/runtime errors.

Push main to trigger the connected Render deployment. `/healthz` exposes `release: risk-audit-v4` and Render's commit identifier when supplied. Check the deployed flight API for `delay_index.audit.version`, then confirm the rendered percentage matches that response. Provider updates can legitimately change the number between searches; never force production to match a historical fixture's percentage.
