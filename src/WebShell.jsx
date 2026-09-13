import React,{useEffect,useRef,useState} from 'react';
import {Search,Bookmark,Bell,X,WifiOff} from 'lucide-react';
import './web-shell.css';
import {readJourneys,SAVED_KEY,RECENT_KEY,journeyUrl} from './journeys.js';
import {recentFlightLabel} from './recent-flight-label.js';

export default function WebShell({children,go}) {
  const [online,setOnline]=useState(navigator.onLine),dialog=useRef(null),trigger=useRef(null);
  const base=import.meta.env.BASE_URL;
  const [journeys,setJourneys]=useState([]);
  const openAlerts=()=>{const seen=new Set();setJourneys([...readJourneys(SAVED_KEY),...readJourneys(RECENT_KEY)].filter(i=>{const k=journeyUrl(i,base);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8));dialog.current.showModal();};
  useEffect(()=>{
    const change=()=>setOnline(navigator.onLine);
    addEventListener('online',change);addEventListener('offline',change);
    // Retire only this site's previous offline worker, never another site's scope.
    if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(regs=>{
      const scope=new URL(base,location.origin).href;
      for(const reg of regs)if(reg.scope===scope)reg.update().catch(()=>{});
    }).catch(()=>{});
    return()=>{removeEventListener('online',change);removeEventListener('offline',change);};
  },[base]);
  const navigate=target=>{
    dialog.current?.close();go(target==='saved'?`${base}dashboard`:base);
    if(target==='search')requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector('#flight-query')?.focus()));
  };
  return <div className="pwa-layout">
    {!online&&<div className="pwa-offline" role="status"><WifiOff size={18}/><span>You’re offline. Reconnect to search or refresh flight updates.</span></div>}
    <div className="web-content">{children}</div>
    <div className="dock-shelf">
    <nav className="pwa-dock" aria-label="Website navigation">
      <button onClick={()=>navigate('search')}><Search/><span>Search</span></button>
      <button onClick={()=>navigate('saved')}><Bookmark/><span>Saved</span></button>
      <button ref={trigger} onClick={openAlerts} aria-haspopup="dialog"><Bell/><span>Alerts</span></button>
    </nav></div>
    <dialog className="pwa-menu" ref={dialog} aria-labelledby="website-menu-title" onClose={()=>trigger.current?.focus()}>
      <header><div><p>UPDATES YOU CHOOSE</p><h2 id="website-menu-title">Your flight alerts</h2></div><button aria-label="Close menu" onClick={()=>dialog.current.close()}><X/></button></header>
      <p>Choose a flight to manage its alerts. Browser alerts work while the flight page is open; text and email availability is checked separately.</p>
      {journeys.map(item=><button className="pwa-menu-row" key={item.key} onClick={()=>{dialog.current.close();go(`${journeyUrl(item,base)}&alerts=1`);requestAnimationFrame(()=>window.dispatchEvent(new Event('envolio:open-alerts')));}}><Bell/><span><b>{recentFlightLabel(item)}</b><small>{item.date} · Manage alerts</small></span></button>)}
      {!journeys.length&&<p>Find a flight first, then select “Watch flight” to choose your updates.</p>}
      <div className="pwa-menu-status">{online?'Online · refresh your flight for the latest available update':'Offline · reconnect for flight updates'}</div>
      <button className="pwa-menu-row" onClick={()=>navigate('search')}><Search/><span><b>Find a flight</b><small>Check what’s happening before you travel.</small></span></button>
      <button className="pwa-menu-row" onClick={()=>navigate('saved')}><Bookmark/><span><b>Saved flights</b><small>Your favorites, kept in this browser.</small></span></button>
    </dialog>
  </div>;
}
