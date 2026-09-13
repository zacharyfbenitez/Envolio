# Weather and aircraft rotation audit — September 13, 2026

## AA4397 findings

A bounded production lookup returned AA4397 / RPA4397, JFK–BOS, scheduled September 13 at 19:30 UTC (15:30 New York). Its old combined score was 39. Departure weather scored only 8/100 using the 11:51 UTC METAR, including rain/mist and an overcast ceiling of 600 ft. The scorer did not examine cloud ceiling and used present observations for an afternoon trip. The separate SkyLink forecast UI was not feeding the combined score. Only one incoming flight was retrieved.

The NOAA AWC 11:20 UTC JFK TAF contained morning thunderstorms and later improved thunderstorm conditions. This does not prove storms at the flight's scheduled departure. Warnings now distinguish an overlapping forecast hazard from possible residual disruption after earlier weather.

A local run of the patched backend with live provider data returned 47 and verified same-tail N408YX links through RPA4470, RPA4370 and RPA4633 to RPA4397. A prior-leg weather forecast contributed to the inbound factor. These are timestamped audit observations, not a promise that subsequent refreshes return the same assignment or percentage.

## Behavior

- NOAA AWC TAF JSON is fetched server-side for departure/arrival airports and at most two earlier-leg departure airports not already represented in the current flight's weather factors.
- Enabled by default; `ENABLE_AWC_TAF=false` disables the TAF integration. No weather API key is required. Requests coalesce per airport, cache for 10 minutes (failed responses for one minute), time out after 3.5 seconds, and use a custom User-Agent. The cache has 100 entries.
- A process-wide budget limits new TAF requests to 60 per minute. Multiple deployed instances would need a shared limiter before scaling this limit across them.
- A forecast must match the airport, cover flight time, have a valid issue time within 12 hours, and contain interpretable baseline periods. Forecast pressure uses the strongest applicable period within an hour of the planned flight time. Probability groups remain weather probabilities, not flight-delay probabilities.
- Current METARs are only scoring inputs within two hours of the flight event. Missing weather values do not default to calm wind or good visibility; low cloud ceiling is recognized where supplied in the METAR.
- Existing weather factor weights remain unchanged. A maximum, not a sum, combines near-time observations and flight-time forecasts. Earlier forecast weather yields a warning, not an assumed numeric residual delay.
- Follow up to three exact FlightAware inbound IDs with connected routes, chronological schedules and matching known registrations. Stop at a departed leg, assignment mismatch, cycle, unavailable data, or the traversal cap. Each additional lookup has a 2.5-second wait budget; an underlying cached request may finish afterward.
- Reported earlier delays propagate only after subtracting available ground time beyond a labeled 45-minute preparation allowance. Actual departure/arrival and updated arrival estimates can break the chain or show recovery. Earlier cancellation raises an aircraft-reassignment warning, not a declaration that the user's flight is cancelled.
- Direct inbound, prior-leg delay and prior-leg weather pressure use a maximum within the existing inbound factor. Weather at current-flight airports is not added again as upstream weather.
- `weather-rotation-v3` starts a separate snapshot series so a model revision does not appear as a weather-driven movement.

## Validation and limits

Run `npm run test:operational-risk`, `npm run test:providers`, `npm run test:reasoning`, `npm run test:audit`, and `npm run test:docker-runtime`.

The new operational mappings and 45-minute allowance are heuristics, not airline minimum turnaround times or empirically calibrated probabilities. Historical backtesting still validates only the historical route component. This does not add radar, en-route thunderstorm geometry, crew/maintenance forecasting or complete morning-weather archives. An airport TAF is not a city-wide forecast. Earlier weather is assessed from periods actually returned; no warning means no matched evidence, not guaranteed clear conditions.

Reference: https://aviationweather.gov/data/api/ (TAF endpoint, timestamped JSON, request limits and server-side access).
