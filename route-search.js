export function validateRouteQuery(query,now=new Date()){
 const {origin,destination,date}=query;
 if(query.airline&&!/^[A-Z0-9]{2,3}$/.test(query.airline))return 'Choose a valid airline code.';
 if(!/^[A-Z]{3,4}$/.test(origin||'')||!/^[A-Z]{3,4}$/.test(destination||''))return 'Choose one departure airport and one arrival airport.';
 if(origin===destination)return 'Choose different departure and arrival airports.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number.isNaN(Date.parse(date))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)return 'Choose a valid departure date.';
 const limit=new Date(now);limit.setUTCFullYear(limit.getUTCFullYear()+1);
 if(date>limit.toISOString().slice(0,10))return 'Choose a date within the next year.';
 const earliest=new Date(now);earliest.setUTCDate(earliest.getUTCDate()-1);
 // The origin's current calendar day can be yesterday in UTC. The backend
 // applies the exact local-day boundary after resolving that airport.
 if(date<earliest.toISOString().slice(0,10))return 'Route discovery searches today and future schedules. Use the flight number for a past flight.';
 return null;
}
export function originDayWindow(date,timezone){
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const midnight=day=>{
  const target=Date.parse(`${day}T00:00:00Z`);let guess=target;
  for(let i=0;i<4;i++){
   const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
   const observed=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
   const correction=target-observed;if(!correction)break;guess+=correction;
  }
  return new Date(guess).toISOString().replace('.000Z','Z');
 };
 const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 return {start:midnight(date),end:midnight(next.toISOString().slice(0,10))};
}
export function scheduleCandidates(rows,{date,origin,destination,airport,normalize,localDate}){
 const unique=new Map();
 for(const row of rows){
  const f=normalize(row);
  f.origin={...f.origin,...airport};
  const same=(a,value)=>[a.code,a.code_iata,a.code_icao].includes(value);
  if(!same(f.origin,origin)||!same(f.destination,destination)||!airport?.timezone||localDate(f)!==date)continue;
  const ident=f.ident_iata||f.ident;if(!ident||!f.scheduled_out)continue;
  const key=`${ident}|${f.scheduled_out}|${f.origin.code}|${f.destination.code}`;
  const codeshares=f.codeshares_iata?.length?f.codeshares_iata:f.codeshares||[];
  if(!unique.has(key))unique.set(key,{ident,ident_iata:f.ident_iata,operator_icao:f.operator_icao,origin:f.origin,destination:f.destination,scheduled_out:f.scheduled_out,scheduled_in:f.scheduled_in,operator:f.operator_iata||f.operator_icao,source:'FlightAware published schedule',status:'Scheduled',schedule_only:true,codeshares});
  else unique.get(key).codeshares=[...new Set([...unique.get(key).codeshares,...codeshares])];
 }
 return [...unique.values()].sort((a,b)=>a.scheduled_out.localeCompare(b.scheduled_out)).slice(0,40);
}
// Only merge the same identifiers, route and scheduled gate departure; never a nearby leg.
export function mergeRouteStatus(schedules,payload,checkedAt){
 const direct=rows=>rows.flatMap(r=>r.segments?(r.segments.length===1?r.segments:[]):[r]);
 const rows=direct([...(payload?.flights||[]),...(payload?.scheduled_departures||[]),...(payload?.departures||[]),...(payload?.connections||[])]);
 const ids=f=>[f.ident,f.ident_iata,f.ident_icao,...(f.codeshares||[]),...(f.codeshares_iata||[])].filter(Boolean).map(value=>String(value).replace(/\s/g,'').toUpperCase());
 const africaOperators={ET:'ETH',KQ:'KQA',SA:'SAA','4Z':'LNK',FA:'SFR',P4:'APK',WB:'RWD',KP:'SKK',DT:'DTA',TC:'ATC',UR:'UGD',PW:'PRF',AH:'DAH',TU:'TAR',AT:'RAM',MS:'MSR',MK:'MAU',HM:'SEY',UU:'REU',TM:'LAM',BP:'BOT'};
 const identity=f=>ids(f).map(id=>{const match=id.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);if(!match)return id;const carrier=africaOperators[match[1]]||match[1];return `${carrier}|${match[2]}`;});
 const sameIdentity=(a,b)=>ids(a).some(id=>ids(b).includes(id))||identity(a).some(id=>identity(b).includes(id));
 const sameAirport=(a,b)=>[a?.code,a?.code_iata,a?.code_icao].filter(Boolean).some(c=>[b?.code,b?.code_iata,b?.code_icao].includes(c));
 return schedules.map(f=>{
  const candidates=rows.filter(r=>sameAirport(r.origin,f.origin)&&sameAirport(r.destination,f.destination)&&sameIdentity(r,f)).map(r=>({row:r,delta:Math.abs(Date.parse(r.scheduled_out)-Date.parse(f.scheduled_out))})).filter(item=>Number.isFinite(item.delta)&&item.delta<=20*60000).sort((a,b)=>a.delta-b.delta);
  // A small provider schedule revision is safe only when there is one
  // identity/route candidate. Never guess between repeated same-day services.
  if(candidates.length!==1)return f;
  const live=candidates[0].row;
  return {...f,...live,origin:{...f.origin,...live.origin},destination:{...f.destination,...live.destination},codeshares:[...new Set([...ids(f).filter(id=>![f.ident,f.ident_iata,f.ident_icao].filter(Boolean).map(value=>String(value).toUpperCase()).includes(id)),...(live.codeshares||[]),...(live.codeshares_iata||[])])],schedule_only:false,source:'FlightAware flight status',status_checked_at:checkedAt,status_match:candidates[0].delta?{method:'operator, flight number and route; revised schedule time',schedule_delta_minutes:Math.round(candidates[0].delta/60000)}:{method:'exact identifier, route and schedule time',schedule_delta_minutes:0}};
 });
}
