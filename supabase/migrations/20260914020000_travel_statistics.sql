-- Aggregated, traveler-maintained history. Never derive proof of travel from a save.
create function public.traveler_statistics(target uuid,period text default 'year') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_date date; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if target<>auth.uid() and (not public.can_view_traveler(target) or not exists(select 1 from public.traveler_profiles where user_id=target and share_stats)) then return null; end if;
 start_date:=case period when '30' then current_date-29 when '90' then current_date-89 when 'year' then date_trunc('year',current_date)::date when 'all' then date '1900-01-01' else null end;
 if start_date is null then raise exception 'Choose a supported period'; end if;
 with entries as (
 select *,case when actual_departure is not null and scheduled_departure is not null then extract(epoch from(actual_departure-scheduled_departure))/60 end as delay_minutes,
 case when actual_landing is not null and actual_takeoff is not null and actual_landing>=actual_takeoff and actual_landing-actual_takeoff<=interval '48 hours' then extract(epoch from(actual_landing-actual_takeoff))/60 end as air_minutes
 from public.travel_log where user_id=target and travel_date>=start_date and travel_date<=current_date+1
 ),taken as(select * from entries where outcome='taken'),airports as(select origin as code from taken union select destination from taken),
 airlines as(select airline,count(*) n from taken where airline<>'' group by airline order by n desc,airline limit 5),
 routes as(select origin,destination,count(*) n from taken group by origin,destination order by n desc,origin,destination limit 5),
 months as(select to_char(travel_date,'YYYY-MM') as month_key,count(*) n from taken group by 1 order by 1)
 select jsonb_build_object(
 'period',period,'from_date',case when period='all' then null else start_date end,'through_date',current_date,'basis','Traveler-maintained log; saving a flight does not confirm travel.',
 'logged',(select count(*) from entries),'taken',(select count(*) from taken),'cancelled',(select count(*) from entries where outcome='cancelled'),'missed',(select count(*) from entries where outcome='missed'),
 'airports',(select count(*) from airports),'airlines',(select count(distinct airline) from taken where airline<>''),'routes',(select count(distinct(origin,destination)) from taken),
 'departure_observations',(select count(delay_minutes) from taken),'on_time_percent',(select round(100.0*count(*) filter(where delay_minutes<15)/nullif(count(delay_minutes),0)) from taken),
 'delayed',(select count(*) from taken where delay_minutes>=15),'delay_minutes',(select round(sum(greatest(delay_minutes,0))) from taken where delay_minutes is not null),
 'airtime_minutes',(select round(sum(air_minutes)) from taken),'airtime_observations',(select count(air_minutes) from taken),
 'top_airlines',(select coalesce(jsonb_agg(jsonb_build_object('name',airline,'count',n)),'[]'::jsonb) from airlines),
 'top_routes',(select coalesce(jsonb_agg(jsonb_build_object('origin',origin,'destination',destination,'count',n)),'[]'::jsonb) from routes),
 'months',(select coalesce(jsonb_agg(jsonb_build_object('month',month_key,'count',n)),'[]'::jsonb) from months),
 'first_flight',(select min(travel_date) from taken),'latest_flight',(select max(travel_date) from taken)
 ) into result;
 return result;
end $$;
create function public.shared_travel_history(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if target<>auth.uid() and (not public.can_view_traveler(target) or not exists(select 1 from public.traveler_profiles where user_id=target and share_history)) then return null; end if;
 -- Only completed, explicitly logged trips. No gates, tails, booking codes or upcoming journeys.
 return (select coalesce(jsonb_agg(row_to_json(rows)),'[]'::jsonb) from(select flight_number,travel_date,origin,destination,airline,aircraft from public.travel_log where user_id=target and outcome='taken' and travel_date<=current_date order by travel_date desc,id limit 50) rows);
end $$;
revoke all on function public.traveler_statistics(uuid,text),public.shared_travel_history(uuid) from public,anon;
grant execute on function public.traveler_statistics(uuid,text),public.shared_travel_history(uuid) to authenticated;
