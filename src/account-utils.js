export const ACCOUNT_PERIODS=[{key:'30',label:'30 days'},{key:'90',label:'90 days'},{key:'year',label:'This year'},{key:'all',label:'All time'}];
export const AIRCRAFT_CHOICES=['Airbus A220','Airbus A320 family','Airbus A330','Airbus A350','Airbus A380','Boeing 737','Boeing 747','Boeing 757','Boeing 767','Boeing 777','Boeing 787','Embraer E175','Embraer E190 / E195','ATR 72','De Havilland Dash 8','Still discovering'];
export const AVATAR_COLORS=['violet','mint','blue','amber','rose'];
export function profileErrors(profile,phone){
 const errors={};
 if(!/^[a-z][a-z0-9_]{2,23}$/.test(profile.handle||'')||['admin','support','envolio','security','official','staff'].includes(profile.handle))errors.handle='Use 3–24 lowercase letters, numbers or underscores; start with a letter.';
 if(!profile.display_name?.trim()||profile.display_name.trim().length>60)errors.display_name='Enter a name of up to 60 characters.';
 if(!/^[A-Z]{3}$/.test(profile.home_airport||''))errors.home_airport='Use the three-letter airport code, such as JFK.';
 for(const field of ['favorite_airline','favorite_aircraft'])if(!profile[field]?.trim()||profile[field].length>80)errors[field]='Choose a favorite or enter one of your own.';
 if(phone!==undefined&&!/^\+[1-9]\d{7,14}$/.test(normalizePhone(phone)))errors.phone='Include your country code, for example +1 212 555 0123.';
 return errors;
}
export const normalizePhone=value=>String(value||'').replace(/[\s().-]/g,'');
export function initials(name){return String(name||'Traveler').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('');}
export function minutesLabel(value){if(!Number.isFinite(value))return 'Not recorded';const rounded=Math.max(0,Math.round(value));return `${Math.floor(rounded/60)}h ${rounded%60}m`;}
export function dateOnlyLabel(date){const t=Date.parse(`${date}T12:00:00Z`);return Number.isFinite(t)?new Date(t).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Date not recorded';}
export function logFromJourney(item){
 const f=item.snapshot||{},code=a=>a?.code_iata||a?.alternate_ident||a?.code||'';
 const stamp=value=>Number.isFinite(Date.parse(value))?value:null;
 return {source_key:item.key,flight_number:item.display_ident||item.ident,travel_date:item.date,origin:code(item.origin).replace(/^K(?=[A-Z]{3}$)/,''),destination:code(item.destination).replace(/^K(?=[A-Z]{3}$)/,''),airline:item.operator||'',aircraft:f.aircraft_type||'',outcome:f.cancelled?'cancelled':'taken',source:'saved_snapshot',scheduled_departure:stamp(f.scheduled_out),actual_departure:stamp(f.actual_out),actual_arrival:stamp(f.actual_in),actual_takeoff:stamp(f.actual_off),actual_landing:stamp(f.actual_on)};
}
export function logErrors(record){const errors={};
 if(!/^[A-Z0-9]{2,12}$/.test(record.flight_number||''))errors.flight_number='Enter a flight number, such as PD604.';
 const date=Date.parse(record.travel_date);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.travel_date||'')||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==record.travel_date)errors.travel_date='Choose a valid local departure date.';
 // Tomorrow can already be today's local date across the international date line.
 if(Date.parse(record.travel_date)>Date.now()+86400000)errors.travel_date='Use the log for past travel. Keep upcoming flights in Saved.';
 for(const field of ['origin','destination'])if(!/^[A-Z]{3}$/.test(record[field]||''))errors[field]='Enter a three-letter airport code.';
 if(record.origin===record.destination)errors.destination='Choose a different arrival airport.';
 return errors;
}
export function periodTitle(key){return ACCOUNT_PERIODS.find(x=>x.key===key)?.label||'This year';}
export function safeAccountError(error,fallback='We couldn’t save that change. Please try again.'){
 const message=String(error?.message||'');
 if(error?.code==='23505')return 'That handle or flight is already in use. Choose another or open the existing entry.';
 if(/daily|limit|too many|wait before/i.test(message))return 'Please wait before trying again. There’s a limit on repeated requests.';
 if(/unavailable|no longer/i.test(message))return 'This profile or request is no longer available.';
 if(error?.code==='42501')return 'You don’t have access to that information. Sign in again if this is your account.';
 return fallback;
}
