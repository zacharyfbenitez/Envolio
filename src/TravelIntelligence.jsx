import React, { useEffect, useState, useRef } from 'react';
import { Cloud, ShieldCheck, RefreshCw, ArrowRight } from 'lucide-react';
import './intelligence.css';
import {DecisionPanels} from './DecisionPanels.jsx';
import './clarity.css';

const labels = { gate_origin:'Departure gate',terminal_origin:'Departure terminal',gate_destination:'Arrival gate',terminal_destination:'Arrival terminal',baggage_claim:'Baggage belt' };
const when = value => value ? new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Time not supplied';
const availability = status => ({not_configured:'Not connected',plan_restricted:'Not included in the connected plan',rate_limited:'Provider is busy',budget_limited:'Refresh budget reached',outside_window:'Not available for this flight time',not_found:'No data published',stale:'Saved data — not used as current evidence'}[status] || 'Temporarily unavailable');

export default function TravelIntelligence({ ident, date, origin, destination, departure, refreshed, cached, onRefresh }) {
  const [state,setState] = useState({loading:true}),[attempt,setAttempt] = useState(0);
  const [extra,setExtra] = useState(null);
  const extraGeneration=useRef(0);
  const refreshRef=useRef(onRefresh);refreshRef.current=onRefresh;
  useEffect(()=>{
    if(cached)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshRef.current?.()},300000);
    return()=>clearInterval(timer);
  },[cached,ident,date,origin,destination]);
  const query = new URLSearchParams({date:date || '',origin:origin || '',destination:destination || '',...(departure?{departure}:{})}).toString();
  const url = `${import.meta.env.BASE_URL}api/flights/${encodeURIComponent(ident)}`;
  useEffect(()=>{
    const controller = new AbortController();
    extraGeneration.current++;
    setExtra(null);
    if(cached){setState({error:'Showing your saved flight. Refresh the flight to check additional sources.'});return()=>controller.abort();}
    setState({loading:true});
    fetch(`${url}/intelligence?${query}`,{signal:controller.signal}).then(async r=>{
      const data=await r.json();if(!r.ok)throw new Error(data.error || 'Additional sources are unavailable.');
      if(!controller.signal.aborted)setState({data});
    }).catch(error=>{if(error.name!=='AbortError')setState({error:'Additional sources are temporarily unavailable. Your flight details are still available.'})});
    return()=>{controller.abort();extraGeneration.current++;};
  },[url,query,refreshed,attempt,cached]);
  const load = async product => {
    const generation=++extraGeneration.current;
    setExtra({product,loading:true});
    try { const r=await fetch(`${url}/explore?${query}&product=${product}`);const data=await r.json();
      if(generation===extraGeneration.current)setExtra({product,...(r.ok?data:{error:data.error})});
    }catch{if(generation===extraGeneration.current)setExtra({product,error:'This information could not be loaded. Please try again.'})}
  };
  const data=state.data, comparison=data?.comparison;
  useEffect(()=>{
    if(!data||matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('clarity-enter');observer.unobserve(entry.target);}}),{threshold:.08});
    document.querySelectorAll('.trip-timeline,.backup-watch,.traveler-decision,.decision-grid>article,.playbook-grid>article').forEach(el=>observer.observe(el));
    return()=>observer.disconnect();
  },[data]);
  return <section className="travel-intelligence" aria-labelledby="travel-intelligence-title">
    <header><div><span className="traveler-kicker">A clearer picture</span><h3 id="travel-intelligence-title">Before you travel</h3></div><button aria-label="Refresh additional travel information" onClick={()=>setAttempt(v=>v+1)} disabled={state.loading}><RefreshCw size={17}/></button></header>
    {state.loading && <p role="status">Checking weather, airport notices, and a second flight source…</p>}
    {state.error && <p role="status">{state.error}</p>}
    {data && <>
      <details className="source-check-details" open={comparison?.conflicts?.length?true:undefined}><summary>{comparison?.conflicts?.length?'Sources disagree — check with your airline':'Check the flight’s data sources'}</summary><div className={`provider-check ${comparison?.conflicts?.length?'has-conflict':''}`}>
        <ShieldCheck size={21}/><div><strong>{comparison?.status==='matched' ? comparison.conflicts.length ? 'Sources differ — confirm with your airline' : 'Flight identity cross-checked' : 'FlightAware is your flight source'}</strong>
        <p>{comparison?.status==='matched'?'Skylink matched the route, local date, and scheduled departure. This is an identity check, not a guarantee of on-time travel.':comparison?.reason}</p></div>
      </div></details>
      {!!comparison?.conflicts?.length && <ul className="source-conflicts">{comparison.conflicts.map(c=><li key={c.field}><strong>{labels[c.field]}</strong><span>FlightAware: {c.flightaware} · Skylink: {c.skylink}</span></li>)}</ul>}
      {!!Object.keys(comparison?.fields || {}).length && <div className="verified-fields">{Object.entries(comparison.fields).map(([key,value])=><div key={key}><span>{labels[key]}</span><strong>{value}</strong><small>Additional detail via Skylink</small></div>)}</div>}
      <DecisionPanels data={data} url={url} query={query} date={date} onRefresh={onRefresh}/>
      <details className="weather-details"><summary>Weather &amp; published airport notices</summary><div className="airport-outlooks">{data.airports?.map(a=><article key={a.side}>
        <span className="traveler-kicker">{a.side==='origin'?'Departure':'Arrival'} · {a.airport || 'Airport'}</span>
        <h4><Cloud size={19}/> Weather at flight time</h4>
        <p>{a.forecast?.summary || 'Airport information unavailable.'}</p>
        {a.forecast?.raw && <details><summary>Read the published forecast</summary><p>{a.forecast.raw}</p><small>Raw TAF via Skylink. A decoded summary is withheld when its time periods cannot be verified.</small></details>}
        {a.forecast?.modifiers?.map((m,i)=><p className="forecast-caveat" key={i}>{m.weather_probability?`${m.weather_probability}% weather chance`:m.type==='BECMG'?'Conditions changing':'Temporary conditions'}: {m.summary}</p>)}
        {a.forecast?.status==='available' && <small>TAF via Skylink · valid until {when(a.forecast.valid_until)}. Weather odds are not delay odds.</small>}
        {a.weather && <details><summary>Latest observation</summary><p>{a.weather.observations[0].conditions || a.weather.observations[0].cloud_friendly || 'Weather report available'} · {a.weather.observations[0].wind_speed ?? 'Unknown'} kt wind</p><small>METAR via Skylink · observed {when(a.weather.observations[0].time)}</small></details>}
        {a.notices?.map(n=><div className="airport-notice" key={n.id}><strong>{n.title}</strong><p>{n.note}</p><details><summary>Read published notice</summary><p>{n.detail}</p><small>{n.id} · {n.source}</small></details></div>)}
      </article>)}</div></details>
      <details className="intelligence-receipts"><summary>Sources &amp; what these checks mean</summary><p>{data.policy}</p>
        {[comparison?.receipt,...(data.extra_receipts||[]),...(data.airports || []).flatMap(a=>a.receipts || [])].filter(Boolean).map((r,i)=><div key={i}><code>{r.endpoint}</code><span>{r.status==='available'?`${r.cached?'Cached · ':''}fetched ${when(r.retrieved_at)}`:availability(r.status)}</span></div>)}
      </details>
      <details className="travel-explore"><summary>More for your journey</summary><p>Load extra information only when you need it.</p><div className="explore-actions">{[['tickets','Other itinerary options'],['duration','Typical flight duration'],['airport','Departure airport'],['routes','Routes from this airport']].map(([key,title])=><button key={key} onClick={()=>load(key)} disabled={extra?.loading}>{title}<ArrowRight size={15}/></button>)}</div>
        {extra?.loading && <p role="status">Loading travel information…</p>}
        {extra?.error && <p role="alert">{extra.error}</p>}
        {extra && !extra.loading && !extra.error && <div className="explore-result"><p>{extra.note}</p>
          {extra.product==='routes' && extra.status==='available' && <div>{(extra.data?.routes || []).slice(0,6).map((r,i)=><article key={i}><strong>{r.departure} → {r.arrival}</strong><p>{(r.airlines || []).join(' · ')}</p></article>)}</div>}
          {extra.status!=='available'?<p>{availability(extra.status)}</p>:extra.product==='tickets'?<>{!(extra.data?.flights || []).length && <p>No itinerary options returned. This does not mean your flight is cancelled or sold out.</p>}{(extra.data?.flights || []).slice(0,4).map((f,i)=><article key={i}><strong>{(f.legs || []).map(l=>l.flight_number).join(' → ')}</strong><p>{f.stops===0?'Nonstop':`${f.stops} stop(s)`} · {f.total_duration_min} min · {Number.isFinite(f.price_usd)?`Indicative $${f.price_usd.toFixed(0)} USD`:'Price unavailable'}</p></article>)}</>:extra.product==='duration'?<p><strong>{extra.data?.estimated_hours_display || 'Duration unavailable'}</strong> · typical route estimate, not your live arrival time</p>:extra.product==='airport'?<p><strong>{extra.data?.name || 'Airport information'}</strong><br/>{extra.data?.municipality || ''}</p>:<p>Route data returned. It describes airport connectivity, not confirmed service on your travel date.</p>}
        </div>}
      </details>
    </>}
  </section>;
}
