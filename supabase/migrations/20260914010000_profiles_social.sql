-- Apply AFTER 20260914_accounts.sql. Unique migration version for CLI compatibility.
-- All contact details remain owner-only.
create table public.traveler_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z][a-z0-9_]{2,23}$' and handle not in ('admin','support','envolio','security','official','staff')),
 display_name text not null check(length(trim(display_name)) between 1 and 60),
 bio text not null default '' check(length(bio)<=240),
 home_airport text not null check(home_airport ~ '^[A-Z]{3}$'),
 favorite_airline text not null check(length(favorite_airline) between 1 and 80),
 favorite_aircraft text not null check(length(favorite_aircraft) between 1 and 80),
 avatar_color text not null default 'violet' check(avatar_color in ('violet','mint','blue','amber','rose')),
 discoverable boolean not null default false,
 share_stats boolean not null default false,
 share_history boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.account_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 updated_at timestamptz not null default now()
);
create table public.friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check(requester_id<>recipient_id)
);
create unique index friendship_pair on public.friendships(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create table public.profile_blocks (
 user_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,blocked_id),check(user_id<>blocked_id)
);
create table public.social_request_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index social_request_rate on public.social_request_events(user_id,created_at);
create table public.profile_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('impersonation','harassment','privacy','other')),
 detail text not null default '' check(length(detail)<=500),
 created_at timestamptz not null default now(),check(user_id<>target_id)
);
create table public.travel_log (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_key text check(length(source_key)<=200),
 flight_number text not null check(flight_number ~ '^[A-Z0-9]{2,12}$'),
 travel_date date not null,
 origin text not null check(origin ~ '^[A-Z]{3}$'),
 destination text not null check(destination ~ '^[A-Z]{3}$'),
 airline text not null default '' check(length(airline)<=80),
 aircraft text not null default '' check(length(aircraft)<=80),
 outcome text not null check(outcome in ('taken','cancelled','missed')),
 source text not null check(source in ('saved_snapshot','manual')),
 scheduled_departure timestamptz,
 actual_departure timestamptz,
 actual_arrival timestamptz,
 actual_takeoff timestamptz,
 actual_landing timestamptz,
 created_at timestamptz not null default now(),
 check(actual_arrival is null or actual_departure is null or actual_arrival>=actual_departure),
 check(actual_landing is null or actual_takeoff is null or actual_landing>=actual_takeoff)
);
create unique index travel_log_source on public.travel_log(user_id,source_key) where source_key is not null;
create index travel_log_dates on public.travel_log(user_id,travel_date desc);

alter table public.traveler_profiles enable row level security;
alter table public.account_contacts enable row level security;
alter table public.friendships enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.social_request_events enable row level security;
alter table public.profile_reports enable row level security;
alter table public.travel_log enable row level security;
revoke all on public.traveler_profiles,public.account_contacts,public.friendships,public.profile_blocks,public.social_request_events,public.profile_reports,public.travel_log from anon,authenticated;
grant select,insert,update,delete on public.traveler_profiles,public.account_contacts,public.travel_log to authenticated;
-- Profile creation is atomic through the verified-email onboarding function.
revoke insert,delete on public.traveler_profiles from authenticated;
grant select on public.friendships,public.profile_blocks,public.profile_reports to authenticated;
grant all on public.traveler_profiles,public.account_contacts,public.friendships,public.profile_blocks,public.social_request_events,public.profile_reports,public.travel_log to service_role;
grant usage,select on sequence public.social_request_events_id_seq to service_role;

create function public.can_view_traveler(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (target=auth.uid() or (
 not exists(select 1 from public.profile_blocks where (user_id=auth.uid() and blocked_id=target) or (user_id=target and blocked_id=auth.uid()))
 and exists(select 1 from public.friendships where status='accepted' and ((requester_id=auth.uid() and recipient_id=target) or (recipient_id=auth.uid() and requester_id=target)))))
$$;
revoke all on function public.can_view_traveler(uuid) from public,anon;
grant execute on function public.can_view_traveler(uuid) to authenticated;
create policy profile_read on public.traveler_profiles for select to authenticated using(public.can_view_traveler(user_id));
create policy profile_insert on public.traveler_profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy profile_update on public.traveler_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy profile_delete on public.traveler_profiles for delete to authenticated using((select auth.uid())=user_id);
create policy private_contact on public.account_contacts for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_travel on public.travel_log for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_friendships on public.friendships for select to authenticated using((select auth.uid()) in (requester_id,recipient_id));
create policy own_blocks on public.profile_blocks for select to authenticated using((select auth.uid())=user_id);
create policy own_reports on public.profile_reports for select to authenticated using((select auth.uid())=user_id);

-- Atomic onboarding avoids half-created profiles when a handle is taken.
create function public.complete_traveler_profile(profile_data jsonb,phone_number text) returns public.traveler_profiles language plpgsql security definer set search_path='' as $$
declare result public.traveler_profiles; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in first'; end if;
 if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Verify your email first'; end if;
 insert into public.traveler_profiles(user_id,handle,display_name,home_airport,favorite_airline,favorite_aircraft,avatar_color,discoverable)
 values(uid,lower(trim(profile_data->>'handle')),trim(profile_data->>'display_name'),upper(trim(profile_data->>'home_airport')),trim(profile_data->>'favorite_airline'),trim(profile_data->>'favorite_aircraft'),coalesce(profile_data->>'avatar_color','violet'),coalesce((profile_data->>'discoverable')::boolean,false))
 returning * into result;
 insert into public.account_contacts(user_id,phone) values(uid,phone_number);
 return result;
end $$;

-- Discovery is exact-handle only and opt-in. No emails, phones, trip data or UUID lists.
create function public.find_traveler(handle_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.traveler_profiles; uid uuid:=auth.uid(); relation text;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 select * into p from public.traveler_profiles where handle=lower(trim(handle_query));
 if not found then return null; end if;
 if exists(select 1 from public.profile_blocks where (user_id=uid and blocked_id=p.user_id) or (user_id=p.user_id and blocked_id=uid)) then return null; end if;
 if p.user_id<>uid and not p.discoverable and not public.can_view_traveler(p.user_id) then return null; end if;
 select case when status='accepted' then 'friends' when requester_id=uid and status='pending' then 'outgoing' when recipient_id=uid and status='pending' then 'incoming' else 'none' end into relation from public.friendships where (requester_id=uid and recipient_id=p.user_id) or (recipient_id=uid and requester_id=p.user_id);
 return jsonb_build_object('user_id',p.user_id,'handle',p.handle,'display_name',p.display_name,'avatar_color',p.avatar_color,'relationship',case when p.user_id=uid then 'self' else coalesce(relation,'none') end,'can_view',public.can_view_traveler(p.user_id));
end $$;

create function public.request_friend(target uuid) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing public.friendships;
begin
 if uid is null or uid=target then raise exception 'Choose another traveler'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if not exists(select 1 from public.traveler_profiles where user_id=uid) then raise exception 'Complete your profile first'; end if;
 if not exists(select 1 from public.traveler_profiles where user_id=target and discoverable) or exists(select 1 from public.profile_blocks where (user_id=uid and blocked_id=target) or (user_id=target and blocked_id=uid)) then raise exception 'Traveler unavailable'; end if;
 select * into existing from public.friendships where (requester_id=uid and recipient_id=target) or (recipient_id=uid and requester_id=target) for update;
 if existing.status in ('pending','accepted') then return existing.status; end if;
 if existing.status='declined' and existing.responded_at>now()-interval '7 days' then raise exception 'Please wait before sending another request'; end if;
 if (select count(*) from public.social_request_events where user_id=uid and created_at>now()-interval '24 hours')>=20 then raise exception 'Daily friend request limit reached'; end if;
 if (select count(*) from public.friendships where requester_id=uid and status='pending')>=50 then raise exception 'Too many pending requests'; end if;
 if existing.id is not null then delete from public.friendships where id=existing.id; end if;
 insert into public.friendships(requester_id,recipient_id) values(uid,target);
 insert into public.social_request_events(user_id) values(uid);
 return 'pending';
end $$;

create function public.respond_friend(request_id uuid,accept_request boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item public.friendships;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 select * into item from public.friendships where id=request_id and recipient_id=uid and status='pending' for update;
 if not found then raise exception 'Request no longer available'; end if;
 if exists(select 1 from public.profile_blocks where (user_id=uid and blocked_id=item.requester_id) or (user_id=item.requester_id and blocked_id=uid)) then raise exception 'Request no longer available'; end if;
 update public.friendships set status=case when accept_request then 'accepted' else 'declined' end,responded_at=now() where id=request_id;
 return true;
end $$;
create function public.remove_friend(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 delete from public.friendships where (requester_id=auth.uid() and recipient_id=target) or (recipient_id=auth.uid() and requester_id=target);
 return true;
end $$;
create function public.block_traveler(target uuid,blocked boolean default true) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()=target then raise exception 'Choose another traveler'; end if;
 if blocked then
  insert into public.profile_blocks(user_id,blocked_id) values(auth.uid(),target) on conflict do nothing;
  perform public.remove_friend(target);
 else delete from public.profile_blocks where user_id=auth.uid() and blocked_id=target;
 end if;return true;
end $$;
create function public.traveler_connections() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'status',f.status,'direction',case when f.recipient_id=auth.uid() then 'incoming' else 'outgoing' end,'user_id',p.user_id,'handle',p.handle,'display_name',p.display_name,'avatar_color',p.avatar_color,'created_at',f.created_at) order by f.created_at desc),'[]'::jsonb)
 from public.friendships f join public.traveler_profiles p on p.user_id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end
 where auth.uid() is not null and auth.uid() in(f.requester_id,f.recipient_id) and f.status in('pending','accepted')
 and not exists(select 1 from public.profile_blocks where (user_id=auth.uid() and blocked_id=p.user_id) or (user_id=p.user_id and blocked_id=auth.uid()));
$$;
create function public.report_traveler(target uuid,report_reason text,report_detail text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
 if (select count(*) from public.profile_reports where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then raise exception 'Please wait before submitting another report'; end if;
 insert into public.profile_reports(user_id,target_id,reason,detail) values(auth.uid(),target,report_reason,report_detail) returning id into result;
 return result;
end $$;
revoke all on function public.complete_traveler_profile(jsonb,text),public.find_traveler(text),public.request_friend(uuid),public.respond_friend(uuid,boolean),public.remove_friend(uuid),public.block_traveler(uuid,boolean),public.traveler_connections(),public.report_traveler(uuid,text,text) from public,anon;
grant execute on function public.complete_traveler_profile(jsonb,text),public.find_traveler(text),public.request_friend(uuid),public.respond_friend(uuid,boolean),public.remove_friend(uuid),public.block_traveler(uuid,boolean),public.traveler_connections(),public.report_traveler(uuid,text,text) to authenticated;
