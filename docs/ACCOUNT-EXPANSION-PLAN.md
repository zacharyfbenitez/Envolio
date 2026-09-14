# Account and social expansion — working plan

Scope: website only; reuse the flight page's dark rounded cards, restrained color and accessible motion. Do not change delay-model weights or aviation calculations. Backend activation requires Supabase and verified delivery configuration; keep unfinished external capabilities disabled and labeled.

- [x] Signup: verified email → private phone contact → display name/handle, home airport, favorite airline and aircraft.
- [x] Account route with overview, time-period stats, history, friends, profile and settings.
- [x] Distinguish watched flights from user-confirmed travel; calculate statistics only from explicit records and available timestamps, with sample counts and missing-data explanations.
- [x] Compact profile preference boxes and private-by-default sharing settings.
- [x] Exact-handle friend discovery, request/accept/decline/remove/block, friend profiles; no public email/phone or future itinerary leakage.
- [x] Supabase migrations and RLS tests for two users, blocked users, strangers, friend transitions and private contact data.
- [ ] Loading, empty, retry, offline, keyboard, responsive and motion audits.
- [ ] Production build and browser regression coverage; explicit deployment/activation checklist.

Privacy decisions: a save is not proof someone flew. Friends see only explicitly shared aggregate stats and completed travel when permitted. Future saved flights and live location never become social data by default. No fabricated badges, mileage or delay predictions. Phone capture is separate from verification and messaging consent.

External rollout remains gated: provision Supabase, apply all migrations, configure real email OTP delivery and abuse controls, verify two-device sessions, establish moderation/deletion handling. Phone verification and SMS delivery are not implemented. Account export presently caps travel-log entries at 1,000 and states that limit. Do not describe this as an unrestricted production signup launch until these dependencies are finished.
