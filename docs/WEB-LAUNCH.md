# Envolio.travel — website-first launch

Native iOS/Android/App Store infrastructure has been removed from the current branch and preserved in an external local backup and prior Git history. Initial direction: globally accessible website plus a text agent. Owning a domain does not deploy the site or activate SMS.

## Completed in this pass

- Restarted the preview website on port 5173.
- Fixed search form sizing within its parent and reduced hero spacing. Hide the floating dock while the search form has focus so it does not cover input controls.
- Saved navigation now opens a real saved-flight list, with open/remove actions and an empty state.
- Edit search retains the failed flight number, departure date and airport hints.
- Watch dialog gains initial focus, Tab containment, Escape handling and focus return. Done replaces the misleading Save label; preferences save on change.
- Added bounded in-memory API request/write limits, retry guidance and no-store API responses. Unknown API routes return JSON 404 rather than the HTML app.
- Public feedback no longer persists arbitrary reason/route text. Telemetry summary requires a server-only admin token.
- Text/email subscriptions are off by default until delivery/consent/opt-out behavior is verified.
- Fixed the Docker runtime's missing server modules; tightened secret/artifact exclusions.
- Canonical/social metadata and sitemap now use https://envolio.travel/. Only the home page is advertised in the sitemap until route-specific SEO is fully reviewed.

## Hosting setup still required

The current chat.dev exposed URL is a preview, not always-on hosting: machine pause stops it. Choose a durable container host with HTTPS, restart policy and health monitoring. Build the Dockerfile with PUBLIC_BASE=/ (already its default); run with PUBLIC_BASE=/, PORT=5173, required provider secrets and persistent /app/.data storage if retaining telemetry. Do not put provider keys in VITE variables.

Confirm the domain registrar/DNS provider and selected host before changing DNS. Use only the CNAME/A/ALIAS records returned by that host; do not invent an IP or point the domain at a temporary agent preview. Configure apex envolio.travel, redirect www to apex, provision HTTPS, and then verify from an external network. Submit the sitemap only after public HTTPS is stable.

Set TRUST_PROXY_HOPS only to the actual trusted hosting topology. The default is zero; shared reverse proxies may share a rate-limit bucket until configured. In-memory limits are only single-instance guardrails, not a global provider spending cap. Add edge limits, provider quotas/budget alerts, durable monitoring and measured concurrency/load tests before broad promotion.

## Not yet launch-ready: owner decisions and remaining engineering

1. **Text agent:** there is no inbound conversational SMS endpoint yet. Existing code is a subscription handoff, not a texting assistant. Choose provider/number, supported countries, consent/STOP/HELP behavior, cost limits, privacy retention and escalation policy. Authenticate inbound webhooks and test with a sandbox before paid messages. Do not advertise an active number or background monitoring yet.
2. **Legal/trust:** publish an owner-approved privacy notice, terms, support address and deletion/contact process. Inventory provider licensing, IP logging, telemetry, contact collection and retention. No claims of worldwide SMS coverage or regulatory compliance have been made. The owner's requested homepage claim about knowing before the airline still needs substantiation/review before launch.
3. **Live data:** fixture tests do not verify paid provider coverage, account entitlements or production latency. Agree a bounded provider smoke-test budget and check representative carriers, codeshares, date boundaries and outages. Validate source freshness and prediction wording on real outcomes.
4. **Web UX:** real iPhone/Android browser and accessibility checks remain; the audit's result hierarchy and populated-chart issues need further review. Do not equate emulator tests with a full accessibility certification. Important country/airport/timezone differences must remain explicit; the initial interface is English, not fully localized.
5. **Operations:** deploy and test the actual container (Docker is not installed on this machine), verify HTTPS/DNS, backups/restores, secret rotation, dependency advisories, monitoring and failure recovery. The API key shared earlier in chat should be rotated through the provider before public launch.

## Repeatable checks (no billable flight lookups)

```sh
npm ci
npm run build
npm run test:web-launch
npm run test:search
npm run test:providers
npm run test:reasoning
```

`npm test` additionally runs live-provider regression checks; do not mistake it for an offline-only suite. Secrets are not required for the fixture checks above. Install-app prompts and metadata are removed. The legacy worker retirement script unregisters the old worker and deletes only its shell cache, not local saved-flight data.

Launch status: improved preview, not approved for public production promotion until the gates above are closed.
