import {flightOptionIdentity} from './flight-option.js';
export function nextJourney(items,now=Date.now()){
 return items.filter(i=>{const s=i.snapshot||{};if(s.actual_out||s.cancelled)return false;const t=Date.parse(s.estimated_out||s.scheduled_out);if(Number.isFinite(t))return t>=now;try{return i.date>=new Intl.DateTimeFormat('en-CA',{timeZone:i.origin?.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}catch{return false;}}).sort((a,b)=>a.date.localeCompare(b.date)||(Date.parse(a.snapshot?.scheduled_out)||Infinity)-(Date.parse(b.snapshot?.scheduled_out)||Infinity))[0];
}
export function filterFlights(flights,{carrier='',window='all',sort='departure'}={}){
 const stamp=f=>Date.parse(f.estimated_out||f.scheduled_out)||Infinity;
 const end=f=>Date.parse(f.estimated_in||f.scheduled_in)||Infinity;
 return flights.filter(f=>{
  if(carrier&&flightOptionIdentity(f).carrier!==carrier)return false;
  if(window==='all')return true;
  if(!f.origin?.timezone||!Number.isFinite(stamp(f)))return false;
  try{const h=Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:f.origin.timezone}).format(new Date(stamp(f))));return window==='morning'?h<12:window==='afternoon'?h>=12&&h<18:h>=18;}catch{return false;}
 }).sort((a,b)=>(sort==='arrival'?end(a)-end(b):stamp(a)-stamp(b))||0);
}
export function flightChanges(previous,current){
 if(!previous)return [];
 const changes=[];
 for(const [key,label]of [['gate_origin','Gate'],['terminal_origin','Terminal']])if(previous[key]&&current[key]&&String(previous[key])!==String(current[key]))changes.push(`${label} ${previous[key]} → ${current[key]}`);
 for(const [key,label]of [['estimated_out','Departure'],['estimated_in','Arrival']]){const before=Date.parse(previous[key]||previous[key==='estimated_out'?'scheduled_out':'scheduled_in']),after=Date.parse(current[key]||current[key==='estimated_out'?'scheduled_out':'scheduled_in']),minutes=Math.round((after-before)/60000);if(Number.isFinite(minutes)&&Math.abs(minutes)>=5)changes.push(`${label} ${Math.abs(minutes)} min ${minutes>0?'later':'earlier'}`);}
 if(current.cancelled&&!previous.cancelled)changes.push('Flight cancelled');
 return changes;
}
