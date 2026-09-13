# Traveler-first release

The home screen shows the next saved trip, not an extra live-provider request. Saved status is explicitly a snapshot. Results group existing delay estimates and departure gate details with the route; deeper evidence remains closed initially. Incoming maps use only verified recent positions. Connection checks are one click away and retain the existing backend and its missing-data caveats.

Route filters use confirmed marketing identifiers and origin-local departure times. Unknown times remain visible in “Any time”; no invented local time is used. Forecast windows use only returned, time-valid Skylink TAF periods near the flight; weather likelihood is never relabeled as flight-delay likelihood.

The changes strip compares prior local successful checks of the same flight leg, ignores missing fields, and does not describe cached/offline data as a new live update. Navigation has its own reserved space, rather than covering the page.

## Text/email delivery: external prerequisites

`GET /api/alerts/capabilities` exposes only availability booleans, never secrets. No phone/email field is shown when delivery is unavailable. Subscription requests require explicit consent. Existing provider and worker configuration is preserved; this release does not activate paid delivery or assert that a provider is working merely because credentials exist.

To enable reliable background delivery, operations must configure and validate:

- `ENABLE_ALERT_SUBSCRIPTIONS`, `ALERT_DELIVERY_WEBHOOK`, optional `ALERT_WEBHOOK_SECRET`.
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`; a verified/approved sender and applicable destination consent requirements.
- Email: `RESEND_API_KEY` and `ALERT_FROM_EMAIL` with a verified sending domain.
- A durable worker that verifies the exact flight leg, deduplicates events, expires subscriptions after travel, respects provider licensing/budgets, processes opt-outs and deletes contacts. Test delivery and opt-out before enabling signups. Do not infer an airline cause from a changed estimate.

Worker records include `consent_at` and `message_contract: traveler-action-v1`. `alert-delivery.js` exports plain-English `travelerAlert()` templates for worker reuse; the website also uses these for browser alerts. Workers must include their tested unsubscribe/STOP instructions. Cancellation is included in delay notifications. Inbound-arrival messages require actual gate arrival, not just touchdown. Boarding reminders remain explicitly reminders, not confirmed boarding announcements.

Browser notifications are not background text delivery: they require permission and an open flight page. No native/App Store changes are included.
