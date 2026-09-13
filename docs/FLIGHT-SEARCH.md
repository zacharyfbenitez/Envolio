# Envolio guided flight search

The home and landing-page search form now uses `FlightSearch.jsx` and a separately tested, deterministic parser. It accepts IATA/ICAO flight identifiers, airline-name/number phrases, numeric flight numbers with an airline follow-up, pasted multi-flight text, airport pairs, city routes and supported natural-language dates. It is not an unrestricted language-model chatbot; unrecognized airports, missing airlines and ambiguous dates require user input.

Search text is parsed in the browser. Only structured identifiers, dates and airport hints are sent to the backend. Do not paste passenger/payment information. Recently opened flight metadata stays in device-local storage and can be cleared independently of favorites.

Flight-number searches reuse the existing FlightAware lookup/codeshare resolution. Multiple legs or departures produce a chooser rather than silently opening the first result. Selection preserves both airports and the scheduled departure timestamp. An exact-result, single-use memory handoff avoids paying for a second identical lookup; another leg is always looked up independently so its delay analysis cannot be borrowed from the first leg.

`GET /api/flight-search?origin=JFK&destination=LHR&date=2027-03-05` searches FlightAware published schedules. Optional `airline` narrows the provider query. This is route discovery, not live status, inventory, or a guarantee of operation. It requires exact airports, resolves the origin timezone, and queries the origin-local day (including daylight-saving transitions). Searches are bounded to three pages and cached for five minutes. Truncated results are explicitly labeled. Account restrictions, outages and zero returned matches are not presented as proof a flight does not exist. Past route discovery directs users to a flight-number search.

Checks: `npm run test:search`, provider/reasoning tests, production build, and browser regressions. `SEARCH_SCREENSHOTS=1 npm run test:search` also saves desktop/phone layout captures. Browser provider results are fixtures; use a bounded live route lookup separately to verify the configured account.
