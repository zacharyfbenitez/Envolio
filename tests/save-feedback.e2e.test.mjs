import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';

test('PD604 save is explicit, survives reload, opens Saved, and distinguishes blocked storage', {timeout:180000}, async t=>{
 const app=express();app.use(express.static('dist'));app.use((_q,s)=>s.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());
 const departure=new Date(Date.now()+24*3600000).toISOString(),arrival=new Date(Date.now()+26*3600000).toISOString(),date=departure.slice(0,10),data=sq12Lookup(date);Object.assign(data.flights[0],{ident:'POE604',ident_iata:'PD604',operator:'POE',operator_iata:'PD',operator_icao:'POE',scheduled_out:departure,estimated_out:departure,scheduled_in:arrival,estimated_in:arrival,origin:{code_iata:'LGA',city:'New York',timezone:'America/New_York'},destination:{code_iata:'YYZ',city:'Toronto',timezone:'America/Toronto'}});data.route_options=[];data.diagnostics=null;data.refreshed_at=new Date().toISOString();
 for(const blocked of [false,true]){
  const context=await browser.createBrowserContext(),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  if(blocked)await p.evaluateOnNewDocument(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage blocked','SecurityError');};});
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))return r.respond({status:u.pathname==='/api/flights/PD604'?200:503,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/flights/PD604'?data:{error:'Fixture unavailable'})});return u.hostname==='127.0.0.1'?r.continue():r.abort();});
  await p.goto(`http://127.0.0.1:${server.address().port}/flight/PD604?date=${date}`);await p.waitForSelector('.alerts-button:not([disabled])');
  assert.equal(await p.$eval('.reported-status[data-tone="on-time"] strong',e=>e.textContent),'On time');
  assert.equal(await p.$eval('.alerts-button',e=>e.textContent),'Save flight');await p.click('.alerts-button');await p.waitForSelector('.alert-sheet');
  assert.match(await p.$eval('.alert-sheet',e=>e.textContent),blocked?/Kept for this visit only/:/Saved on this device/);
  await p.click('.alert-sheet-foot button');await p.waitForSelector('.journey-card');assert.match(await p.$eval('.journey-card',e=>e.textContent),/PD604/);
  assert.equal(await p.$eval('.journey-status.on-time',e=>e.textContent),'Last seen: On time');
  await p.click('.journey-main');await p.waitForSelector('.flight-summary');assert.equal(await p.$eval('.alerts-button',e=>e.textContent),blocked?'Kept for now':'Saved · alerts');
  if(!blocked){
   await p.reload();await p.waitForSelector('.alerts-button:not([disabled])');assert.equal(await p.$eval('.alerts-button',e=>e.textContent),'Saved · alerts');
   await p.click('.alerts-button');await p.waitForSelector('.alert-sheet');await p.click('.alert-sheet-foot button');await p.waitForSelector('.journey-card');
   await p.click('.remove-save');await p.waitForFunction(()=>!document.querySelector('.journey-card'));assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')).length),0);
  }else assert.match(await p.$eval('.storage-warning',e=>e.textContent),/this visit only/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await context.close();
 }
});
