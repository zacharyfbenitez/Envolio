# Envolio on Ghost

Add an **HTML card** in the Ghost editor and paste:

```html
<iframe
  src="https://envolio.travel/embed"
  title="Envolio flight delay checker"
  width="100%"
  height="780"
  loading="lazy"
  style="display:block;max-width:584px;margin:0 auto;border:0;border-radius:24px;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

Prefill and automatically check a flight with `/embed?flight=AA4397`. Optional `date=2026-09-13` uses the departure airport's local date. Without a date, the visitor's local calendar date is the editable default. Optional `origin=JFK&destination=BOS` narrows a multi-leg flight; omit those hints for a general-purpose checker. Multiple matches link to route choice in the full site.

Use the Ghost post preview/published page to test it. A Ghost theme's own CSP must allow `frame-src https://envolio.travel`. The iframe scrolls internally if a result exceeds its height; increase height if desired. No parent-page scripts or automatic resize messaging are required.

## Isolation and safety

Only `/embed`, `/embed/` and `/embed.html` allow framing. Their CSP permits HTTPS parents (and localhost for testing), same-origin scripts/styles/API requests, and no third-party resources. The full app remains `X-Frame-Options: DENY`. This is intentionally a public read-only embed, not an authenticated account surface. It has no cookies, local storage, email capture, provider keys, polling or parent-window access. Link-outs open the full app in a new tab with noopener. API calls retain existing backend rate limits and caching; each prefilled embed load can initiate one lookup, so monitor provider usage before putting auto-search widgets on high-traffic pages. The blank version makes no flight request until submitted.

The widget uses the existing backend model without new weights. Future, departed, cancelled, missing and cached results do not show a live probability. All estimates remain experimental. It does not add provider calls beyond the normal flight lookup.

Run `npm run build && npm run test:embed`. The test loads the actual server's embed in a different-origin iframe, mocks only provider results, and checks parameters, mobile overflow, failure/future/cache states, CSP and full-app frame protection.
