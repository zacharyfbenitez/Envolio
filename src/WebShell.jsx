import React,{useEffect,useState} from 'react';
import {Search,Bookmark,WifiOff} from 'lucide-react';
import './web-shell.css';
export default function WebShell({children,go}){
 const [online,setOnline]=useState(navigator.onLine),base=import.meta.env.BASE_URL;
 useEffect(()=>{
  const change=()=>setOnline(navigator.onLine);addEventListener('online',change);addEventListener('offline',change);
  if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(regs=>{const scope=new URL(base,location.origin).href;for(const reg of regs)if(reg.scope===scope)reg.update().catch(()=>{});}).catch(()=>{});
  return()=>{removeEventListener('online',change);removeEventListener('offline',change);};
 },[base]);
 const navigate=target=>{go(target==='saved'?`${base}dashboard`:base);if(target==='search')requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector('#flight-query')?.focus()));};
 return <div className="pwa-layout">
  {!online&&<div className="pwa-offline" role="status"><WifiOff size={18}/><span>You’re offline. Reconnect to search or refresh flight updates.</span></div>}
  <div className="web-content">{children}</div>
  <div className="dock-shelf"><nav className="pwa-dock" aria-label="Website navigation">
   <button onClick={()=>navigate('search')}><Search/><span>Search</span></button>
   <button onClick={()=>navigate('saved')}><Bookmark/><span>Saved</span></button>
  </nav></div>
 </div>;
}
