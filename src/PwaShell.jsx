import React, {useEffect, useRef, useState} from 'react';
import {Search, Bookmark, Menu, X, Download, WifiOff, RefreshCw, Check} from 'lucide-react';
import './pwa.css';

export default function PwaShell({children, go}) {
  const [online,setOnline]=useState(navigator.onLine);
  const [standalone,setStandalone]=useState(()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
  const [install,setInstall]=useState(null),[waiting,setWaiting]=useState(null),[message,setMessage]=useState('');
  const dialog=useRef(null),menuButton=useRef(null);
  const base=import.meta.env.BASE_URL;
  useEffect(()=>{
    const connectivity=()=>setOnline(navigator.onLine);
    const prompt=e=>{e.preventDefault();setInstall(e);};
    const installed=()=>{setStandalone(true);setInstall(null);setMessage('Envolio is installed.');};
    const display=matchMedia('(display-mode: standalone)');
    const mode=()=>setStandalone(display.matches||navigator.standalone===true);
    addEventListener('online',connectivity);addEventListener('offline',connectivity);
    addEventListener('beforeinstallprompt',prompt);addEventListener('appinstalled',installed);display.addEventListener('change',mode);
    let disposed=false;
    if(import.meta.env.PROD&&'serviceWorker' in navigator){
      navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'}).then(reg=>{
        if(disposed)return;
        if(reg.waiting)setWaiting(reg.waiting);
        reg.addEventListener('updatefound',()=>{
          const worker=reg.installing;
          worker?.addEventListener('statechange',()=>{if(!disposed&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(worker);});
        });
      }).catch(()=>{if(!disposed)setMessage('Offline setup isn’t ready. You can still use Envolio online.');});
    }
    return()=>{disposed=true;removeEventListener('online',connectivity);removeEventListener('offline',connectivity);removeEventListener('beforeinstallprompt',prompt);removeEventListener('appinstalled',installed);display.removeEventListener('change',mode);};
  },[base]);
  const navigate=target=>{
    dialog.current?.close();go(base);
    // Allow the home page to mount before scrolling/focusing its destination.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const el=document.querySelector(target==='saved'?'.saved-section':'.search-box');
      el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      if(target==='search')el?.querySelector('input')?.focus({preventScroll:true});
    }));
  };
  const installApp=async()=>{
    if(!install)return;
    try{await install.prompt();const choice=await install.userChoice;setMessage(choice.outcome==='accepted'?'Installation requested. Look for Envolio on your home screen.':'You can install later from this menu.');}
    catch{setMessage('Use your browser menu to install Envolio.');}
    finally{setInstall(null);}
  };
  const update=()=>{
    if(!waiting)return;
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    waiting.postMessage('ACTIVATE_UPDATE');
  };
  return <div className={`pwa-layout${standalone?' is-installed':''}`}>
    {!online&&<div className="pwa-offline" role="status"><WifiOff size={18}/><span>You’re offline. Saved flight details may be out of date. Connect for live updates.</span></div>}
    {children}
    <nav className="pwa-dock" aria-label="App navigation">
      <button onClick={()=>navigate('search')}><Search/><span>Search</span></button>
      <button onClick={()=>navigate('saved')}><Bookmark/><span>Saved</span></button>
      <button ref={menuButton} onClick={()=>dialog.current.showModal()} aria-haspopup="dialog"><Menu/><span>App menu</span>{waiting&&<i aria-label="Update available"/>}</button>
    </nav>
    <dialog className="pwa-menu" ref={dialog} aria-labelledby="pwa-menu-title" onClose={()=>menuButton.current?.focus()} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.current.close();}}}>
      <header><div><p>YOUR TRAVEL COMPANION</p><h2 id="pwa-menu-title">Envolio</h2></div><button aria-label="Close app menu" onClick={()=>dialog.current.close()}><X/></button></header>
      <div className="pwa-menu-status"><span className={online?'is-online':''}/>{online?'Connected · live updates available':'Offline · saved details only'}</div>
      <button className="pwa-menu-row" onClick={()=>navigate('search')}><Search/><span><b>Find a flight</b><small>Check what’s happening before you travel.</small></span></button>
      <button className="pwa-menu-row" onClick={()=>navigate('saved')}><Bookmark/><span><b>Saved flights</b><small>Your favorites, kept on this device.</small></span></button>
      <section className="pwa-install-info">
        <h3>{standalone?<><Check size={18}/> App installed</>:<><Download size={18}/> Take Envolio with you</>}</h3>
        {!standalone&&(install?<button className="pwa-install-button" onClick={installApp}>Install Envolio</button>:<p>On iPhone, open the browser’s Share menu and choose <strong>Add to Home Screen</strong>. On Android, open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>)}
        <p>Saved details can be viewed offline after a successful lookup. New searches and live updates need internet. Installation does not turn on background alerts.</p>
      </section>
      {waiting&&<button className="pwa-install-button" onClick={update}><RefreshCw size={18}/> Update app</button>}
      {message&&<p className="pwa-message" role="status">{message}</p>}
    </dialog>
  </div>;
}
