# Account and notification infrastructure

Accounts are feature-gated: search remains public, and existing browser saves are preserved while accounts are disabled. Once enabled, Watch requires email-code sign-in; flights belong to the authenticated account. Users explicitly import old browser saves. Signing out removes account flights from the UI without deleting them from the database.

## Activate accounts

1. Create a Supabase project. Apply these migrations **in order**, once each: `20260914_accounts.sql`, `20260914010000_profiles_social.sql`, `20260914020000_travel_statistics.sql` from `supabase/migrations/`. Do not enable accounts with only the first migration: onboarding needs all three. Test with two users that each can only read/write their own flights and preferences. Anonymous users must see neither. Never disable row-level security.
2. Enable email Auth with email confirmation; disable anonymous sign-ins. Configure the email template to include `{{ .Token }}` for code-based login. Set Site URL to `https://envolio.travel`; configure production SMTP, email rate limits and abuse protection before public rollout. CAPTCHA, if enabled, requires a client challenge integration before rollout. Default test email delivery is not launch-ready.
3. Set Render **runtime** variables `ENABLE_ACCOUNTS=true`, `SUPABASE_URL=https://PROJECT.supabase.co`, `SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`. The publishable key is intentionally public and relies on RLS. No rebuild-time VITE secrets are needed. Restart the service.
4. Verify sign-in code → Watch → reload → another device → sign out; test account isolation, expired codes, revoked sessions and blocked storage. The checked-in tests use fixtures, not a provisioned Supabase project.

No password or Apple account is required. Do not paste service keys in chat or commit them. Account deletion/admin data-export workflows and production abuse testing remain launch tasks.

## Traveler profiles and friends

The website includes `/account` and authenticated `/u/HANDLE` views. Email-code authentication is followed by a two-step profile setup: name, handle, international phone number, home airport, favorite airline and favorite aircraft. Phone numbers live in an owner-only table, are explicitly unverified, and never enable SMS by themselves. The three favorites appear as profile boxes. All sharing starts off.

Discovery requires an exact handle and opt-in. A request reveals only name/handle/avatar; accepted friends can see profile preferences. Stats and completed history require separate opt-ins. Friends cannot query saved trips, private contacts or underlying travel-log rows. Blocking revokes profile/stat access and removes the friendship. Requests have per-user database rate limits; reports are stored for operator review, not automatically adjudicated. Assign an operator to review `profile_reports` with privileged access before public social rollout. Test unblock, decline, revoked sessions and sharing changes with two real accounts.

Stats cover 30 days, 90 days, the calendar year and all time. Saving a flight never counts as flying. Travelers explicitly log taken, cancelled or missed flights. On-time percentage excludes entries without scheduled and actual departure timestamps; air time excludes entries without takeoff and landing. Manual records do not acquire invented timings. These are traveler-maintained records, not verified flight ownership. Profiles/history are not public SEO pages; server responses use noindex and private/no-store.

Settings include private contact editing, sharing controls, notification links, sign-out and an account-data export (currently up to 1,000 log entries). Complete verified account deletion and full export pagination before unrestricted public registration. Deleting an auth user through the operator's Supabase dashboard cascades their application records; verify identity outside chat and follow the project's retention policy. This operator task is not represented as a working self-service delete button.

Local verification: `PUBLIC_BASE=/ npm run build`, then `node --test --test-concurrency=1 tests/account-utils.test.mjs tests/account-rls.postgres.test.mjs tests/accounts-infrastructure.test.mjs tests/accounts.e2e.test.mjs`. PostgreSQL integration tests use isolated temporary synthetic databases and exercise actual RLS, not string assertions. Browser tests mock Supabase, so they do not prove production email delivery or hosted migrations are configured.

## Notification delivery

The existing browser alerts remain available. When accounts are enabled, the legacy contact-based subscription endpoint is disabled so users cannot enroll unverified arbitrary addresses. Account notification choices sync separately. Preferences alone do not consent to email or SMS. The outbox is service-role-only, deduplicated by user/flight/event key, leased with `SKIP LOCKED`, and retries up to five times. Deleting a user cascades their saved flights, preferences and queue.

`scripts/notification-worker.mjs` processes queued **email** events; it rechecks consent and the selected event immediately before sending to the verified account email. It uses an idempotency key and does not log contacts. Failed rows require operator review. SMS and web push are not implemented by this worker.

Worker secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ENABLE_ACCOUNT_EMAIL=true`. Run `node scripts/notification-worker.mjs` on a one-minute managed cron or worker. Use a verified sending domain and monitor failed rows. The normal web Docker image does not run a scheduler: use a separate repository-based worker service with `npm ci` and this command.

A trusted flight-monitoring job must enqueue real changes, not predictions invented by the delivery worker. It must reuse the existing flight/status calculation, respect provider quotas, avoid re-alerting stale data, stop after arrival and use a stable flight instance/event identifier. Insert only after checking the user's consent and selected events; the worker checks again at delivery. This polling-to-outbox bridge is **not yet activated**. Do not enable background-email claims until it and end-to-end delivery are verified.

Email opt-in controls remain disabled until `ACCOUNT_EMAIL_WORKER_READY=true` and `ENABLE_ACCOUNT_EMAIL=true` are configured on the web service after the worker/monitor are deployed. Users can always turn an existing opt-in off. Existing generic `/api/alerts/subscribe` remains independently gated and is not a substitute for this account worker.

References: [Supabase email-code authentication](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
