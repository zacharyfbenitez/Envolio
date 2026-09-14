-- Run in the Supabase SQL editor. No service-role key belongs in the browser.
create table public.saved_flights (
 user_id uuid not null references auth.users(id) on delete cascade,
 flight_key text not null check (length(flight_key) between 1 and 200),
 journey jsonb not null check (jsonb_typeof(journey) = 'object' and octet_length(journey::text) <= 16000),
 created_at timestamptz not null default now(),
 primary key(user_id,flight_key)
);
create table public.notification_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 flight_key text not null check (length(flight_key) between 1 and 200),
 events jsonb not null default '{}' check(jsonb_typeof(events)='object' and octet_length(events::text)<=2000),
 -- Saving preferences is NOT consent to send email/SMS.
 email_enabled boolean not null default false,
 consent_at timestamptz,
 primary key(user_id,flight_key),
 check (not email_enabled or consent_at is not null)
);
alter table public.saved_flights enable row level security;
alter table public.notification_preferences enable row level security;
create policy own_flights on public.saved_flights for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_preferences on public.notification_preferences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.saved_flights,public.notification_preferences from anon;
grant select,insert,update,delete on public.saved_flights,public.notification_preferences to authenticated;

-- Only a trusted monitoring worker may enqueue verified flight events.
-- No clients can invent warnings or send messages to arbitrary recipients.
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 flight_key text not null,
 event_key text not null,
 event_type text not null check(event_type in ('inbound','gate','boarding','delay','probability','landing','baggage','cancelled')),
 payload jsonb not null check (octet_length(payload::text)<=8000),
 state text not null default 'pending' check(state in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 locked_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,flight_key,event_key),
 foreign key(user_id,flight_key) references public.notification_preferences(user_id,flight_key) on delete cascade
);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon,authenticated;
create index notification_pending on public.notification_outbox(available_at) where state in ('pending','sending');
create function public.claim_notifications(batch_size integer default 20)
returns setof public.notification_outbox language sql security definer set search_path=public as $$
 update notification_outbox set state='sending',locked_at=now(),attempts=attempts+1
 where id in (select id from notification_outbox where attempts<5 and available_at<=now()
 and (state='pending' or (state='sending' and locked_at<now()-interval '10 minutes'))
 order by available_at limit least(greatest(batch_size,1),100) for update skip locked) returning *;
$$;
revoke all on function public.claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant all on public.saved_flights,public.notification_preferences,public.notification_outbox to service_role;
