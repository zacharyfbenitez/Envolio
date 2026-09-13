# Envolio UI audit

September 13, 2026 · Audit only; no production code changed.

## Verdict

The visual direction is coherent, but core task layout and navigation still need work. The highest-value next pass is to make search controls accessible, bring flight essentials forward, and repair the saved-flight and dialog flows. More animation should wait until these issues are resolved.

## Scope and evidence

Inspected the running production bundle on port 5173 using Chromium at 1440×900, 390×844, and 320×740. Captured 17 screenshots covering home/search, saved empty state, dashboard with and without a favorite, upcoming and landed results, analysis unavailable state, app/watch menus, errors, and premium preview. Checked both reduced-motion and normal-motion home rendering.

Flight results used the existing SQ12 test fixture with controlled state changes. Other API requests were intercepted with an unavailable response. This tests the actual UI without provider latency, paid requests, or real alert subscriptions; it does not validate live aviation data. No JavaScript runtime exceptions appeared in the 16-screen capture run.

## Priority 1 — fix before calling the UI production-ready

### 1. The dock covers search controls

At 390×844, the fixed dock occupies approximately y756–830 while the search button begins at y811. The date helper and button are obscured, and the full search action is below the first screen. Desktop also places the submit button partly below the initial viewport and behind the dock. The large hero and spacing postpone the user's primary task.

**Recommendation:** compact the hero without changing the requested slogan. Make the complete primary form accessible in the initial phone view where practical. Establish dock-aware scrolling and positioning, including input focus and the software keyboard. End-of-page padding alone does not protect controls elsewhere on the page.

[Phone evidence](02-home-phone.png) · [Desktop evidence](01-home-desktop.png)

### 2. The search form exceeds its parent

On desktop, the finder parent is capped at 780px but the form is 940px wide, shifting its center 80px right. At 390px, the form extends to x385 instead of keeping the intended right gutter. The legacy `.search-box` width in `src/premium.css` leaks into the new form; `src/flight-search.css` does not reset it. Global clipping masks the overflow, so a document-width check alone passes.

**Recommendation:** explicitly constrain the component to its parent and remove inherited legacy sizing. Add component-boundary assertions at desktop, phone, and narrow-phone sizes, including focus transforms.

[Narrow-phone evidence](14-search-small-phone.png)

### 3. The dashboard promises saved flights but does not display them

With a valid favorite stored, the dashboard reports “1 favorite flight saved in this browser” but renders only promotional/navigation cards. There is no flight list. Its “Available now” dashboard card links back to itself. This is confirmed in both the browser and the dashboard branch of `src/App.jsx`.

The Saved dock takes users deep into the home page instead of a focused saved-flight destination. On the tested phone layout, that section is more than 4,500px down the document.

**Recommendation:** give Saved flights one clear destination with actual flight cards, open/remove actions, and a useful empty-state search action. Remove the dashboard self-link and align availability wording with what the page delivers.

[Populated-dashboard evidence](17-dashboard-saved-phone.png) · [Saved-section evidence](04-saved-phone.png)

### 4. Results bury the flight's essential information

The initial phone screen contains navigation, a large generic advice card, identity, status, three actions, and a leg selector before the route and flight times. The route block begins around y791; the dock covers it. Gate/terminal information requires further scrolling. Airline identity and “Scheduled” labels repeat across the result.

**Recommendation:** lead with a compact flight summary: route, departure time, gate/terminal, status, and freshness. Keep the useful “What should I do?” recommendation adjacent, but scale generic advice down. Put secondary sharing and technical detail behind clearly named secondary controls. Preserve multi-leg selection, with readable times.

[Initial result](06-result-phone.png) · [Scrolled route](07-route-phone.png)

### 5. Watch settings lack basic dialog behavior

Opening Watch flight leaves keyboard focus outside the dialog. Escape does not close it. The custom dialog does not implement focus trapping/background isolation. The native App menu behaves differently. Share-card dialog code uses a similar custom pattern and needs the same review.

Watch preferences also persist immediately, while the bottom button says “Save watch settings” and only closes the panel. Closing with X therefore also saves changes, contrary to the implied draft workflow.

**Recommendation:** use one accessible dialog primitive with initial focus, contained tab order, Escape, focus return, and appropriate background scroll handling. Choose either explicit save/cancel or honest “Saved automatically” plus Done wording.

[Watch settings](08-alert-menu-phone.png)

## Priority 2 — readability and recovery

### 6. Secondary text remains too small

Computed sizes in visible states include 8px product availability labels, 9px leg times/section labels, and 8–10px diagnostics labels. The wrong-flight report control is only about 14px tall. Unavailable analysis puts a large heading above much smaller, faint explanation text. These are meaningful facts/actions, not decorative details.

**Recommendation:** use a consistent type scale: roughly 16px body, 14px secondary text, and 13px or more for compact meaningful labels. Increase contrast and line height alongside font size. Target comfortable 44px controls where practical. Small checkbox inputs are not independently classified as failures because their surrounding labels may extend the clickable area. This audit is not a full WCAG contrast certification.

[Analysis evidence](10-analysis-desktop.png) · [Route labels](07-route-phone.png)

### 7. Error recovery discards the search

After a failed lookup, Edit search returns to an empty query field. Users must reconstruct their request. Error text also includes provider/deadline and departure-local terminology that is harder to act on than plain recovery guidance.

**Recommendation:** preserve flight text, date, and airport choices. Offer Retry and Edit this search. Explain the distinction between a temporary service problem and no matching published flight, using everyday wording. Code review also found that route landing pages render a generic search form without prefilled route context.

[Error evidence](12-error-phone.png)

### 8. Sharing feedback is unreliable

The result share handler reports “Link copied” after either clipboard copying or native sharing, although these are different outcomes. Clipboard/share errors are swallowed. This is code-confirmed; actual phone share-sheet behavior was not exercised.

**Recommendation:** separate copied, shared, canceled, and failed states. Provide a selectable link if clipboard access fails. Make preview CTAs describe their real destination: “View a live report” currently sends the user back to search rather than directly to a report.

## What is working

- Passport branding is clean and readable.
- Main text and primary buttons have strong visual hierarchy and contrast.
- Country flags look crisp and aligned in the inspected route state.
- The native App menu is more consistent than the custom watch dialog.
- Unavailable probability data is disclosed instead of replaced with an invented score.
- No page-level horizontal scrolling or runtime exceptions occurred in the captured states, though component overflow remains.

## Recommended implementation order

1. Fix finder sizing and dock overlap; verify primary actions with the phone keyboard open.
2. Deliver a real Saved flights destination and preserve searches during recovery.
3. Reorder results around flight essentials and concise actionable advice.
4. Standardize dialogs, typography, hit areas, and share feedback.
5. Consolidate overlapping legacy CSS rules into scoped components and shared sizing/type tokens.
6. Add regression checks for parent containment, dialog keyboard behavior, saved-flight navigation, and search recovery—not just whole-page overflow.

## Remaining checks before release

This pass did not certify populated historical/live charts, in-flight map rendering, slow-loading transitions, real iOS/Android keyboard behavior, screen readers, installed-PWA safe areas, or live email/SMS delivery. These need targeted checks after the structural fixes. Fixture results should not be treated as evidence of provider freshness, prediction accuracy, or live flight coverage.

Machine-readable measurements: [observations.json](observations.json). Reproducible screenshot script: [capture.mjs](capture.mjs).
