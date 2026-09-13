import React,{useEffect,useRef,useState} from 'react';
import SavedFlightCard from './SavedFlightCard.jsx';
import {nextJourney,flightChanges} from './travel-polish.js';
import {journeySnapshot} from './journeys.js';
import {weatherWords} from './traveler-presentation.js';
import './travel-polish.css';
export function NextJourney({saved,go,remove,base}){
 const item=nextJourney(saved);
 return item?<section className="next-journey"><div><span className="traveler-kicker">Ready when you are</span><h2>Your next saved flight</h2><p>Open it for the latest update.</p></div><SavedFlightCard item={item} go={go} remove={remove} base={base}/></section>:null;
}
export function UpdateStrip({flight,refreshed,cached}){
 const key=`envolio.last-check.${flight.fa_flight_id||[flight.ident,flight.scheduled_out,flight.origin?.code_iata,flight.destination?.code_iata].join('.')}`;
 const [items,setItems]=useState([]),seen=useRef('');
 useEffect(()=>{if(cached||seen.current===`${key}|${refreshed}`)return;seen.current=`${key}|${refreshed}`;try{const before=JSON.parse(localStorage.getItem(key)||'null');setItems(flightChanges(before,flight));localStorage.setItem(key,JSON.stringify(journeySnapshot(flight,refreshed)));}catch{setItems([]);}},[key,refreshed,cached,flight]);
 return !cached&&items.length>0?<section className="update-strip" role="status"><strong>Since your last check</strong><ul>{items.map(item=><li key={item}>{item}</li>)}</ul><p>Gate changed? Check airport screens before heading over.</p></section>:null;
}
export function WeatherWindow({airport,target}){
 const at=Date.parse(target);
 const windows=(airport.windows||[]).filter(w=>Number.isFinite(at)&&Math.abs(Date.parse(w.at)-at)<=6*3600000).slice(0,5);
 if(!windows.length)return null;
 return <div className="weather-window"><strong>Around your flight time</strong><div>{windows.map(w=><article key={w.at} className={w.forecast?.status==='available'?'available':'unknown'}><time>{new Date(w.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><span>{w.forecast?.status==='available'?weatherWords(w.forecast.summary):'Forecast unavailable'}</span></article>)}</div><small>Device time · published TAF via Skylink. Missing reports aren’t a clear-weather forecast.</small></div>;
}
