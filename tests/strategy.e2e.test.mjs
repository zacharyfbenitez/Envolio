import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ba1511Lookup} from './fixtures/flight-lookups.mjs';
import {disruptionBrief} from '../traveler-intelligence.js';
import {tripStrategy,airportPressure} from '../trip-strategy.js';
const base=process.env.TEST_PUBLIC_URL||'http://127.0.0.1:5173/';
test('trip timeline, evidence, backup preferences, saved fallback and airport explorer render accessibly',async t=>{
  const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const p=await browser.newPage(),errors=[];let backupCalls=0,failBackups=false;
  await p.setBypassServiceWorker(true);
  const now=Date.parse('2026-09-13T10:00:00Z'),lookup=ba1511Lookup('2026-09-13'),flight=lookup.flights[0];
  const secondary={checked_at:new Date(now).toISOString(),comparison:{status:'unmatched',conflicts:[],fields:{}},airports:[{side:'origin',airport:'JFK',receipts:[],windows:Array.from({length:25},(_,i)=>({forecast:i<3?{status:'available',summary:i?'Thunderstorm rain':'wind 10 kt'}:{status:'outside_window'},notices:[]}))}]};
  const brief=disruptionBrief(flight,secondary,{retrieved_at:new Date(now).toISOString()},[],now);
  const strategy=tripStrategy(flight,secondary,brief,{},now);
  const backup={key:'backup',price_usd:450,departure_at:'2026-09-13T23:00:00Z',arrival_at:'2026-09-14T07:00:00Z',legs:[{flight_number:'BA180'}],warnings:[],missing:['Seat inventory'],explanation:'Same-airport nonstop option',status_check:{status:'unavailable'}};
  p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);
  p.on('request',r=>{
    const u=new URL(r.url()),json=(d,status=200)=>r.respond({status,contentType:'application/json',body:JSON.stringify(d)});
    if(u.pathname.endsWith('/api/flights/BA1511'))return json(lookup);
    if(u.pathname.endsWith('/intelligence'))return json({...secondary,brief,strategy});
    if(u.pathname.endsWith('/backups')){backupCalls++;return json(failBackups?{error:'Provider rate-limited'}:{status:'available',flights:[backup],checked_at:new Date(now).toISOString(),note:'Indicative quotes, not protected seats.'},failBackups?503:200);}
    if(u.pathname.endsWith('/pressure'))return json(airportPressure('JFK',{items:[]},null,null,now));
    if(u.pathname.includes('/api/'))return json({flights:[]});
    return r.continue();
  });
  await p.goto(base+'flight/BA1511?date=2026-09-13',{waitUntil:'domcontentloaded'});await p.waitForSelector('.trip-timeline');
  assert.equal(await p.$eval('.aircraft-history',e=>e.open),false);
  assert.equal(await p.$eval('.weather-details',e=>e.open),false);
  await p.click('.horizon-picker button:last-child');
  // Native keyboard input exercises the React slider handler reliably.
  await p.focus('.timeline-slider input');await p.keyboard.press('End');
  await p.waitForFunction(()=>document.querySelector('.timeline-evidence')?.textContent.includes('Not enough information'));
  await p.click('.trip-shortcuts button:nth-child(2)');assert.equal(await p.$eval('.playbook-panel',e=>e.open),true);assert.match(await p.$eval('.playbook-panel',e=>e.textContent),/original airline|Original airline/);
  await p.click('.backup-watch>header button');await p.waitForSelector('.backup-options article');assert.equal(backupCalls,1);
  await p.click('.trip-preferences>summary');await p.select('.trip-preferences select','price');
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('disruption-preferences')).priority==='price');
  await p.waitForFunction(()=>!document.querySelector('.backup-watch')?.textContent.includes('Finding and cross-checking'));
  failBackups=true;await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.saved-backup');await p.waitForFunction(()=>document.querySelector('.backup-watch')?.textContent.includes('Provider rate-limited'));
  assert.match(await p.$eval('.backup-options',e=>e.textContent),/BA180/);
  await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await p.$eval('.trip-risk-graphic svg',e=>getComputedStyle(e).animationName),'none');
  for(const width of [1440,390,320]){
    await p.setViewport({width,height:1000});await p.$eval('.trip-timeline',e=>e.scrollIntoView({behavior:'instant',block:'start'}));
    assert.equal(await p.$eval('.trip-strategy',e=>e.scrollWidth>e.clientWidth+1),false,`overflow ${width}`);
    assert.equal(await p.evaluate(()=>document.querySelector('.trip-shortcuts').getBoundingClientRect().bottom<=document.querySelector('.trip-timeline').getBoundingClientRect().top),true,`Shortcut overlap ${width}`);
    await p.screenshot({path:`/tmp/disruption-strategy-${width}.png`});
  }
  await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForSelector('.airport-explorer input');await p.type('.airport-explorer input','JFK');await p.click('.airport-explorer form button');await p.waitForSelector('.airport-explorer .airport-pressure');
  assert.match(await p.$eval('.airport-explorer',e=>e.textContent),/Unknown/);
  assert.match(await p.$eval('.first-flight-help',e=>e.textContent),/booking email/);
  for(const width of [1440,390,320]){await p.setViewport({width,height:1000});await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await p.$eval('.home-about',e=>e.scrollWidth>e.clientWidth+1),false);await p.screenshot({path:`/tmp/disruption-simple-home-${width}.png`});}
  assert.deepEqual(errors,[]);
});
