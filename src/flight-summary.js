import {airportCode} from './journeys.js';
export function travelerAirport(a){
 const names={HND:'Tokyo–Haneda',NRT:'Tokyo–Narita',JFK:'New York–JFK',LGA:'New York–LaGuardia',EWR:'Newark',LHR:'London–Heathrow',LGW:'London–Gatwick',CDG:'Paris–Charles de Gaulle',ORY:'Paris–Orly'};
 return names[airportCode(a)]||a?.city||a?.name||'Airport not reported';
}
function localDay(stamp,zone){
 if(!Number.isFinite(Date.parse(stamp)))return null;
 try{const p=new Intl.DateTimeFormat('en-US',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp)),get=k=>p.find(v=>v.type===k)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}catch{return null;}
}
export function arrivalDay(departure,arrival,originZone,destinationZone){
 const from=localDay(departure,originZone),to=localDay(arrival,destinationZone);if(!to)return '';
 const diff=from?Math.round((Date.parse(to)-Date.parse(from))/86400000):0;
 const label=new Date(`${to}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
 return `${label}${diff?` · ${diff>0?'+':''}${diff} ${Math.abs(diff)===1?'day':'days'}`:''}`;
}
