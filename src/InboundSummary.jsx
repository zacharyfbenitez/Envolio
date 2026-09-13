import React from 'react';
import {Plane,MapPin} from 'lucide-react';
import {inboundOverview} from './traveler-presentation.js';
const code=a=>a?.code_iata||a?.code_icao||a?.code||'Airport not reported';
const time=(value,zone)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone||'UTC',timeZoneName:'short'}):'Not reported';
export default function InboundSummary({flight,position,current,refreshed,cached,rotation}){
 if(current.cancelled||/cancel/i.test(current.status||''))return null;
 const info=inboundOverview(flight,current,position,cached);
 return <section className={`inbound-summary ${info.tone}`} aria-labelledby="inbound-heading">
  <header><Plane size={23}/><div><span className="traveler-kicker">Your incoming plane</span><h3 id="inbound-heading">{info.title}</h3></div></header>
  <p>{info.advice}</p>
  {flight&&<><div className="inbound-route"><strong>{code(flight.origin)} → {code(flight.destination)}</strong><span>Previous flight · {flight.ident_iata||flight.ident||'Number not reported'}</span></div>
   <dl><div><dt>{info.arrived?'At your airport’s gate':info.estimated?'Expected at your airport’s gate':'Scheduled at your airport’s gate'}</dt><dd>{time(info.arrival,current.origin?.timezone)}</dd></div><div><dt>Time before your scheduled departure</dt><dd>{info.turnMinutes===null?'Not enough timing information':info.turnMinutes<0?`${Math.abs(info.turnMinutes)} minutes after your scheduled departure`:`${info.turnMinutes} minutes`}</dd></div></dl>
   <p className="inbound-note">The plane still needs time to unload, prepare and board. Gate arrival does not mean boarding has started. Aircraft assignments can change.</p>
  </>}
  {info.map&&<a className="inbound-map-link" href={`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=6/${position.latitude}/${position.longitude}`} target="_blank" rel="noopener noreferrer"><MapPin size={17}/>View last reported plane location ↗</a>}
  {position&&!info.map&&<p className="inbound-note">A recent, verified position is unavailable. We’re not showing an old location as live.</p>}
  <small>{cached?'Saved update':'Flight checked'}: {time(refreshed,current.origin?.timezone)}{info.map?` · Position reported: ${time(position.timestamp,current.origin?.timezone)}`:''}</small>
  {!!rotation?.legs?.length&&<ol className="aircraft-chain" aria-label="Your plane’s journey">{[...rotation.legs].reverse().map(leg=><li key={leg.fa_flight_id} className={leg.cancelled?'disrupted':leg.actual_in?'arrived':''}><Plane size={18}/><strong>{code(leg.origin)} → {code(leg.destination)}</strong><span>{leg.ident_iata||leg.ident}</span><b>{leg.cancelled?'Cancelled — assignment may change':leg.actual_in?'Arrived':leg.actual_out?'On the way':leg.status||'Scheduled'}</b><small>Gate arrival: {time(leg.actual_in||leg.estimated_in||leg.scheduled_in,leg.destination?.timezone)}</small></li>)}<li className="your-flight"><Plane size={18}/><strong>Your flight</strong><span>{code(current.origin)} → {code(current.destination)}</span><small>Aircraft assignment can change</small></li></ol>}
  {rotation&&<details className="earlier-rotation"><summary>About your plane’s journey</summary>{rotation.warnings?.map((warning,i)=><p key={i}>{warning}</p>)}<p className="inbound-note">We check up to three linked flights of the same plane. Missing aircraft details or a change of plane can limit this view.</p></details>}
 </section>;
}
