import React,{useEffect,useRef,useState} from 'react';
import {Search,ArrowRight,ArrowLeft,CalendarDays,Plane,LoaderCircle} from 'lucide-react';
import {airlines,airportSuggestions,parseSearch,resolveAirport,validDate,putSearchResult,searchKey} from './flight-search.js';
import {readJourneys,RECENT_KEY,airportCode} from './journeys.js';
import './flight-search.css';
import CarrierLogo from './CarrierLogo.jsx';
import {flightOptionIdentity,flightOptionStatus,travelerFlightLabel} from './flight-option.js';
const localDay=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const code=a=>a?.code_iata||a?.code?.replace(/^K(?=[A-Z]{3}$)/,'')||a?.code_icao||'';
const time=(stamp,zone)=>{if(!stamp)return 'Time not published';try{return new Date(stamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:zone||'UTC'})+(zone?'':' UTC');}catch{return 'Time not published';}};
function AirportField({label,value,onChange,id}){
 const options=value.includes(',')?value.split(','):resolveAirport(value),suggestions=airportSuggestions.filter(item=>item.name.toLowerCase().includes(value.toLowerCase())).slice(0,6);
 return <div className="finder-airport"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={e=>onChange(e.target.value)} placeholder="City or airport code" autoComplete="off" list={`${id}-options`}/><datalist id={`${id}-options`}>{suggestions.map(item=><option key={item.name} value={item.name}/>)}</datalist>{options.length>1&&<div className="airport-clarify"><span>Which airport?</span>{options.map(option=><button type="button" key={option} onClick={()=>onChange(option)}>{option}</button>)}</div>}{value&&options.length===0&&<small>Try a city name or a three-letter airport code.</small>}</div>;
}
function FlightOption({flight,fallback,preferred,onSelect}){
 const identity=flightOptionIdentity(flight,preferred),status=flightOptionStatus(flight);
 const uncertain=travelerFlightLabel(flight)==='Flight number not confirmed';
 const airline=airlines.find(a=>a.code===identity.carrier)?.name||(uncertain?'Airline number not confirmed':flight.operator||'Airline not reported');
 return <button className={`finder-match status-${status.tone}`} onClick={()=>onSelect(identity.display||fallback)}>
  <span className="finder-carrier"><CarrierLogo flight={{operator_iata:uncertain?'':identity.carrier.length===2?identity.carrier:'',ident_iata:uncertain?'':identity.display,operator:airline}}/><span><b>{uncertain?'Flight option':identity.display||fallback}</b><small>{airline}</small></span></span>
  <span className="finder-route"><b>{code(flight.origin)} → {code(flight.destination)}</b><small>{time(flight.actual_out||flight.estimated_out||flight.scheduled_out,flight.origin?.timezone)} {flight.actual_out?'departed':flight.estimated_out?'departure · estimated':'departure'}</small><span className="finder-status">{status.label}</span>{identity.alternates.length>0&&<small>Also listed as {identity.alternates.slice(0,3).join(' / ')}</small>}</span><ArrowRight size={18}/>
 </button>;
}
export default function FlightSearch({go}){
 const initial=new URLSearchParams(location.search),initialDate=initial.get('date');
 const [q,setQ]=useState(()=>initial.get('q')||''),[date,setDate]=useState(()=>validDate(initialDate)?initialDate:localDay()),[dateOverride,setDateOverride]=useState(()=>validDate(initialDate)),[mode,setMode]=useState('flight'),[from,setFrom]=useState(()=>initial.get('origin')||null),[to,setTo]=useState(()=>initial.get('destination')||null),[chosen,setChosen]=useState(''),[airlineFilter,setAirlineFilter]=useState(''),[state,setState]=useState({}),[help,setHelp]=useState(false);
 const request=useRef(null),sequence=useRef(0),resultHeading=useRef(null);
 const [recent,setRecent]=useState(()=>readJourneys(RECENT_KEY).slice(0,3));
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{if(state.options||state.error)resultHeading.current?.focus();},[state.options,state.error]);
 useEffect(()=>{if(state.error)setHelp(true);},[state.error]);
 const parsed=parseSearch(q,date),selectedDate=dateOverride?date:parsed.date,ident=chosen||parsed.ident;
 const inferredOrigin=parsed.identifiers.length>1?'':parsed.origin,inferredDestination=parsed.identifiers.length>1?'':parsed.destination;
 const origin=from!==null?resolveAirport(from):inferredOrigin.split(',').filter(Boolean),destination=to!==null?resolveAirport(to):inferredDestination.split(',').filter(Boolean);
 const horizon=new Date();horizon.setFullYear(horizon.getFullYear()+1);
 const max=new Date(horizon-horizon.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const routeMode=mode==='route'||(!ident&&!parsed.number&&!!(origin.length||destination.length));
 const reset=()=>{sequence.current++;request.current?.abort();setState({});};
 const edit=value=>{reset();setQ(value);setChosen('');setDateOverride(false);setFrom(null);setTo(null);setHelp(false);};
 const open=(flight,payload,requestedIdent=ident)=>{
  const flightIdent=requestedIdent||flight.ident_iata||flight.ident;
  const o=code(flight.origin),d=code(flight.destination),departure=flight.scheduled_out||'';
  const params=new URLSearchParams({date:selectedDate});if(o)params.set('origin',o);if(d)params.set('destination',d);if(departure)params.set('departure',departure);
  const first=payload?.flights?.[0];
  if(first&&code(first.origin)===o&&code(first.destination)===d&&first.scheduled_out===departure)putSearchResult(searchKey(flightIdent,selectedDate,o,d,departure),payload);
  go(`${import.meta.env.BASE_URL}flight/${encodeURIComponent(flightIdent)}?${params}`);
 };
 const submit=async event=>{
  event.preventDefault();
  if((!dateOverride&&parsed.dateError)||!validDate(selectedDate)||selectedDate>max)return setState({error:(!dateOverride&&parsed.dateError)||'Choose a valid departure date within the next year.'});
  if(!ident&&!routeMode)return setState({error:parsed.number?'Which airline is this flight with? Choose it below.':parsed.identifiers.length>1?'Your text includes more than one flight. Choose the one you want below.':'Add an airline and flight number, or search by your departure and arrival airports.'});
  if((routeMode&&(origin.length!==1||destination.length!==1))||origin.length>1||destination.length>1)return setState({error:'Choose the exact airports below so we find the right flight.'});
  if((from&&!origin.length)||(to&&!destination.length))return setState({error:'We couldn’t recognize an airport. Try its three-letter code.'});
  if(!origin.length&&/\b(?:from|departing|leaving|out of)\s+/i.test(q))return setState({error:'Which airport are you leaving from? Add its city or airport code below.'});
  request.current?.abort();const controller=new AbortController();request.current=controller;const version=++sequence.current;
  setState({loading:true});
  const query=new URLSearchParams({date:selectedDate});if(origin[0])query.set('origin',origin[0]);if(destination[0])query.set('destination',destination[0]);
  if(routeMode&&parsed.airline)query.set('airline',parsed.airline);
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(`${import.meta.env.BASE_URL}api/${routeMode?'flight-search':`flights/${encodeURIComponent(ident)}`}?${query}`,{signal:controller.signal});
   const data=await response.json();if(version!==sequence.current)return;
   const options=routeMode?data.flights||[]:data.route_options?.length?data.route_options:data.flights||[];
   const filtered=options.filter(f=>(!origin[0]||[f.origin?.code,f.origin?.code_iata,f.origin?.code_icao].includes(origin[0]))&&(!destination[0]||[f.destination?.code,f.destination?.code_iata,f.destination?.code_icao].includes(destination[0])));
   const alternatives=filtered.length?filtered:(!response.ok&&data.route_options?.length?data.route_options:[]);
   const unique=[...new Map(alternatives.map(f=>[`${f.ident||ident}|${code(f.origin)}|${code(f.destination)}|${f.scheduled_out}`,f])).values()];
   if(!response.ok&&!unique.length)throw new Error(data.error||'We couldn’t complete that search. Please try again.');
   if(!routeMode&&unique.length===1&&response.ok&&data.flights?.length){open(unique[0],data);return;}
   setState({options:unique,payload:routeMode?null:data,routeMode,partial:data.partial,note:data.note,source:data.source||'FlightAware flight records',error:unique.length?(!filtered.length?'We found this flight number at other airports. Check these against your booking before choosing.':''):data.error||'No matching flights were returned. This doesn’t mean the flight doesn’t exist—try your booking’s flight number or a different date.'});
  }catch(error){if(version!==sequence.current)return;setState({error:controller.signal.aborted?'That search took too long. Please try again.':!navigator.onLine?'You’re offline. Connect to look for flights, or open a saved flight.':error.message});}
  finally{clearTimeout(timer);}
 };
 const chooseAirline=airline=>{setChosen(`${airline.code}${parsed.number.toUpperCase()}`);setState({});};
 return <section className="flight-finder natural-search" aria-label="Find your flight">
  <div className="finder-modes" role="group" aria-label="Search method"><button type="button" aria-pressed={mode==='flight'} onClick={()=>{reset();setMode('flight');}}>By flight number</button><button type="button" aria-pressed={mode==='route'} onClick={()=>{reset();setMode('route');}}>By city or airport</button></div>
  <form className="search-box finder-form" onSubmit={submit} aria-busy={!!state.loading}>
   <label className="finder-input-label" htmlFor="flight-query">{mode==='route'?'Where are you flying?':'Find your flight'}</label>
   <div className="input-wrap"><Search size={21}/><input id="flight-query" value={q} onChange={e=>edit(e.target.value)} onPaste={e=>{const text=e.clipboardData.getData('text');if(text){e.preventDefault();const input=e.currentTarget;edit((q.slice(0,input.selectionStart)+text.replace(/\s+/g,' ')+q.slice(input.selectionEnd)).slice(0,1200));}}} placeholder={mode==='route'?'New York to London tomorrow':'e.g. United 15 tomorrow'} autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={1200} aria-describedby="finder-guidance"/></div>
   <p className="finder-guidance" id="finder-guidance">{mode==='route'?'Enter two cities. We’ll help you choose the airports.':'Try “AA100” or “United 15 tomorrow”.'}</p>
   {parsed.identifiers.length>1&&!chosen&&<div className="finder-followup"><b>Which flight in your itinerary?</b><div>{parsed.identifiers.map(value=><button type="button" key={value} onClick={()=>{setChosen(value);setState({});}}>{value}</button>)}</div></div>}
   {parsed.number&&!ident&&<div className="finder-followup"><label htmlFor="finder-airline">Which airline is flight {parsed.number} with?</label><input id="finder-airline" placeholder="Search airline names" value={airlineFilter} onChange={e=>setAirlineFilter(e.target.value)}/><div>{airlines.filter(a=>`${a.name} ${a.code}`.toLowerCase().includes(airlineFilter.toLowerCase())).slice(0,8).map(a=><button type="button" key={a.code} onClick={()=>chooseAirline(a)}>{a.name}</button>)}</div></div>}
   {ident&&<div className="finder-understood"><Plane size={17}/><span>Looking for <b>{ident}</b></span>{chosen&&<button type="button" onClick={()=>{setChosen('');setState({});}}>Change</button>}</div>}
   <div className="finder-fields"><label className="finder-date" htmlFor="finder-date"><span><CalendarDays size={17}/>Departure date</span><input id="finder-date" type="date" required value={selectedDate} max={max} onChange={e=>{reset();setDate(e.target.value);setDateOverride(true);}}/><small>Date at the airport you leave from</small></label>
   {(routeMode||origin.length>0||destination.length>0||help)&&<><AirportField id="finder-from" label="From" value={from??inferredOrigin} onChange={v=>{reset();setFrom(v);}}/><AirportField id="finder-to" label={routeMode?'To':'To (optional)'} value={to??inferredDestination} onChange={v=>{reset();setTo(v);}}/></>}
   </div>
   {!dateOverride&&parsed.dateError&&<div className="finder-date-warning" role="status">{parsed.dateError}{/two different|more than one date/.test(parsed.dateError)&&validDate(selectedDate)&&selectedDate<=max&&<button type="button" onClick={()=>{reset();setDate(selectedDate);setDateOverride(true);}}>Confirm {new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</button>}</div>}
   <button className="primary finder-submit" disabled={state.loading}>{state.loading?<><LoaderCircle className="spinning" size={18}/>Checking flights…</>:<>Find my flight<ArrowRight size={18}/></>}</button>
   {state.loading&&<p className="finder-loading-note" role="status">Checking the latest flight records. This can take a few seconds.</p>}
   {state.loading&&<button className="finder-edit" type="button" onClick={reset}>Cancel search</button>}
  </form>
  {!q&&recent.length>0&&<div className="finder-examples"><span>Recently viewed on this device</span>{recent.map(item=><button key={item.key} onClick={()=>{edit(`${item.ident} ${airportCode(item.origin)}-${airportCode(item.destination)}`);setDate(item.date);setDateOverride(true);}}>{item.ident} · {item.date}</button>)}<button onClick={()=>{try{localStorage.removeItem(RECENT_KEY);setRecent([]);}catch{setState({error:'This browser couldn’t clear your recent searches. Please try again.'});}}}>Clear recent</button></div>}
  {(state.options||state.error)&&<section className="finder-results" aria-live="polite"><h2 ref={resultHeading} tabIndex={-1}>{state.options?.length?'Which one is yours?':'Let’s narrow it down.'}</h2>{state.error&&<p role="alert">{state.error}</p>}{state.options?.length>0&&<><p>Match the airports and departure time to your booking. Times are local to the departure airport unless marked UTC.</p>{state.options.map((flight,i)=><FlightOption key={`${flight.ident||ident}-${i}`} flight={flight} fallback={ident} preferred={parsed.airline} onSelect={display=>open(flight,state.payload,state.routeMode?display:ident)}/>)}<small className="finder-source">{state.source}{state.partial?' · More schedules may exist; these are the results returned within this search limit.':''}{state.note?` · ${state.note}`:''}</small></>}<button className="finder-edit" onClick={()=>{reset();document.querySelector('#flight-query')?.focus();}}><ArrowLeft size={16}/>Edit search</button></section>}
  <details className="finder-help"><summary>Don’t know your flight number?</summary><p>Look in your booking email or boarding pass for a number like AA100. Or choose “By city or airport” above.</p><p>You can also paste your flight details here. Leave out names, booking references and payment details.</p><p>Search up to a year ahead. Gates and delay updates appear closer to departure.</p></details>
 </section>;
}
