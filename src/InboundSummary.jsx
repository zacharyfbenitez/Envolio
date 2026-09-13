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
  <small>{cached?'Saved update':'Flight checked'}: {time(refreshed)}{info.map?` · Position reported: ${time(position.timestamp)}`:''}</small>
  {rotation&&<details className="earlier-rotation"><summary>Earlier flights of this plane ({rotation.legs?.length||0} verified)</summary>{[...(rotation.legs||[])].reverse().map(leg=><p key={leg.fa_flight_id}><b>{leg.ident_iata||leg.ident} · {code(leg.origin)} → {code(leg.destination)}</b><br/>{leg.status||'Status not published'} · Gate arrival {time(leg.actual_in||leg.estimated_in||leg.scheduled_in,leg.destination?.timezone)} ({leg.actual_in?'actual':leg.estimated_in?'estimated':'scheduled'})</p>)}{rotation.warnings?.map((warning,i)=><p key={i}>{warning}</p>)}<p className="inbound-note">We follow up to three provider-linked flights with a matching aircraft registration. A leg already under way, unknown assignments or aircraft swaps stop the look-back.</p></details>}
 </section>;
}
