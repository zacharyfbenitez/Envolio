# Porter logo, saving and departure-status follow-up

The two user screenshots show PD604. The first shows `Watch settings` (an existing saved-state match); the second confirms one saved flight. The problem was unclear save feedback, not evidence that this particular save failed.

- The result logo now uses the same proportional rounded-square mask as the saved preview. Image sizing overrides old fixed desktop dimensions, and fallback wordmarks use `contain` without zoom. The tile stays visible at 320px.
- POE/PD is shown as Porter Airlines and the artwork lookup uses the airline name, not the ICAO code.
- Save flight becomes Saved · alerts, with a checkmark. The sheet confirms browser/account storage and offers View saved flights. If storage writes fail, copy says kept for this visit only; no durable-save claim is made.
- In the next 48 hours, a reported estimated departure at/before scheduled time displays green On time. Later estimates display delay minutes. Cancelled/diverted/boarding/airborne/landed states take precedence. Distant dates, schedule-only records, missing estimates and stale live observations are not promoted to on-time. This is a presentation rule, not a change to risk probabilities or aviation calculations.
- Saved snapshots evaluate the rule at their recorded check time and retain Last seen plus the timestamp. They do not become freshly checked simply because time has passed.

Verification includes logo dimensions/cropping at 320/390/1440px, PD604 save → saved list → reload → removal, blocked storage, and 48-hour/status-precedence unit tests. Account infrastructure remains feature-gated and must not be activated before its migration and provider setup.
