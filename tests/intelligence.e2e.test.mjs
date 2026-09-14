import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import express from 'express';
import {ba1511Lookup} from './fixtures/flight-lookups.mjs';
import {disruptionBrief} from '../traveler-intelligence.js';
import {providerPermissions} from '../provider-permissions.js';
test('secondary provider context, conflicts, receipts, error recovery and mobile layout',async t=>{
  const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
  app.use((req,_res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
  app.use('/api',(_req,res)=>res.status(503).json({error:'No live provider calls in this test'}));
  app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}/`;
  const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
  const page=await browser.newPage(),errors=[];let fail=false;
  await page.setBypassServiceWorker(true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const flight={...ba1511Lookup('2026-09-12').flights[0],gate_origin:'42'};
  const secondary={comparison:{status:'matched',receipt:{retrieved_at:'2026-09-12T12:00:00Z'}},status_data:{departure:{gate:'B123 — Satellite terminal'}},airports:[]};
  const brief=disruptionBrief(flight,secondary,{retrieved_at:'2026-09-12T12:00:00Z'},[],Date.parse('2026-09-12T12:00:00Z'));
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
    const u=new URL(r.url());
    if(u.pathname.endsWith('/api/flights/BA1511'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify(ba1511Lookup('2026-09-12'))});
    if(u.pathname.endsWith('/api/flights/BA117'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({flights:[{ident_iata:'BA117'}]})});
    if(u.pathname.endsWith('/connection'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({status:'tight',remaining_minutes:30,buffer_minutes:60,recommendation:'Your connection is tighter than your chosen allowance. Contact the airline.',note:'This is not an official minimum connection time.',alternatives:u.searchParams.get('alternates')==='true'?{flights:[],note:'Seats and rebooking eligibility are unverified.'}:null})});
    if(u.pathname.endsWith('/intelligence'))return r.respond({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'unavailable'}:{brief,permissions:providerPermissions(),historical:{enabled:false},comparison:{status:'matched',conflicts:[{field:'gate_origin',flightaware:'42',skylink:'B123 — Satellite terminal'}],fields:{terminal_origin:'8'},receipt:{endpoint:'/flight_status/AA100',status:'available',retrieved_at:'2026-09-12T12:00:00Z'}},airports:[{side:'origin',airport:'JFK',forecast:{status:'available',summary:'Wind 12 kt',valid_until:'2026-09-13T12:00:00Z',modifiers:[{weather_probability:30,summary:'Thunderstorm rain'}]},notices:[],receipts:[]}],policy:'Sources can disagree; conditions do not confirm a flight-specific cause.'})});
    if(u.pathname.endsWith('/explore'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({status:'available',note:'Indicative quotes, not guaranteed seats.',data:{flights:[]}})});
    if(u.pathname.endsWith('/api/airline-icon'))return r.respond({status:204});
    return r.continue();
  });
  await page.goto(base+'flight/BA1511?date=2026-09-12',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.source-conflicts',{timeout:15000});
  await page.$eval('.flight-analysis',e=>e.open=true);
  assert.match(await page.$eval('.travel-intelligence',e=>e.textContent),/Weather odds are not delay odds/);
  assert.match(await page.$eval('.airport-outlooks',e=>e.textContent),/km\/h/);
  assert.equal(await page.$eval('.journey-tools',e=>e.open),false);
  for(const width of [1440,390]){
    await page.setViewport({width,height:900});
    await page.$eval('.travel-intelligence',e=>e.scrollIntoView({block:'start'}));
    await page.screenshot({path:`/tmp/envolio-weather-simple-${width}.png`});
  }
  await page.click('.journey-tools>summary');
  await page.click('.field-evidence>summary');
  assert.match(await page.$eval('.field-grid .conflict',e=>e.textContent),/20\/100/);
  await page.click('.connection-protection>summary');
  await page.type('.connection-protection input','BA117');
  await page.click('.connection-protection form button');
  await page.waitForSelector('.connection-result.tight');
  await page.click('.connection-result button');
  await page.waitForFunction(()=>document.querySelector('.connection-result')?.textContent.includes('Seats and rebooking eligibility'));
  await page.click('.licensed-features>summary');
  assert.equal(await page.$eval('.licensed-features button',b=>b.disabled),true);
  for(const width of [1440,390]){
    await page.setViewport({width,height:900});await page.$eval('.travel-intelligence',e=>e.scrollIntoView());
    const overflow=await page.$eval('.travel-intelligence',e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,`Panel overflow at ${width}`);
    await page.screenshot({path:`/tmp/disruption-decision-${width}.png`});
  }
  await page.click('.travel-explore>summary');await page.click('.explore-actions button');
  await page.waitForFunction(()=>document.querySelector('.explore-result')?.textContent.includes('does not mean your flight is cancelled'));
  fail=true;await page.click('[aria-label="Refresh additional travel information"]');
  await page.waitForFunction(()=>document.querySelector('.travel-intelligence')?.textContent.includes('Your flight details are still available'));
  assert.ok(await page.$('.flight-title'));assert.deepEqual(errors,[]);
});
