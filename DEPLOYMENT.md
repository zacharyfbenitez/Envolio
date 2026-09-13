# Envolio.travel deployment

Create a paid Render **Web Service**, connect `zacharyfbenitez/Envolio`, select `main`, Docker runtime, and `./Dockerfile`. No Vite dev server or custom start command is needed. The Docker CMD starts Express and serves the production website plus API. Set health-check path `/healthz`.

Environment:

- `NODE_ENV=production`, `PUBLIC_BASE=/`, `PORT=5173` (Docker defaults).
- `FLIGHTAWARE_API_KEY` and optional `SKYLINK_API_KEY`: provider secrets entered only in the host dashboard.
- `ENABLE_AWC_METAR_FALLBACK`: optional weather fallback.
- `ENABLE_ALERT_SUBSCRIPTIONS=false`: keep disabled until consent, delivery and opt-out flows are tested.
- `TRUST_PROXY_HOPS`: set only to the trusted reverse-proxy topology confirmed for the host. Defaults to 0; a shared proxy otherwise shares request limits.
- `TELEMETRY_ADMIN_TOKEN`: optional server-only secret protecting operational aggregates.

Mount persistent storage at `/app/.data` if retaining telemetry and snapshots. A Render persistent disk limits the service to one instance and prevents zero-downtime deploys. Move durable state to a database before multi-instance scaling.

## Docker verification

```sh
docker build -t envolio-web .
docker run --rm --env-file .env -p 5173:5173 envolio-web
curl --fail http://127.0.0.1:5173/healthz
```

The runtime copies all local backend modules, including `route-search.js`; the initial commit omitted them and failed with ERR_MODULE_NOT_FOUND on Render. `npm run test:docker-runtime` checks the runtime file set without requiring Docker. Run an actual image build in Render or Docker before declaring deployment successful.

## GoDaddy DNS — only after the Render URL works

Add `envolio.travel` first under Render Settings → Custom Domains. Use Render's current displayed DNS values; its documented GoDaddy-compatible root target is A `@` → `216.24.57.1`. Set CNAME `www` → the actual assigned `<service>.onrender.com` hostname, not an invented example. Use a one-hour TTL.

Replace the old GoDaddy WebsiteBuilder Site root target; remove conflicting website A/AAAA records only for the migrated hostnames. Preserve email, NS, SOA, pay and _domainconnect records. Do not use masking or forwarding to the chat.dev preview. Verify both hostnames in Render and wait for HTTPS before testing the public site. Render configures www-to-root redirection when root is added first.

## Launch gates

Check representative live flights within an agreed provider budget, real-device layout/accessibility, source freshness, privacy/support information, licensing, provider budgets and monitoring. DNS success is not product readiness. Inbound conversational SMS is not implemented and must not be advertised as live.

References: [Render DNS](https://render.com/docs/configure-other-dns), [custom domains](https://render.com/docs/custom-domains), [persistent disks](https://render.com/docs/disks).
