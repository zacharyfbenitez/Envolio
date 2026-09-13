import { clean } from './skylink.js';

const ms = v => typeof v === 'string' ? Date.parse(v) : NaN;
const airport = a => a?.code_icao || a?.code || a?.code_iata;
const delta = (a,b) => Number.isFinite(ms(a)) && Number.isFinite(ms(b)) ? Math.round((ms(a)-ms(b))/60000) : null;
const available = v => v !== null && v !== undefined && v !== '';
const recent = (stamp,now,minutes=15) => Number.isFinite(ms(stamp)) && now-ms(stamp)>=-300000 && now-ms(stamp)<=minutes*60000;
export const FIELD_LABELS={gate_origin:'Departure gate',terminal_origin:'Departure terminal',gate_destination:'Arrival gate',terminal_destination:'Arrival terminal',baggage_claim:'Baggage belt',departure_delay:'Departure delay',arrival_time:'Arrival estimate',aircraft:'Aircraft type',registration:'Aircraft registration'};

function localDisplay(time,zone) {
  if(!Number.isFinite(ms(time))||!zone)return null;
  try {const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(x=>[x.type,x.value]));return `${Number(p.day)} ${p.month.slice(0,3).toLowerCase()} ${p.hour}:${p.minute}`;}catch{return null;}
}
function skyDisplay(day,time) {
  const m=String(day||'').match(/^(\d{1,2})\s+([a-z]{3,})$/i);
  return m&&/^\d\d:\d\d$/.test(time||'')?`${Number(m[1])} ${m[2].slice(0,3).toLowerCase()} ${time}`:null;
}

export function fieldConfidence(flight, secondary, fetched, now=Date.now(), aircraftPosition=null) {
  const matched=secondary?.comparison?.status==='matched';
  const sky=matched?secondary.status_data:null;
  const skyFresh=matched&&recent(secondary.comparison.receipt?.retrieved_at,now,5);
  const faFresh=recent(fetched,now);
  const pairs={gate_origin:[clean(flight.gate_origin),clean(sky?.departure?.gate)],terminal_origin:[clean(flight.terminal_origin),clean(sky?.departure?.terminal)],gate_destination:[clean(flight.gate_destination),clean(sky?.arrival?.gate)],terminal_destination:[clean(flight.terminal_destination),clean(sky?.arrival?.terminal)],baggage_claim:[clean(flight.baggage_claim),clean(sky?.arrival?.baggage)],aircraft:[clean(flight.aircraft_type),aircraftPosition?.flight_link_verified?clean(aircraftPosition.aircraft_type):null],registration:[clean(flight.registration),aircraftPosition?.registration || null]};
  // Compare like-for-like estimated arrival only. SkyLink's ambiguous actual_time is not an actual event.
  pairs.arrival_time=[localDisplay(flight.estimated_in,flight.destination?.timezone),skyDisplay(sky?.arrival?.estimated_date,sky?.arrival?.estimated_time)];
  const depDelay=delta(flight.actual_out || flight.estimated_out,flight.scheduled_out);
  const skyDelay=sky?.status?.match(/^Departure delayed\s+(\d+)\s*(?:min|minutes)\b/i);
  pairs.departure_delay=[depDelay,skyDelay?Number(skyDelay[1]):null];
  return Object.entries(pairs).map(([field,[fa,sk]])=>{
    const isAircraft=['aircraft','registration'].includes(field);
    const skFresh=isAircraft?aircraftPosition?.status==='available':skyFresh;
    const f=available(fa)&&faFresh,s=available(sk)&&skFresh;
    const normalized=v=>String(v).trim().toUpperCase().replace(/^(?:GATE|TERMINAL)\s+/,'');
    const same=f&&s&&(normalized(fa)===normalized(sk)||(field==='aircraft'&&String(sk).toUpperCase().split(/[^A-Z0-9]+/).includes(normalized(fa))));
    const conflict=f&&s&&!same;
    const state=conflict?'conflict':same?'agreement':f||s?'single_source':available(fa)||available(sk)?'stale':'unavailable';
    return {field,label:FIELD_LABELS[field],flightaware:fa??null,skylink:sk??null,state,
      score:state==='agreement'?85:state==='single_source'?55:state==='conflict'?20:state==='stale'?10:0,
      needs_traveler_confirmation:conflict,
      receipts:{flightaware:{retrieved_at:fetched||null},skylink:{endpoint:isAircraft?'/adsb/aircraft':secondary?.comparison?.receipt?.endpoint,observed_at:isAircraft?aircraftPosition?.observed_at||null:null,retrieved_at:isAircraft?aircraftPosition?.retrieved_at||null:secondary?.comparison?.receipt?.retrieved_at||null}},
      explanation:conflict?`${FIELD_LABELS[field]} differs between sources. ${/gate|terminal|baggage/.test(field)?'Verify at airport screens before moving.':'Check the airline’s latest update.'}`:same?'Both current sources report the same value; their upstream sources may overlap.':state==='single_source'?'One current source reports this field; it is not independently confirmed.':state==='stale'?'The source is too old for a current cross-check.':'Comparable information is not available.',
      method:'Evidence score, not measured correctness: current agreement 85; one current source 55; conflict 20; stale 10; unavailable 0. Matching freshness is based on retrieval unless an observation time is supplied.'};
  });
}

export function routeVariance(flight,history=[],now=Date.now()) {
  const seen=new Set(),rows=[];
  for(const f of history){
    const key=f.fa_flight_id||`${f.ident}|${f.scheduled_out}|${airport(f.origin)}|${airport(f.destination)}`;
    if(seen.has(key)||(flight.fa_flight_id&&f.fa_flight_id===flight.fa_flight_id)||airport(f.origin)!==airport(flight.origin)||airport(f.destination)!==airport(flight.destination))continue;
    seen.add(key);
    const cutoff=Math.min(now,ms(flight.scheduled_out)||now);
    if(!Number.isFinite(ms(f.scheduled_out))||ms(f.scheduled_out)>=cutoff)continue;
    const departure=ms(f.actual_out)<cutoff?delta(f.actual_out,f.scheduled_out):null;
    const arrival=ms(f.actual_in)<cutoff?delta(f.actual_in,f.scheduled_in):null;
    if(departure!==null||arrival!==null)rows.push({date:f.scheduled_out,departure,arrival});
  }
  const summarize=field=>{
    const values=rows.map(r=>r[field]).filter(Number.isFinite).sort((a,b)=>a-b),n=values.length;
    return {samples:n,median_minutes:n?values[Math.floor(n/2)]:null,p90_minutes:n?values[Math.ceil(n*.9)-1]:null,delayed_15_plus:n?values.filter(v=>v>=15).length:null};
  };
  return {source:'FlightAware historical actual gate times',departure:summarize('departure'),arrival:summarize('arrival'),rows:rows.sort((a,b)=>ms(a.date)-ms(b.date)).slice(-12),note:'Historical variation, not a prediction. Early arrivals remain negative; estimates are excluded.'};
}

export function aircraftIntelligence(flight,inbound,positionResult,now=Date.now()) {
  const tailAgrees=!clean(flight.registration)||!clean(inbound?.registration)||clean(flight.registration).toUpperCase()===clean(inbound.registration).toUpperCase();
  const assigned=!!inbound&&!!flight.inbound_fa_flight_id&&inbound.fa_flight_id===flight.inbound_fa_flight_id&&airport(inbound.destination)===airport(flight.origin)&&tailAgrees;
  const target=assigned?inbound:flight;
  const tail=clean(target.registration);
  const candidates=positionResult?.status==='available'?(positionResult.data?.aircraft||[]):[];
  const p=candidates.find(p=>tail&&String(p.registration).toUpperCase()===tail.toUpperCase()&&recent(p.last_seen,now,5)&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
  const position=p?{status:'available',registration:p.registration,aircraft_type:p.aircraft_type,latitude:p.latitude,longitude:p.longitude,altitude_ft:p.altitude,ground_speed_kt:p.ground_speed,callsign:p.callsign,observed_at:p.last_seen,retrieved_at:positionResult.retrieved_at,flight_link_verified:[target.ident,target.ident_icao].includes(String(p.callsign||'').trim()),source:'Skylink ADS-B'}:null;
  const arrival=assigned?(inbound.actual_in||inbound.estimated_in):null;
  const turn=delta(flight.scheduled_out,arrival);
  const previousDeparture=assigned?delta(inbound.actual_out||inbound.estimated_out,inbound.scheduled_out):null;
  const previousArrival=assigned?delta(inbound.actual_in||inbound.estimated_in,inbound.scheduled_in):null;
  return {assigned_inbound:assigned,registration:tail,ident:target.ident_iata||target.ident,status:assigned?inbound.status:flight.status,position,
    arrival_at:arrival,turnaround_minutes:turn,turnaround_assumption_minutes:45,previous_departure_delay:previousDeparture,previous_arrival_delay:previousArrival,
    previous_departure_basis:inbound?.actual_out?'actual':'estimated',previous_arrival_basis:inbound?.actual_in?'actual':'estimated',
    risk:!assigned||flight.actual_out?'not_applicable':turn===null?'unknown':turn<0?'late':turn<45?'tight':'no_short_turn_flag',
    advice:!assigned?(!tailAgrees?'The published inbound leg and assigned aircraft disagree. Confirm the aircraft assignment with the airline.':'No verified assigned inbound leg is available. A tail position does not prove which aircraft will operate this flight.'):turn!==null&&turn<45?'The aircraft may have little time to turn around. Keep checking boarding; follow original check-in deadlines.':'The assigned inbound is shown below. Aircraft assignments can still change.',
    note:'45 minutes is a planning allowance, not an airline-specific turnaround requirement. Position requires an exact tail match and a recent observation.'};
}

export function airportOperations(flight,secondary,context={},now=Date.now()) {
  return ['origin','destination'].map(side=>{
    const a=flight[side],sky=(secondary.airports||[]).find(x=>x.side===side),items=[];
    const target=side==='origin'?flight.estimated_out||flight.scheduled_out:flight.estimated_in||flight.scheduled_in;
    const relevant=Math.abs(ms(target)-now)<6*3600000&&!flight.schedule_only;
    const fa=side==='origin'?context.originDelay:context.arrivalDelay;
    if(relevant&&fa&&recent(fa.retrieved_at,now,10)&&['yellow','red'].includes(fa.color))items.push({type:'congestion',title:'Airport delay conditions',detail:(fa.reasons||[]).map(r=>r.reason).filter(Boolean).join('; ')||'Airport-wide disruption reported.',source:'FlightAware',observed_at:fa.retrieved_at});
    // FAA via SkyLink and direct FAA are the same evidence family, not two votes.
    const faa=secondary.faa;
    if(relevant&&faa?.status==='available'&&recent(faa.retrieved_at,now,10))for(const [group,title] of [['ground_delays','Ground delay program'],['ground_stops','Ground stop'],['closures','Airport closure advisory']]){
      for(const e of faa.data?.[group]||[]){
        if(![a?.code,a?.code_iata,a?.code_icao].filter(Boolean).includes(e.airport)||/\bGA\b|PPR|NON.?SKED|TRANSIENT|EXCEPT|\bEXC\b/i.test(e.reason||''))continue;
        items.push({type:'atc',title,detail:[e.reason,e.avg_delay?`Airport average: ${e.avg_delay}`:null].filter(Boolean).join(' · '),source:'FAA NAS via Skylink',observed_at:faa.retrieved_at});
      }
    }
    for(const n of sky?.notices||[])items.push({type:n.category||'runway',title:n.title,detail:n.detail,source:n.source,observed_at:n.receipt?.retrieved_at,notice_id:n.id});
    const terminal=items.filter(i=>i.type==='terminal');
    return {side,airport:a?.code_iata||airport(a),items:items.slice(0,8),terminal_status:terminal.length?'reported':'No verified terminal advisory available.',coverage:sky?.receipts||[],note:'Airport-wide conditions do not establish a cause for this flight. No notice returned is not an all-clear.'};
  });
}

export function disruptionBrief(flight,secondary,context={},history=[],now=Date.now()) {
  const aircraft=aircraftIntelligence(flight,context.inbound,secondary.aircraft,now);
  const fields=fieldConfidence(flight,secondary,context.retrieved_at,now,aircraft.assigned_inbound?null:aircraft.position);
  const operations=airportOperations(flight,secondary,context,now);
  const reasons=(context.reasoning?.reasons||[]).map(r=>({...r}));
  if(!flight.actual_out&&!flight.schedule_only){
    for(const a of secondary.airports||[]){
      if(a.forecast?.status==='available'&&/thunder|snow|freezing|low cloud|visibility|wind (?:[3-9]\d|\d{3})/i.test([a.forecast.summary,...(a.forecast.modifiers||[]).map(m=>m.summary)].join(' ')))reasons.push({title:`Weather could affect ${a.airport}`,detail:[a.forecast.summary,...(a.forecast.modifiers||[]).map(m=>m.summary)].join(' · '),classification:'possible',source:'TAF via Skylink'});
    }
    for(const a of operations)for(const item of a.items)if(!reasons.some(r=>r.title===item.title))reasons.push({...item,classification:'possible'});
    if(aircraft.risk==='late'||aircraft.risk==='tight')reasons.unshift({title:aircraft.risk==='late'?'Inbound aircraft is late':'Short aircraft turnaround',detail:aircraft.advice,classification:'likely',source:'FlightAware assigned inbound'});
  }
  const conflicts=fields.filter(f=>f.needs_traveler_confirmation);
  const variance=routeVariance(flight,history,now);
  const historicalFlag=variance.arrival.samples>=5&&variance.arrival.p90_minutes>=15;
  const signals=operations.flatMap(a=>a.items).length+(aircraft.risk==='late'||aircraft.risk==='tight'?1:0)+(reasons.some(r=>r.source==='TAF via Skylink')?1:0);
  return {fields,aircraft,operations,reasons:reasons.slice(0,6),history:variance,
    route_risk:{label:signals?'Disruption signals present':historicalFlag?'Allow for historical arrival variation':flight.schedule_only?'Historical context only':'No additional disruption signal verified',signal_count:signals,historical_variation_flag:historicalFlag,method:'We check weather, airport notices and aircraft timing for possible disruption. The actual flight times below show how this route has varied recently—not what will happen to your flight.',screening_rule:'Flag historical variation when at least five actual arrivals have a 90th-percentile delay of 15+ minutes. This is an uncalibrated planning rule, not a forecast.',historical_arrival_p90:variance.arrival.p90_minutes},
    traveler_action:conflicts.length?{title:'Needs traveler confirmation',detail:conflicts[0].explanation}:aircraft.risk==='late'||aircraft.risk==='tight'?{title:'Boarding may move',detail:aircraft.advice}:reasons.length?{title:'Keep your plans flexible',detail:'There are operational clues to a possible disruption. Check the airline before changing your plans.'}:{title:'Keep following airline updates',detail:'We have no additional supported recommendation right now. Missing data does not mean the flight is on time.'}};
}

export function connectionCheck(first,next,{buffer=60,firstFetched,nextFetched}={},now=Date.now()) {
  const base={buffer_minutes:buffer,buffer_source:'Traveler planning allowance; not an official minimum connection time',note:'Boarding cutoffs, immigration, security, terminal transfers and separate tickets may require more time.'};
  const fail=message=>({...base,status:'unavailable',recommendation:message});
  if(!Number.isFinite(buffer)||buffer<20||buffer>360)return fail('Choose a transfer allowance between 20 and 360 minutes.');
  if(!first||!next||airport(first.destination)!==airport(next.origin))return fail('Choose an onward flight departing from your arrival airport.');
  if(first.fa_flight_id&&first.fa_flight_id===next.fa_flight_id)return fail('Choose a different onward flight.');
  if(!recent(firstFetched,now)||!recent(nextFetched,now))return fail('Refresh both flights before checking your connection.');
  if(/cancel|divert/i.test(first.status||'')||/cancel|divert/i.test(next.status||''))return {...base,status:'at_risk',recommendation:'A flight is cancelled or diverted. Contact the airline about your onward journey.'};
  const arrival=first.actual_in||first.estimated_in||first.scheduled_in,departure=next.actual_out||next.estimated_out||next.scheduled_out;
  const scheduled=delta(next.scheduled_out,first.scheduled_in),remaining=delta(departure,arrival);
  if(remaining===null||scheduled===null||scheduled<0||scheduled>48*60)return fail('The selected dates do not form a verifiable connection within 48 hours.');
  const noLive=!first.actual_in&&!first.estimated_in;
  const departed=!!next.actual_out&&!first.actual_in;
  const status=departed||remaining<0?'at_risk':remaining<buffer?'tight':noLive?'schedule_only':'within_allowance';
  return {...base,status,scheduled_minutes:scheduled,remaining_minutes:remaining,delay_consumed_minutes:scheduled-remaining,arrival_at:arrival,departure_at:departure,
    recommendation:departed?'Your onward flight has departed while your arrival is unconfirmed. Speak to the airline.':status==='at_risk'?'Your arrival is later than the onward departure. Ask the airline about alternatives.':status==='tight'?'Your connection is tighter than your chosen allowance. Contact the airline and check your next gate.':status==='schedule_only'?'The schedule fits your allowance, but live arrival information is not available yet.':'Your current estimate fits your chosen allowance. Keep checking both flights; this is not a connection guarantee.'};
}

export function localEpoch(value,zone) {
  if(typeof value!=='string')return NaN;
  if(/(?:Z|[+-]\d\d:\d\d)$/.test(value))return Date.parse(value);
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(!m||!zone)return NaN;
  const desired=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
  if(new Date(desired).toISOString().slice(0,19)!==`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}`)return NaN;
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=t=>{const p=Object.fromEntries(format.formatToParts(new Date(t)).map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)};
  let guess=desired;for(let i=0;i<4;i++)guess+=desired-local(guess);
  // Reject skipped or repeated local times instead of silently choosing a DST occurrence.
  if(local(guess)!==desired||local(guess-3600000)===desired||local(guess+3600000)===desired)return NaN;
  return guess;
}

export function suitableAlternatives(rows,first,next,check) {
  const cutoff=Date.parse(check.arrival_at)+check.buffer_minutes*60000;
  return rows.filter(r=>{
    const legs=r.legs||[],start=legs[0],end=legs.at(-1);
    if(!start||start.departure_airport!==first.destination?.code_iata||end.arrival_airport!==next.destination?.code_iata)return false;
    let t;try{t=localEpoch(start.departure_datetime,next.origin?.timezone)}catch{return false;}
    if(!Number.isFinite(t)||!Number.isFinite(cutoff)||t<cutoff||t>cutoff+48*3600000)return false;
    if(String(start.flight_number).replace(/\s/g,'')===next.ident_iata)return false;
    return true;
  }).slice(0,4);
}
