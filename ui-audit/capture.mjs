// Read-only UI audit of the production bundle. Fixture data never reaches providers.
import puppeteer from 'puppeteer-core';
import {writeFile} from 'node:fs/promises';
import {sq12Lookup} from '../tests/fixtures/flight-lookups.mjs';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});
const observations=[],errors=[];let phase='upcoming',hold=false;
try{
 const p=await browser.newPage();await p.setBypassServiceWorker(true);
 await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);
 p.on('request',r=>{
  const u=new URL(r.url());
  if(u.pathname.endsWith('/api/flights/SQ12')){
   const date=u.searchParams.get('date')||'2026-09-14',data=sq12Lookup(date);
   data.refreshed_at=new Date().toISOString();const f=data.flights[0];
   f.gate_origin='B123';f.terminal_origin='Terminal 1';
   if(phase==='inflight'){f.actual_out=f.scheduled_out;f.actual_off=f.scheduled_out;f.status='En Route';f.progress_percent=62;}
   if(phase==='landed'){f.actual_out=f.scheduled_out;f.actual_in=f.scheduled_in;f.status='Arrived';f.baggage_claim='12';}
   if(hold)return;
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(u.pathname.includes('/api/'))return r.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Live flight data is temporarily unavailable.',detail:'The provider did not respond before the lookup deadline.'})});
  return r.continue();
 });
 const base='http://127.0.0.1:5173/';
 const capture=async(name,selector)=>{
  if(selector)await p.$eval(selector,e=>e.scrollIntoView({behavior:'instant',block:'start'}));
  await p.screenshot({path:`/workspace/ui-audit/${name}.png`});
  const data=await p.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {top:Math.round(r.top+scrollY),left:Math.round(r.left),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom+scrollY)};};
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none';};
   const texts=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&e.childElementCount===0&&e.textContent.trim());
   return {url:location.pathname,viewport:{width:innerWidth,height:innerHeight,scroll:Math.round(scrollY)},pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,landmarks:Object.fromEntries(['.hero h1','.finder-form','.finder-submit','.examples-section','.saved-section','.pwa-dock','.flight-title','.route-main','.title-actions','.next-step-card'].map(s=>[s,document.querySelector(s)?rect(document.querySelector(s)):null])),smallText:texts.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>({text:e.textContent.trim().slice(0,90),font:getComputedStyle(e).fontSize,color:getComputedStyle(e).color})).slice(0,30),smallTargets:[...document.querySelectorAll('button,a,input,summary')].filter(visible).map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,65)||e.getAttribute('placeholder'),...rect(e)})).filter(e=>e.width<44||e.height<44).slice(0,30),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:e.textContent.trim(),...rect(e)}))};
  });
  observations.push({name,...data});console.log(name,JSON.stringify({overflow:data.pageWidth>data.viewport.width,smallText:data.smallText.length,smallTargets:data.smallTargets.length}));
 };
 await p.setViewport({width:1440,height:900});await p.goto(base,{waitUntil:'networkidle2'});await p.waitForSelector('#flight-query');await capture('01-home-desktop');
 await p.setViewport({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await capture('02-home-phone');await capture('03-search-phone','.finder-form');
 await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(()=>!document.querySelector('.dock-shelf')?.dataset.hidden);await p.click('.pwa-dock button:nth-child(2)');await new Promise(r=>setTimeout(r,500));await capture('04-saved-phone');
 await p.click('.pwa-dock button:last-child');await capture('05-app-menu-phone');await p.keyboard.press('Escape');
 await p.goto(base+'flight/SQ12?date=2026-09-14&origin=NRT',{waitUntil:'domcontentloaded'});await p.waitForSelector('.flight-title');await capture('06-result-phone');await capture('07-route-phone','.flight-title');
 const alerts=await p.$('.alerts-button');if(alerts){await alerts.click();await capture('08-alert-menu-phone');await p.click('.alerts-modal .modal-close').catch(()=>{});}
 await p.setViewport({width:1440,height:900});await p.goto(base+'flight/SQ12?date=2026-09-14&origin=NRT',{waitUntil:'domcontentloaded'});await p.waitForSelector('.flight-title');await capture('09-result-desktop');
 await p.$eval('.flight-analysis',e=>e.open=true);await capture('10-analysis-desktop','.flight-analysis');
 phase='landed';await p.setViewport({width:390,height:844});await p.goto(base+'flight/SQ12?date=2026-09-13&origin=NRT',{waitUntil:'domcontentloaded'});await p.waitForSelector('.flight-title');await capture('11-landed-phone');
 await p.goto(base+'flight/ZZ999?date=2026-09-14',{waitUntil:'domcontentloaded'});await p.waitForSelector('.error-panel');await capture('12-error-phone');
 await p.goto(base+'dashboard',{waitUntil:'domcontentloaded'});await p.waitForSelector('.explore-page');await capture('13-dashboard-phone');
 await p.setViewport({width:320,height:740});await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForSelector('#flight-query');await capture('14-search-small-phone','.finder-form');
 await p.setViewport({width:390,height:844});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);await p.goto(base,{waitUntil:'networkidle2'});await capture('15-home-motion-phone');
 await p.goto(base+'premium',{waitUntil:'domcontentloaded'});await p.waitForSelector('.explore-page');await capture('16-premium-phone');
 await writeFile('/workspace/ui-audit/observations.json',JSON.stringify({errors,observations},null,2));
}finally{await browser.close();}
