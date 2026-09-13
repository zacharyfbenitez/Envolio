import {localEpoch} from './traveler-intelligence.js';
const hour=3600000, finite=Number.isFinite;
const fresh=(t,now,minutes=15)=>finite(Date.parse(t))&&now-Date.parse(t)>=-300000&&now-Date.parse(t)<=minutes*60000;
const fact=(kind,label,score,evidence,source,at)=>({kind,label,score,evidence,source,at});
const noticePressure=title=>/airport closure/i.test(title)?85:/access/i.test(title)?25:45;
export function weatherPressure(forecast){
  if(forecast?.status!=='available')return null;
  const words=[forecast.summary,...(forecast.modifiers||[]).map(m=>m.summary)].join(' ');
  return /thunder|freezing|snow|\bSN\b|\bTS|\bFZ/i.test(words)?70:/low cloud|visibility|\bFG\b|wind (?:[3-9]\d|\d{3})/i.test(words)?45:0;
}
export function tripTimeline(flight,secondary,brief,now=Date.now()){
  const rows=Array.from({length:25},(_,i)=>{
    const at=new Date(now+i*3*hour).toISOString(),facts=[];
    for(const a of secondary.airports||[]){
      const w=a.windows?.[i];if(!w)continue;
      const score=weatherPressure(w.forecast);
      if(score!==null)facts.push(fact('weather',`${a.airport} forecast`,score,[w.forecast.summary,...(w.forecast.modifiers||[]).map(m=>`${m.weather_probability?m.weather_probability+'% weather chance: ':''}${m.summary}`)].join(' · '),'TAF via Skylink',w.forecast.retrieved_at));
      for(const n of w.notices||[])facts.push(fact('runway',`${a.airport} ${n.title}`,noticePressure(n.title),n.detail,n.source,n.receipt?.retrieved_at));
    }
    // Live ATC/congestion is a current observation, never extrapolated over 72 hours.
    if(i===0)for(const op of brief.operations||[])for(const x of op.items||[])if(['atc','congestion'].includes(x.type)&&fresh(x.observed_at,now,10))facts.push(fact(x.type,`${op.airport}: ${x.title}`,60,x.detail,x.source,x.observed_at));
    const dep=Date.parse(flight.scheduled_out);
    if(!flight.actual_out&&dep>=now+i*3*hour&&dep<now+(i+1)*3*hour&&brief.aircraft.assigned_inbound&&['tight','late'].includes(brief.aircraft.risk))facts.push(fact('inbound','Inbound turnaround',brief.aircraft.risk==='late'?85:55,`${brief.aircraft.ident} is ${brief.aircraft.status||'being tracked'}. Its reported arrival leaves ${brief.aircraft.turnaround_minutes} minutes before departure; our planning allowance is 45 minutes, not a historical minimum.`,'FlightAware assigned inbound',secondary.checked_at));
    const score=facts.length?Math.max(...facts.map(x=>x.score)):null;
    return {at,hours:i*3,score,facts,coverage:[...new Set(facts.map(x=>x.kind))]};
  });
  rows.forEach((r,i)=>{const prev=rows[i-1];r.movement=!prev||r.score===null||prev.score===null?'Coverage is incomplete; no comparable movement.':r.score>prev.score?`Pressure rises as ${r.facts.filter(f=>f.score===r.score).map(f=>f.label).join(', ')} applies.`:r.score<prev.score?'Fewer or lower-severity supported signals apply. Check coverage before treating this as improvement.':'Supported pressure is unchanged.'});
  return {rows,updated_at:secondary.checked_at,method:'Planning pressure, not a delay probability. Highest supported signal: weather 0/45/70; ATC or congestion 60; runway access 25, runway/terminal closure 45, airport closure 85; short turnaround 55/late inbound 85. These are heuristic severity bands. One runway closure does not mean the airport is closed. Lines join sampled points, not continuous forecasts.',missing:['Crew legality and roster','Maintenance records','Future aircraft swaps','Unpublished weather beyond forecast validity','Connection until you add your onward flight']};
}
export function playbooks(brief){
  const items=[];
  for(const f of brief.fields.filter(f=>f.needs_traveler_confirmation))items.push({title:`Verify ${f.label.toLowerCase()}`,evidence:`FlightAware: ${f.flightaware}; Skylink: ${f.skylink}.`,source:'Matched FlightAware / Skylink fields',classification:'Sources disagree',now:'Check airport screens or ask an airline agent before moving.',wait:'Keep checking for a consistent airline update.',escalate:'If the boarding cutoff is close, ask an agent at your current gate.',avoid:'Do not assume a single-source change is final.'});
  if(['tight','late'].includes(brief.aircraft.risk))items.push({title:'Give your inbound aircraft room to recover',evidence:`${brief.aircraft.ident}: ${brief.aircraft.status||'status unavailable'}. Reported arrival leaves ${brief.aircraft.turnaround_minutes} minutes before departure. The comparison is a 45-minute planning allowance—not an observed airline minimum.`,source:'FlightAware assigned inbound',classification:'Likely contributor',now:'Follow the original check-in deadline and stay reachable for boarding updates.',wait:'Watch for the inbound arrival or a replacement aircraft.',escalate:'If this threatens your connection or arrival deadline, ask the airline about protected alternatives.',avoid:'Do not leave for the airport later solely because of this estimate.'});
  for(const r of brief.reasons.slice(0,4))items.push({title:r.title,evidence:r.detail,source:r.source,classification:r.classification==='confirmed'?'Published cause':r.classification==='likely'?'Likely contributor':'Possible contributor',now:'Check your airline’s flight update and save a backup option.',wait:'Monitor the next airline update; an airport advisory may not delay your flight.',escalate:'If the airline cancels or your connection no longer fits, ask about rerouting and any fare difference before accepting.',avoid:'Do not cancel your existing ticket or buy a backup assuming reimbursement.'});
  return items.length?items.slice(0,6):[{title:'Stay ready without changing your plans',evidence:'No actionable disruption has been verified from the available sources.',source:'Available flight evidence',classification:'Limited signal',now:'Follow the airline’s original check-in and boarding deadlines.',wait:'Watch for updated gates, times and inbound aircraft.',escalate:'Contact the airline if an official change affects your plans.',avoid:'Missing data is not an on-time guarantee.'}];
}
export function airportPressure(airport,operations,weather,delay,now=Date.now()){
  const items=[];
  for(const x of operations?.items||[])if(fresh(x.observed_at,now,10))items.push(fact(x.type,x.title,['runway','terminal'].includes(x.type)?noticePressure(x.title):60,x.detail,x.source,x.observed_at));
  const o=weather?.observations?.[0];
  if(o&&fresh(o.time,now,120)){
    const severe=/\bTS|thunder|freezing|snow|\bSN\b|\bFZ/i.test(o.conditions||'');
    const score=severe?70:(finite(o.visibility)&&o.visibility<3)||(o.wind_speed_gust??o.wind_speed)>=30?45:0;
    items.push(fact('weather','Latest airport weather',score,o.conditions||o.cloud_friendly||'Observation returned',weather.provider_detail||weather.provider||'FlightAware METAR',o.time));
  }
  if(delay&&fresh(delay.retrieved_at,now,10)&&['green','yellow','red'].includes(delay.color)&&!items.some(x=>x.kind==='congestion'))items.push(fact('congestion','Airport delay conditions',delay.color==='red'?70:delay.color==='yellow'?40:0,delay.reasons?.map(x=>x.reason).filter(Boolean).join(' · ')||'No active program reported in this response.','FlightAware airport delays',delay.retrieved_at));
  return {airport,score:items.length?Math.max(...items.map(x=>x.score)):null,items,updated_at:new Date(now).toISOString(),missing:['Security queues','Taxi-time distribution','Gate holds not published as advisories','Airport-wide cancellation sample','Baggage issues'],method:'Airport Chaos Index: partial operational pressure, not a complete airport rating. Highest observed heuristic severity is used, not independent votes. Unavailable inputs are excluded—not treated as zero.'};
}
export function connectionSurvival(check,first,next,history){
  if((!finite(check.remaining_minutes)&&check.status!=='at_risk')||check.status==='unavailable')return {score:null,label:'Cannot assess yet',missing:['Verified flight timing'],method:'No score without a verified connection.'};
  const score=['at_risk'].includes(check.status)?0:Math.max(0,Math.min(100,Math.round(50*check.remaining_minutes/check.buffer_minutes)));
  const samples=(history?.rows||[]).filter(r=>finite(r.arrival));
  const margin=check.scheduled_minutes-check.buffer_minutes;
  const terminalChange=first.terminal_destination&&next.terminal_origin?String(first.terminal_destination)!==String(next.terminal_origin):null;
  return {score,label:score<50?'Little recovery room':score<75?'Some recovery room':'More recovery room',method:'Connection Survival Score is a planning-margin index, not the probability of making the flight: 50 × available minutes ÷ your transfer allowance, capped at 100. Cancellation or an already-missed connection scores 0.',terminal_change:terminalChange,gate_context:`Arrival ${first.terminal_destination||'terminal unknown'} / ${first.gate_destination||'gate unknown'} → departure ${next.terminal_origin||'terminal unknown'} / ${next.gate_origin||'gate unknown'}`,history:samples.length?{samples:samples.length,within_allowance:samples.filter(r=>r.arrival<=margin).length,note:'Past arrivals that would fit the scheduled gap and your allowance; not a live survival probability.'}:null,missing:['Measured gate walking distance and airport layout','Official minimum connection time','Security and immigration queues','Live taxi time; gate arrival estimates already include taxi','Verified baggage transfer and ticket protection'],advice:terminalChange?'A terminal change is reported. Increase your allowance for the transfer; we do not know its walking time.':'Use an allowance that covers boarding cutoffs, walking, security and baggage.'};
}
export function travelPreferences(input={}){
  return {priority:['price','simpler','earliest'].includes(input.priority)?input.priority:'simpler',avoidRedeye:input.avoidRedeye===true,avoidAirportChanges:input.avoidAirportChanges!==false,avoidRegional:input.avoidRegional===true,minLayover:Math.max(30,Math.min(360,Number(input.minLayover)||75)),readyMinutes:Math.max(30,Math.min(720,Number(input.readyMinutes)||120))};
}
export function rankBackups(rows,flight,input={},now=Date.now()){
  const prefs=travelPreferences(input),seen=new Set(),out=[];
  const aliases=[flight.ident_iata,flight.ident,...(flight.codeshares_iata||[])].filter(Boolean).map(s=>s.replace(/\s/g,''));
  for(const r of rows){
    const legs=r.legs;if(!Array.isArray(legs)||!legs.length||legs.length>4)continue;
    const first=legs[0],last=legs.at(-1),warnings=[];
    if(first.departure_airport!==flight.origin?.code_iata||last.arrival_airport!==flight.destination?.code_iata)continue;
    let dep,arr;try{dep=localEpoch(first.departure_datetime,flight.origin?.timezone);arr=localEpoch(last.arrival_datetime,flight.destination?.timezone)}catch{continue;}
    if(!finite(dep)||!finite(arr)||arr<=dep||dep<now+prefs.readyMinutes*60000||dep>now+370*24*hour)continue;
    const same=aliases.includes(String(first.flight_number).replace(/\s/g,''))&&Math.abs(dep-Date.parse(flight.scheduled_out))<15*60000;if(same)continue;
    let reject=false,unknownAircraft=false;
    for(let i=0;i<legs.length;i++){
      const l=legs[i],local=l.departure_datetime?.match(/T(\d\d):/);
      const overnight=local?(+local[1]>=22||+local[1]<6):null;
      if(prefs.avoidRedeye&&(overnight===true||overnight===null)){reject=true;break;}
      if(overnight)warnings.push('Overnight departure');
      if(prefs.avoidRegional){if(!l.aircraft_type)unknownAircraft=true;else if(/CRJ|ERJ|E1[347]|DH8|AT[47]/i.test(l.aircraft_type)){reject=true;break;}}
      if(i>0){
        const prior=legs[i-1],change=prior.arrival_airport!==l.departure_airport;
        if(change){if(prefs.avoidAirportChanges){reject=true;break;}warnings.push('Airport change: ground transport time is unverified');}
        // The layover object is provider-supplied minutes at the connection airport.
        const lay=r.layovers?.[i-1];
        if(!lay||!finite(lay.duration_min)||lay.duration_min<prefs.minLayover||(!change&&lay.airport!==l.departure_airport)){reject=true;break;}
        if(!change){
          // Both local times are at the same airport. Reject contradictory sequences;
          // do not silently choose an interpretation of a DST-changing layover.
          const gap=(Date.parse(l.departure_datetime)-Date.parse(prior.arrival_datetime))/60000;
          if(!finite(gap)||Math.abs(gap-lay.duration_min)>1){reject=true;break;}
        }
      }
    }
    if(reject)continue;
    if(unknownAircraft)warnings.push('Aircraft type missing: regional-jet preference cannot be verified');
    const key=legs.map(l=>`${l.flight_number}|${l.departure_datetime}|${l.departure_airport}`).join('>');if(seen.has(key))continue;seen.add(key);
    out.push({...r,key,departure_at:new Date(dep).toISOString(),arrival_at:new Date(arr).toISOString(),warnings,aircraft_preference_verified:!unknownAircraft,explanation:legs.length===1?'Same-airport nonstop: fewer transfer points, not a lower measured cancellation probability.':`Each published layover meets your ${prefs.minLayover}-minute allowance; walking and protection remain unverified.`,status_check:{status:'unavailable',reason:'Not yet cross-checked'},missing:['Seat inventory and refundability','Cancellation-pattern comparison','Protected rebooking eligibility']});
  }
  out.sort((a,b)=>prefs.priority==='price'?(finite(a.price_usd)?a.price_usd:Infinity)-(finite(b.price_usd)?b.price_usd:Infinity):prefs.priority==='earliest'?Date.parse(a.arrival_at)-Date.parse(b.arrival_at):a.legs.length-b.legs.length||Date.parse(a.arrival_at)-Date.parse(b.arrival_at));
  return {preferences:prefs,flights:out.slice(0,5),note:'Indicative Skylink quotes may be cached upstream for an hour. Same origin/destination airports only; routes without verifiable published layovers are excluded. “Simpler journey” is not a validated minimum-risk ranking. No purchase or booking protection is implied.'};
}
export function tripStrategy(flight,secondary,brief,context,now=Date.now()){
  const changes=(context.assignment_changes||[]).map(c=>({title:'Published aircraft assignment changed',detail:`FlightAware previously reported ${c.from}; it now reports ${c.to}. Change observed ${c.at}. This does not establish a maintenance or crew problem.`,classification:'Observed assignment change',source:'FlightAware lookup snapshots'}));
  return {timeline:tripTimeline(flight,secondary,brief,now),playbooks:playbooks(brief),airline_view:{title:'What the airline knows — public-signal view',note:'We do not have internal airline systems. These are public operational clues, not privileged staff knowledge.',signals:[...changes,...brief.reasons],unknown:['Crew duty limits and roster: unavailable','Maintenance diagnosis: unavailable unless explicitly published','Aircraft swap: not predicted; assignment changes are shown only after observation']},airports:(secondary.airports||[]).map(a=>airportPressure(a.airport,brief.operations.find(o=>o.side===a.side),a.weather,a.side==='origin'?context.originDelay:context.arrivalDelay,now))};
}
