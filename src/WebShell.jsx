import React,{useEffect,useRef,useState} from 'react';
import {Search,Bookmark,Menu,X,WifiOff} from 'lucide-react';
import './web-shell.css';

export default function WebShell({children,go}) {
  const [online,setOnline]=useState(navigator.onLine),dialog=useRef(null),trigger=useRef(null);
  const base=import.meta.env.BASE_URL;
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
    {children}
    <nav className="pwa-dock" aria-label="Website navigation">
      <button onClick={()=>navigate('search')}><Search/><span>Search</span></button>
      <button onClick={()=>navigate('saved')}><Bookmark/><span>Saved</span></button>
      <button ref={trigger} onClick={()=>dialog.current.showModal()} aria-haspopup="dialog"><Menu/><span>Menu</span></button>
    </nav>
    <dialog className="pwa-menu" ref={dialog} aria-labelledby="website-menu-title" onClose={()=>trigger.current?.focus()}>
      <header><div><p>YOUR TRAVEL COMPANION</p><h2 id="website-menu-title">Envolio</h2></div><button aria-label="Close menu" onClick={()=>dialog.current.close()}><X/></button></header>
      <div className="pwa-menu-status">{online?'Online · refresh your flight for the latest available update':'Offline · reconnect for flight updates'}</div>
      <button className="pwa-menu-row" onClick={()=>navigate('search')}><Search/><span><b>Find a flight</b><small>Check what’s happening before you travel.</small></span></button>
      <button className="pwa-menu-row" onClick={()=>navigate('saved')}><Bookmark/><span><b>Saved flights</b><small>Your favorites, kept in this browser.</small></span></button>
    </dialog>
  </div>;
}
