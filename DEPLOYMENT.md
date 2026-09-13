# Contrail deployment

## Envolio phone app (PWA)

`npm run build` now packages the web manifest, branded 192/512px icons, a maskable Android icon, an Apple touch icon, and a versioned service worker. No native app-store package or signing is required for browser installation. The installed app uses the same content, glass navigation dock, and app menu as the website.

Use HTTPS (localhost is also supported) and set `PUBLIC_BASE` consistently at build time and runtime. For a dedicated domain use `/`; the chat.dev preview uses its existing port-specific path. Keep `sw.js`, `manifest.webmanifest`, and `index.html` revalidated, never immutable. The worker is scoped to the app path, not the shared hosting origin.

The offline cache includes only the first-party app shell and static assets. Flight APIs, personal submissions, third-party weather and airline logos are not cached by the service worker. Existing device-local saved lookup snapshots retain their original timestamp and are explicitly labeled as saved data. Unvisited flights need a connection. Installation does not enable push notifications or background monitoring.

New worker versions wait while the current app is open. Users can select **Update app** in the app menu; otherwise the new version activates after existing app tabs close. Cache cleanup only touches this app's own scoped shell caches and does not erase saved flights.

Verification: `npm run build && npm run test:pwa`. The PWA browser test uses an isolated local server, no provider credentials or billable API requests. For icon regeneration only, `npm run icons` uses the existing artwork and local Chromium. Check installation on a real iPhone (Share → Add to Home Screen) and Android (browser Install app) before store-level distribution; desktop mobile emulation is not a substitute for device testing.

Contrail is prepared as a single production container. The Express process serves both the built frontend and API on `0.0.0.0:$PORT`.

Required environment:

- `FLIGHTAWARE_API_KEY`: FlightAware AeroAPI credential.
- `PORT`: optional; defaults to `8787` outside the supplied container.
- `PUBLIC_BASE`: optional URL base path. Use `/` for a dedicated domain.

Build and run:

```sh
docker build -t contrail .
docker run --env-file .env -p 5173:5173 contrail
```

The orchestration health check should use `GET /healthz`. Termination signals are handled gracefully. Lookup telemetry is written to `.data/lookup-telemetry.jsonl`; mount `/app/.data` as a persistent volume if telemetry must survive replacement of the container.

Run `npm test` before promotion. The browser suite uses deterministic flight-lookup fixtures so provider latency cannot block CI; it still exercises input, routing, route selection, diagnostics, and codeshare UI. The server regression suite remains the live FlightAware integration check and can make billable AeroAPI requests.

Preflight checks:

```sh
npm ci
npm run build
npm test
docker build -t contrail .
docker run --rm --env-file .env -p 5173:5173 contrail
curl --fail http://127.0.0.1:5173/healthz
```

For production, terminate TLS at the hosting layer, persist `/app/.data` if telemetry and delay-index snapshots must survive replacement, and configure an alert delivery webhook only when background email/SMS monitoring is ready. Payment configuration is intentionally out of scope.
