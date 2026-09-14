import React from 'react';
import {travelerAirport,arrivalDay} from './flight-summary.js';
import {ArrowRight,X} from 'lucide-react';
import CarrierLogo from './CarrierLogo.jsx';
import {airlines} from './flight-search.js';
import {airportCode,journeyUrl,readJourneys,RECENT_KEY} from './journeys.js';
import {flightOptionStatus} from './flight-option.js';
const clock=(t,z)=>{try{return t?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',timeZone:z||'UTC'}):'—';}catch{return '—';}};
export default function SavedFlightCard({item,go,remove,base}){
 const recent=readJourneys(RECENT_KEY).find(r=>r.ident===item.ident&&r.date===item.date&&airportCode(r.origin)===airportCode(item.origin)&&airportCode(r.destination)===airportCode(item.destination));
 const snapshot=recent?.snapshot&&(!item.snapshot||Date.parse(recent.snapshot.checked_at)>Date.parse(item.snapshot.checked_at))?recent.snapshot:item.snapshot;
 const carrier=item.ident.match(/^([A-Z0-9]{2})(?=\d)/)?.[1]||'';
 const airline=airlines.find(a=>a.code===carrier)?.name||(carrier==='PD'?'Porter Airlines':item.operator||'Airline');
 const checked=Date.parse(snapshot?.checked_at);
 const status=snapshot?flightOptionStatus(snapshot,checked):null;
 const departure=snapshot?.actual_out||snapshot?.estimated_out||snapshot?.scheduled_out,arrival=snapshot?.actual_in||snapshot?.estimated_in||snapshot?.scheduled_in;
 return <article className="saved-card journey-card">
  <button className="saved-main journey-main" onClick={()=>go(journeyUrl(item,base))} aria-label={`Open ${item.ident}, ${airportCode(item.origin)} to ${airportCode(item.destination)}`}>
   <span className="journey-carrier"><CarrierLogo flight={{ident_iata:item.ident,operator_iata:carrier,operator:airline}}/><span><strong>{item.ident}</strong><span>{airline}</span></span></span>
   <time className="journey-date" dateTime={item.date}>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</time>
   <span className="journey-route"><span><strong>{airportCode(item.origin)||'—'}</strong><span>{travelerAirport(item.origin)}</span>{departure&&<b>{clock(departure,item.origin?.timezone)}</b>}</span><ArrowRight size={22}/><span><strong>{airportCode(item.destination)||'—'}</strong><span>{travelerAirport(item.destination)}</span>{arrival&&<><b>{clock(arrival,item.destination?.timezone)}</b><span>{arrivalDay(departure,arrival,item.origin?.timezone,item.destination?.timezone)}</span></>}</span></span>
   <span className="journey-status-row"><span className={`journey-status ${status?.tone||'scheduled'}`}>{status?`Last seen: ${status.label.replace(' · open for updates','')}`:'Open for latest status'}</span>{snapshot?.gate_origin&&<span>Gate {snapshot.gate_origin}</span>}</span>
   <span className="journey-footer"><span>{snapshot?.checked_at?`Saved update · ${new Date(snapshot.checked_at).toLocaleDateString([],{month:'short',day:'numeric'})} ${clock(snapshot.checked_at) } UTC`:'Saved on this device'}{departure?' · Flight times local':''}</span><span>View flight <ArrowRight size={15}/></span></span>
  </button>
  <button className="saved-watch-settings" onClick={()=>go(`${journeyUrl(item,base)}&alerts=1`)}>Notification settings</button>
  <button className="remove-save" onClick={()=>remove(item.key)} aria-label={`Remove ${item.ident}`}><X size={18}/></button>
 </article>;
}
