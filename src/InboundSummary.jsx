
import React from 'react';
import {Plane,MapPin} from 'lucide-react';
import {inboundOverview,inboundArrivalStatus} from './traveler-presentation.js';
import {travelerFlightLabel,flightOptionStatus} from './flight-option.js';
const code=a=>a?.code_iata||a?.code_icao||a?.code||'Airport not reported';
const time=(value,zone)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone||'UTC',timeZoneName:'short'}):'Not reported';
export default function InboundSummary({flight,position,current,refreshed,cached,rotation}){
 if(current.cancelled||/cancel/i.test(current.status||''))return null;
 const info=inboundOverview(flight,current,position,cached);
 const arrivalStatus=inboundArrivalStatus(flight,{cached,refreshed});
 const legs=[...(rotation?.legs||[])];
 if(flight&&!legs.some(leg=>leg===flight||(leg.fa_flight_id&&leg.fa_flight_id===flight.fa_flight_id)))legs.unshift(flight);
 const recent=legs.slice(0,3).reverse();
 return <section className={`inbound-summary ${info.tone}`} aria-labelledby="inbound-heading">
  <header><Plane size={23}/><div><span className="traveler-kicker">Your incoming plane</span><h3 id="inbound-heading">{info.title}</h3></div></header>
  {flight?.origin&&<p className="inbound-origin"><MapPin size={16} aria-hidden="true"/><span>From <strong>{flight.origin.city||flight.origin.name||flight.origin.code_iata||'an unreported airport'}</strong>{flight.origin.code_iata&&(flight.origin.city||flight.origin.name)&&<span className="inbound-origin-code"> · {flight.origin.code_iata}</span>}</span></p>}
  {flight?<dl><div><dt>{info.arrived?'At your airport’s gate':info.estimated?'Expected gate arrival':'Scheduled gate arrival'}</dt><dd>{time(info.arrival,current.origin?.timezone)}<span className={`inbound-arrival-status ${arrivalStatus.tone}`}>{arrivalStatus.label}</span></dd></div><div><dt>Time between flights</dt><dd>{info.turnMinutes===null?'Timing not confirmed':info.turnMinutes<0?`${Math.abs(info.turnMinutes)} minutes after your scheduled departure`:`${info.turnMinutes} min`}</dd></div></dl>:<p>We’ll show your plane here once its previous flight is confirmed.</p>}
  {info.map&&<figure className="inbound-mini-map"><iframe title="Incoming plane’s last reported location" loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.max(-180,position.longitude-3)},${Math.max(-85,position.latitude-2)},${Math.min(180,position.longitude+3)},${Math.min(85,position.latitude+2)}&layer=mapnik&marker=${position.latitude},${position.longitude}`}/><figcaption>Reported position · {time(position.timestamp,current.origin?.timezone)} · Map © OpenStreetMap contributors</figcaption></figure>}
  <details className="inbound-details"><summary>Track plane &amp; details</summary>
  <dl className="inbound-aircraft-facts"><div><dt>Tail number</dt><dd>{flight?.registration||current.registration||'Not confirmed'}</dd></div><div><dt>Aircraft</dt><dd>{flight?.aircraft_type_friendly||current.aircraft_type_friendly||flight?.aircraft_type||current.aircraft_type||'Not confirmed'}</dd></div></dl>
  {flight?.scheduled_in&&<p className="inbound-note">Originally due at your gate: {time(flight.scheduled_in,current.origin?.timezone)}.</p>}
  {recent.length>0&&<><h4 className="inbound-history-heading">Your plane’s recent flights</h4><ol className="inbound-flight-list">{recent.map((leg,i)=>{const status=flightOptionStatus(leg);return <li key={leg.fa_flight_id||i}><div className="inbound-leg-title"><strong>{code(leg.origin)} → {code(leg.destination)}</strong><span>{travelerFlightLabel(leg)}</span></div><span className={`inbound-leg-status ${status.tone}`}>{status.label.replace(' · live status not checked','')}</span><small>{leg.actual_in?'Reached gate':leg.estimated_in?'Expected at gate':'Scheduled at gate'} · {time(leg.actual_in||leg.estimated_in||leg.scheduled_in,leg.destination?.timezone)}</small></li>;})}</ol>{recent.length<3&&<p className="inbound-note">{recent.length===1?'Only the incoming flight is available.':'Only two linked flights are available.'}</p>}</>}
  {info.map&&<a className="inbound-map-link" href={`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=6/${position.latitude}/${position.longitude}`} target="_blank" rel="noopener noreferrer"><MapPin size={17}/>View last reported plane location ↗</a>}
  {!info.map&&<p className="inbound-note">Live plane location isn’t available.</p>}
  <p className="inbound-note">Gate arrival isn’t boarding—the plane needs time to unload and prepare. Aircraft can change.</p>
  <p className="inbound-note">{cached?'Saved update':'Updated'}: {time(refreshed,current.origin?.timezone)}{info.map?` · Location checked: ${time(position.timestamp,current.origin?.timezone)}`:''}</p>
  {!!rotation?.warnings?.length&&<details className="earlier-rotation"><summary>Tracking limitations</summary>{rotation.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</details>}
  </details>
 </section>;
}
