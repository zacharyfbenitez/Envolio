# Envolio UX/UI audit

14 September 2026 · Current committed `main` at `9034021` · Audit only; no production behavior changed.

## Verdict

The core product is usable and visually coherent on desktop and mobile. The prioritized dock, EDCT visibility, narrow-phone search, account-tab discovery, and small-type issues identified below are now addressed. Remaining polish work is concentrated in alert-sheet length, account overview density, and physical-device/accessibility certification.

## Implementation update — 14 September 2026

The prioritized UI pass is implemented:

- The floating Search/Saved dock is removed at desktop widths and auto-hides while users scroll down on mobile, returning when they scroll up. Bottom safe-area spacing remains reserved.
- EDCT/ATC status now renders inside the primary route summary. A successful FAA lookup with no matching assignment says “ATC / EDCT · none reported” and explains that an assignment can still be issued later.
- At 320px, decorative sky art no longer consumes vertical space, the headline badge is positioned without pushing the form down, and the primary search action clears the dock in a 320×740 viewport.
- Mobile account tabs now snap horizontally, center the selected destination, show a fade at the overflow edge, and include the cue “Swipe for Profile & Settings →”.
- Flight-leg, timeline, diagnostics, alert, error, footer, and section metadata were raised to a readable 12–13px minimum in the audited surfaces. The capture’s sub-12px visible-text count fell from 22 to 4 in the densest expanded-analysis state and to zero in the other completed states.

Validation passed for the production build, all 11 EDCT/slot tests, the expanded account flow, saved-flight cards, web-launch behavior, and the site-wide audit assertions in the first post-change run. A later combined run hit the site-audit outer timeout under VM load without an assertion failure; repeated isolated runs also exhausted the timeout, so that timing result is not reported as a pass. The capture script was updated to scroll upward before clicking the intentionally auto-hidden dock.

## Scope and evidence

- Rebuilt the current commit and ran the browser capture at 320, 390, 768, and 1440px.
- Inspected home/search, saved empty and populated states, upcoming and landed results, alert settings, unavailable analysis, error recovery, dashboard/account overview, premium preview, reduced-motion, and normal-motion states.
- Inspected the authenticated account flow at 320, 390, 768, and 1440px after verified-code signup, including favorites, saved-flight synchronization, profile editing, friends, travel log, and privacy.
- Checked focus entry/return, Escape behavior, viewport containment, page overflow, small text, small controls, empty/error messaging, and major content order.
- Verified the live PD604 result and its FAA EDCT response separately. This is the clearest real-user example of ATC status being technically present but poorly discoverable.
- Chromium automation is not physical Safari/iOS, Android keyboard, screen-reader, or installed-PWA certification.

## Priority 1 findings — addressed in the implementation pass

### 1. The fixed Search/Saved dock obscures content

The dock floats over the page at every tested width. On account pages it covers statistics labels and values; on result pages it can cover route or supporting cards; on desktop it sits over the middle of wide content despite desktop navigation already being available in the header. Full-page screenshots make the collision especially visible, but it also occurs during ordinary scrolling.

**Recommendation:** do not use the floating dock on desktop. On mobile, reserve a real bottom safe area and either auto-hide the dock while scrolling/reading, place it in a non-overlapping shell region, or ensure focused/anchored content is scrolled clear of it. Add overlap assertions for meaningful controls and text, not only document-width assertions.

### 2. ATC/EDCT status is too deeply buried

`TakeoffSlot` correctly distinguishes assigned, removed, none-reported, stale, and unavailable states. However, it renders after the incoming-aircraft section and the next-step card. In the real PD604 screenshot, the visible result strongly suggests that no FAA check occurred even though production queried `POE604 / LGA / YYZ` and received no EDCT assignment.

**Recommendation:** put a compact ATC row beside the operational status or immediately below the route summary: “No EDCT reported · checked FAA 5:09 AM”. Keep the detailed caveat lower on the page. Assigned/revised EDCTs should remain visually prominent and never be conflated with estimated departure time.

### 3. The 320px home flow does not expose the primary action quickly enough

At 390×844 the complete form and Find my flight button fit above the dock. At 320×740, the form begins around y478 and the submit button ends around y803, below the initial viewport. The dock occupies the bottom reading area, making the action feel missing until the user scrolls.

**Recommendation:** reduce mobile hero spacing and form vertical padding below 360px, or move the finder higher. Test 320×568/667/740 with browser chrome and the software keyboard, not only a 900px-high viewport.

### 4. Mobile account navigation hides tabs without a clear cue

The five account tabs are horizontally scrollable. At 320px only Overview, Travel log, and Friends are initially visible; My profile and Settings are off-screen. There is no fade, chevron, partial next item, or alternate menu indicating more destinations.

**Recommendation:** add an obvious horizontal-scroll affordance, use a compact two-row layout, or collapse account sections into a labeled menu on narrow phones. Keep `aria-current` and keyboard navigation.

## Priority 2 — remaining refinement

### 5. Meaningful text scale — addressed

Result metadata and multi-leg times render at 9–11px. Analysis labels include 9–10px text, and the alert sheet contains dense secondary copy. The information is technically present but difficult to scan, especially outdoors or under motion.

**Recommendation:** use at least 12–13px for compact metadata and about 14px for meaningful secondary text. Preserve hierarchy with weight and color rather than extremely small sizes. Recheck contrast after increasing muted text brightness.

### 6. Alert settings are long and the completion action is remote

The alert dialog now has correct dialog semantics, initial focus, focus containment, Escape handling, body-scroll locking, and honest auto-save behavior. On a phone, seven alert choices plus delivery controls create a long sheet; Done/View saved flights is below the initial viewport and not sticky.

**Recommendation:** group alert types into “Before departure” and “After landing”, make the footer action sticky, and keep the auto-save state explicit near the heading. Do not reintroduce a fake Save action.

### 7. Account overview is visually dense at 320px

The account overview remains contained, but four statistics cards, an empty-story prompt, favorites, and next-trip guidance form a long first page. The fixed dock overlaps the lower statistics cards, and some explanatory copy becomes visually secondary despite being important to how statistics are counted.

**Recommendation:** prioritize the next action above empty statistics, collapse zero-value detail, and move the explanation into a concise info disclosure. Preserve the explicit distinction between saved flights and completed travel.

### 8. Desktop pages underuse width while retaining the mobile dock

The desktop flight and account cards are attractive and readable, but the centered floating dock interrupts otherwise strong layouts. Some secondary panels remain vertically stacked even when there is room for contextual side-by-side placement. The result page is over 2,100px tall before expanded analysis.

**Recommendation:** remove the desktop dock, use the header as primary navigation, and place ATC status/next action in the open right-hand result column. Avoid widening prose; use width to improve information grouping.

### 9. Footer attribution is cramped on mobile

At 390px the brand and FlightAware attribution compete for one short row; at narrower widths the footer either becomes cramped or drops useful context. This is a visual-quality and legal-attribution readability concern.

**Recommendation:** stack footer brand, product line, and attribution on mobile with explicit spacing and a minimum 12px readable size.

## QA integrity issue

The default Vite `PUBLIC_BASE` is still the previous chat.dev machine path. A plain `npm run build` succeeds but the static browser suite then loads assets from the wrong base and times out. Rebuilding with `PUBLIC_BASE=/` makes the complete account suite pass. This can produce false UI regressions on replacement machines and should be removed from the default configuration or made explicit in test scripts.

The site-audit browser test also expects `.aircraft-chain`, but current JSX no longer renders that element. The rest of the audit batch passed. This assertion is stale unless the aircraft-chain UI was unintentionally removed; product intent needs to decide which.

## Improvements confirmed since the prior audit

- Search now remains inside its parent at all tested widths.
- The Saved destination now shows real flight cards with view, remove, and notification actions.
- Error recovery preserves the flight number and date and offers both Try again and Edit search.
- Upcoming results now place flight identity, route, local times, terminal/gate, and delay outlook in the first card.
- Watch settings now implement initial focus, focus trapping, Escape close, focus return, and body-scroll locking.
- Account signup, profile editing, favorites, saved-flight sync, friends, travel-log add/remove, and privacy settings pass the expanded browser flow.
- No JavaScript page exceptions or document-level horizontal overflow occurred in the 17-state capture.

## Recommended implementation order

1. Remove/relocate the desktop dock and make mobile content dock-safe.
2. Surface a compact ATC/EDCT checked state in the primary flight summary.
3. Fit the finder action on short 320px phones and test keyboard-open behavior.
4. Make all account sections discoverable without unexplained horizontal scrolling.
5. Raise small type, simplify the alert sheet, and stack the mobile footer.
6. Fix `PUBLIC_BASE` test portability and reconcile the stale aircraft-chain assertion.

## Remaining release checks

Perform physical iPhone Safari and Android Chrome checks with the keyboard open, VoiceOver/TalkBack navigation, 200% text zoom, high-contrast/forced-colors behavior, installed-PWA safe areas, native share/cancel/failure handling, populated long travel histories, long translated strings, and slow/offline account transitions. Registration, SMS, account deletion, report moderation, and background delivery remain outside this visual audit and are not complete.
## Motion and engagement follow-up

- Smoothed hover elevation with a restrained spring-like easing, smaller lift, and softer shadow on result, saved-flight, and account surfaces.
- Added short staggered entrances for result sections, saved cards, and account statistics, plus an animated delay-chance meter.
- Extended animated counting to the traveler-facing delay percentage while retaining the existing account-stat counters.
- All added motion is disabled by `prefers-reduced-motion: reduce`; transforms do not change document flow.
