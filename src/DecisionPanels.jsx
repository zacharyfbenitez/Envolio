import React,{useState,useEffect,useRef} from 'react';
import TripStrategy from './TripStrategy.jsx';

const evidenceLabels={agreement:'Sources agree',single_source:'One source',conflict:'Needs traveler confirmation',stale:'Stale information',unavailable:'Not available'};
const signed=n=>Number.isFinite(n)?`${n>0?'+':''}${n} min`:'Not reported';
const stamp=t=>t?new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'Not reported';

export function DecisionPanels({data,url,query,date,onRefresh}) {
  const [connection,setConnection]=useState(null);
  useEffect(()=>setConnection(null),[url,query,data.checked_at]);
  const b=data.brief;
  if(!b)return null;
  const a=b.aircraft,h=b.history;
  return <div className="decision-panels">
    <div className={`traveler-decision ${b.fields.some(f=>f.needs_traveler_confirmation)?'verify':''}`} role="status"><span className="traveler-kicker">What this means for you</span><h4>{b.traveler_action.title}</h4><p>{b.traveler_action.detail}</p></div>
    <TripStrategy data={data} url={url} query={query} onRefresh={onRefresh} connection={connection}/>
    <details className="field-evidence"><summary>Do the flight updates agree?</summary><p>These scores describe available evidence—not the percentage chance a detail is correct. Providers may share upstream data.</p><div className="field-grid">{b.fields.map(f=><article key={f.field} className={f.state}><header><strong>{f.label}</strong><b>{f.score}/100</b></header><span>{evidenceLabels[f.state]}</span><p>FlightAware: {f.flightaware ?? 'Not available'}<br/>Skylink: {f.skylink ?? 'Not comparable'}</p><p>{f.explanation}</p></article>)}</div><small>{b.fields[0]?.method}</small></details>
    <details className="aircraft-history"><summary>Your aircraft &amp; recent flight history</summary><div className="decision-grid">
      <article><span className="traveler-kicker">Your aircraft</span><h4>{a.assigned_inbound?'Where is my plane coming from?':'Aircraft assignment'}</h4><strong>{a.registration || 'Tail not published'}{a.assigned_inbound?` · ${a.ident}`:''}</strong><p>{a.advice}</p>
        {a.assigned_inbound && <dl><div><dt>Previous flight’s status</dt><dd>{a.status || 'Not reported'}</dd></div><div><dt>When your plane reaches your airport</dt><dd>{stamp(a.arrival_at)}</dd></div><div><dt>Time before your flight leaves</dt><dd>{Number.isFinite(a.turnaround_minutes)?`${a.turnaround_minutes} min before scheduled departure`:'Not enough timing data'}</dd></div><div><dt>Previous flight’s departure</dt><dd>{signed(a.previous_departure_delay)} · {a.previous_departure_basis}</dd></div><div><dt>Previous flight’s arrival</dt><dd>{signed(a.previous_arrival_delay)} · {a.previous_arrival_basis}</dd></div></dl>}
        {a.position && <div className="tail-position"><strong>Latest tail position</strong><p>{a.position.latitude.toFixed(2)}°, {a.position.longitude.toFixed(2)}° · {a.position.altitude_ft ?? 'Unknown'} ft · {a.position.ground_speed_kt ?? 'Unknown'} kt</p><a href={`https://www.openstreetmap.org/?mlat=${a.position.latitude}&mlon=${a.position.longitude}#map=6/${a.position.latitude}/${a.position.longitude}`} target="_blank" rel="noopener noreferrer">View reported position on map ↗</a><p><small>Skylink ADS-B · observed {stamp(a.position.observed_at)}{!a.position.flight_link_verified?' · Tail located; flight callsign not confirmed':''}</small></p></div>}
        <small>{a.note}</small>
      </article>
      <article><span className="traveler-kicker">Route disruption outlook</span><h4>{b.route_risk.label}</h4><p>{b.route_risk.method}</p><dl><div><dt>Typical departure difference</dt><dd>{signed(h.departure.median_minutes)}</dd></div><div><dt>Typical arrival difference</dt><dd>{signed(h.arrival.median_minutes)}</dd></div><div><dt>Arrival delay on slower days</dt><dd>{signed(h.arrival.p90_minutes)}</dd></div></dl><small>{h.departure.samples} actual departures · {h.arrival.samples} actual arrivals. 9 out of 10 sampled arrivals were at or below this value. Your flight may be different.</small>
        <details><summary>Recent actual flight times</summary><p>{h.note}</p>{h.rows.length?<div className="actual-history">{h.rows.map((r,i)=><div key={i}><time>{new Date(r.date).toLocaleDateString([],{month:'short',day:'numeric',timeZone:'UTC'})} UTC</time><span>Departure {signed(r.departure)}</span><span>Arrival {signed(r.arrival)}</span></div>)}</div>:<p>No comparable actual outcomes available.</p>}</details>
      </article>
    </div></details>
    {!data.strategy&&<details className="operating-details"><summary>Why disruption may happen</summary><p>Confirmed reasons are stated by the flight source. Other items are possible contributors—not a diagnosis.</p>{b.reasons.length?b.reasons.map((r,i)=><article key={i}><span className="traveler-kicker">{r.classification==='confirmed'?'Published reason':r.classification==='likely'?'Likely contributor':'Possible contributor'}</span><h4>{r.title}</h4><p>{r.detail}</p><small>{r.source}</small></article>):<p>No supported flight-specific explanation is available yet.</p>}</details>}
    <details className="operating-details"><summary>Airport problems &amp; terminal updates</summary><div className="decision-grid">{b.operations.map(o=><article key={o.side}><span className="traveler-kicker">{o.side==='origin'?'Departure':'Arrival'}</span><h4>{o.airport}</h4>{o.items.length?o.items.map((i,n)=><div className="operations-item" key={n}><strong>{i.title}</strong><p>{i.detail}</p><small>{i.source} · fetched {stamp(i.observed_at)}</small></div>):<p>No applicable advisory verified from the returned data.</p>}<p>{o.terminal_status}</p><small>{o.note}</small></article>)}</div></details>
    <ConnectionProtection url={url} query={query} date={date} airport={b.operations.find(o=>o.side==='destination')?.airport} onChecked={setConnection}/>
    <LicensedFeatures permissions={data.permissions} historical={data.historical} url={url} query={query}/>
  </div>;
}

function ConnectionProtection({url,query,date,airport,onChecked}) {
  const [ident,setIdent]=useState(''),[nextDate,setNextDate]=useState(date||''),[buffer,setBuffer]=useState(60),[state,setState]=useState({}),generation=useRef(0);
  useEffect(()=>{generation.current++;setState({});setIdent('');setNextDate(date||'');return()=>{generation.current++;}},[url,query,date]);
  const edit=(setter,value)=>{generation.current++;setState({});onChecked(null);setter(value)};
  const check=async(e,alternates=false)=>{
    e?.preventDefault();const current=++generation.current;setState(s=>({...s,loading:true,error:null}));
    const normalized=ident.replace(/\s/g,'').toUpperCase();
    if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(normalized)){setState({error:'Enter your onward flight number, such as BA117.'});return;}
    try{
      if(!alternates){const r=await fetch(`${import.meta.env.BASE_URL}api/flights/${normalized}?${new URLSearchParams({date:nextDate,origin:airport})}`);const d=await r.json();if(!r.ok)throw new Error(d.error||'Your onward flight could not be found.');}
      const r=await fetch(`${url}/connection?${query}&${new URLSearchParams({next_ident:normalized,next_date:nextDate,buffer:String(buffer),alternates:String(alternates)})}`);const data=await r.json();if(!r.ok)throw new Error(data.error||'Connection check unavailable.');
      if(current===generation.current){setState({data});onChecked(data);}
    }catch(error){if(current===generation.current)setState({error:error.message})}
  };
  return <details className="connection-protection"><summary>Will I have time for my next flight?</summary><p>Taking another flight after landing at {airport}? Enter it below to check how much time you have to change planes.</p><form onSubmit={check}><label>Your next flight number<input value={ident} onChange={e=>edit(setIdent,e.target.value)} placeholder="e.g. BA117" required maxLength={10}/></label><label>Departure date at {airport}<input type="date" value={nextDate} onChange={e=>edit(setNextDate,e.target.value)} required/></label><label>Time you need between flights (minutes)<input type="number" min="20" max="360" value={buffer} onChange={e=>edit(setBuffer,e.target.value)} required/></label><button disabled={state.loading}>Check connection</button></form><small>The box starts at 60 minutes. You may need longer to walk to another gate, pass through security or passport checks, or collect and check in bags again. Ask your airline how much time you need.</small>
    {state.loading&&<p role="status">Checking your onward flight…</p>}{state.error&&<p role="alert">{state.error}</p>}{state.data&&<div className={`connection-result ${state.data.status}`}><h4>{state.data.status==='at_risk'?'Connection at risk':state.data.status==='tight'?'Your connection looks tight':state.data.status==='unavailable'?'More information needed':'Your connection check'}</h4><p>{state.data.recommendation}</p>{Number.isFinite(state.data.remaining_minutes)&&<p><strong>{state.data.remaining_minutes} min</strong> between arrival and departure · your allowance: {state.data.buffer_minutes} min</p>}<small>{state.data.note}</small>
      {state.data.survival&&<div className="connection-survival"><strong>{state.data.survival.score===null?'We can’t tell yet':state.data.survival.score<50?'Time looks tight':'There is some extra time'}</strong><h4>Time for your next flight</h4><p>{state.data.survival.gate_context}</p><p>{state.data.survival.advice}</p>{state.data.survival.history&&<p>{state.data.survival.history.within_allowance} of {state.data.survival.history.samples} recent actual arrivals would fit this scheduled connection allowance. This is historical context, not your chance of making it.</p>}<details><summary>How this is checked &amp; what’s missing</summary><p>{state.data.survival.method}</p><p>{state.data.survival.missing.join(' · ')}</p></details></div>}
      {['at_risk','tight'].includes(state.data.status)&&<button type="button" disabled={state.loading} onClick={e=>check(e,true)}>Find possible alternatives</button>}
      {state.data.alternatives&&<div><p>{state.data.alternatives.note}</p>{state.data.alternatives.flights.length?state.data.alternatives.flights.map((f,i)=><article key={i}><strong>{(f.legs||[]).map(l=>l.flight_number).join(' → ')}</strong><p>{f.total_duration_min} min · {f.stops} stop(s){Number.isFinite(f.price_usd)?` · indicative $${f.price_usd} USD`:''}</p></article>):<p>No alternative itinerary was returned. Ask your airline about rebooking.</p>}</div>}
    </div>}
  </details>;
}

function LicensedFeatures({permissions,historical,url,query}) {
  const [email,setEmail]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),generation=useRef(0);
  useEffect(()=>{generation.current++;setMessage('');setBusy(false);return()=>{generation.current++;}},[url,query]);
  const active=permissions?.alerts?.enabled;
  async function subscribe(e){e.preventDefault();const current=++generation.current;setBusy(true);try{const r=await fetch(`${url}/watch?${query}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(current===generation.current)setMessage(r.ok&&d.active?'Your background flight alerts are active.':d.error||'Alerts could not be activated.');}catch{if(current===generation.current)setMessage('Alerts could not be activated.')}finally{if(current===generation.current)setBusy(false)}}
  return <details className="licensed-features"><summary>Live alerts &amp; historical validation</summary><h4>Background delay and gate alerts</h4><p>{permissions?.alerts?.reason || 'Provider permissions have not been verified.'}</p>{active?<form onSubmit={subscribe}><label>Email for this flight<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>Enable flight alerts</button></form>:<button disabled>Awaiting licensing &amp; capacity confirmation</button>}{message&&<p role="status">{message}</p>}
    <h4>Skylink historical model evaluation</h4><p>{historical?.enabled?`${historical.accepted||0} eligible historical actual departures. Evaluation stays separate from live predictions.`:permissions?.history?.reason}</p>{historical?.enabled&&<p>{historical.status==='evaluated'?`Historical baseline forecast error: ${Number.isFinite(historical.brier)?Math.round(historical.brier*100)+'/100 (lower is better)':'not enough outcomes'}. No model has been promoted to live use.`:'A reviewed outcome dataset is not yet available for this route.'}</p>}
  </details>;
}
