# Envolio website

React/Vite website and Express flight-data API for **https://envolio.travel**. Native projects, app-store tooling and install-app UI are not part of this branch. The API backend is required; do not deploy this as a static-only site.

## Local development

Requires Node 22+.

```sh
npm ci
# Optionally copy .env.example to .env and configure provider credentials locally.
PUBLIC_BASE=/ npm run dev
```

Website: port 5173. API: port 8787. Provider keys stay on the server; never put them in VITE variables.

## Production / Render

Use a Docker **Web Service** from this repository's `main` branch. Dockerfile: `./Dockerfile`. Health check: `/healthz`. The container serves the built website and API together on `0.0.0.0:5173` with `PUBLIC_BASE=/`. Keep alert subscriptions disabled until messaging is ready.

See [deployment instructions](DEPLOYMENT.md) and [remaining launch gates](docs/WEB-LAUNCH.md). The text agent is planned, not yet implemented.

## Checks without paid provider requests

```sh
npm ci
npm run build
npm run test:web-launch
npm run test:search
npm run test:providers
npm run test:reasoning
npm run test:docker-runtime
```

Browser checks use Chromium (`/usr/bin/chromium` in the development environment). The runtime test builds an isolated production website and verifies the Docker runtime file set starts; it does not execute Docker itself. Live-provider checks in `npm test` can make billable requests.

Generated assets, credentials and runtime data are excluded from Git. Saved flights remain in each user's browser. `public/sw.js` is only a retirement script for the older offline worker; new visitors do not register a service worker.
