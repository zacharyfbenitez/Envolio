import React,{useState} from 'react';
import {Plane} from 'lucide-react';
import {carrierName} from './carrier-name.js';
export default function CarrierLogo({flight}){
 const iata=(flight.operator_iata||flight.ident_iata?.toUpperCase().match(/^[A-Z0-9]{2}/)?.[0]||'').toUpperCase();
 const name=carrierName(flight);
 const [failed,setFailed]=useState({name:null,stage:'play'});
 const stage=failed.name===name?failed.stage:'play';
 const url=stage==='play'?`${import.meta.env.BASE_URL}api/airline-icon?name=${encodeURIComponent(name)}`:`https://images.kiwi.com/airlines/64/${iata}.png`;
 return <div className="carrier-logo" data-artwork={stage}>{iata&&stage!=='text'?<img src={url} alt={`${name} airline logo`} loading="lazy" onError={()=>setFailed({name,stage:stage==='play'?'airline':'text'})}/>:<span>{iata||<Plane size={20}/>}</span>}</div>;
}
