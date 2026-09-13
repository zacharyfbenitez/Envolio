import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
import {scoreAudit,airportIndicators,historicalTrend} from '../risk-audit.js';
test('site-wide layout and traveler results states',{timeout:120000},async t=>{
 const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
 app.use((req,_res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
 app.get('/api/flights/:ident',(req,res)=>{
  if(req.params.ident==='ERROR1')return res.status(503).json({error:'Flight updates are temporarily unavailable.'});
  const payload=sq12Lookup('2026-09-15');payload.route_options=[];
  const f=payload.flights[0];
  payload.delay_index={score:32,on_time_probability:68,coverage_percent:48,factors:[{key:'route',label:'Route history',value:25,weight:.28,source:'Fixture history',detail:'Recent flights'},{key:'inbound',label:'Incoming aircraft',value:75,weight:.2,source:'Fixture rotation',detail:'Incoming plane running late'}],live_series:[{at:'2026-09-13T12:00:00Z',delay:32}],methodology:'Test fixture—not live data'};
  payload.inbound_aircraft={...f,ident:'SIA11',ident_iata:'SQ11',origin:f.destination,destination:f.origin,scheduled_in:'2026-09-15T18:00:00Z',estimated_in:'2026-09-15T19:30:00Z',actual_off:'2026-09-15T12:00:00Z',actual_in:null};
  if(req.params.ident==='SQ12')payload.delay_index.operational_warnings=[{kind:'earlier_weather',airport:'NRT',title:'Earlier weather may affect incoming flights',detail:'Earlier storms may affect your aircraft. Carry-over is not confirmed.',source:'Fixture TAF'}];
  payload.delay_index.audit=scoreAudit(payload.delay_index);
  payload.delay_index.airport_indicators=airportIndicators(f,null,null,null);
  payload.delay_index.historical_trend=historicalTrend([]);
  payload.aircraft_rotation={legs:[payload.inbound_aircraft],warnings:['Earlier aircraft assignment unavailable']};
  payload.takeoff_slot=req.params.ident==='SQ12'?{status:'revised',authority:'FAA',kind:'EDCT',assigned_time:new Date(Date.now()+3600000).toISOString(),previous_time:new Date(Date.now()+1800000).toISOString(),verified_at:new Date().toISOString(),provider:'Synthetic test fixture',notice:'Not gate departure or takeoff clearance.'}:{status:'unavailable',assigned_time:null,reason:'Authorized source not connected.'};
  if(req.params.ident==='AIR1'){f.actual_out='2026-09-15T19:10:00Z';f.actual_off='2026-09-15T19:20:00Z';f.status='En Route';}
  if(req.params.ident==='LAND1'){f.actual_out='2026-09-15T19:10:00Z';f.actual_in='2026-09-16T05:50:00Z';f.status='Arrived';f.baggage_claim='7';}
  if(req.params.ident==='CANCEL1'){f.cancelled=true;f.status='Cancelled';}
  res.json(payload);
 });
 app.use('/api',(_req,res)=>res.status(503).json({error:'Additional sources unavailable in this fixture'}));
 app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [320,768,1440]){
  await page.setViewport({width,height:1000});
  for(const route of ['/','/dashboard','/routes/JFK-LHR','/airports/JFK/delays','/premium','/developers','/flight/SQ12','/flight/AIR1','/flight/LAND1','/flight/CANCEL1','/flight/ERROR1']){
   await page.goto(base+route,{waitUntil:'domcontentloaded'});
   await page.waitForSelector(route.includes('ERROR1')?'.error-panel':route.startsWith('/flight/')?'.detail-shell':'main');
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${route} at ${width}`);
   if(route==='/flight/SQ12'){
    await page.waitForSelector('.projected-delay');
    assert.equal(await page.$eval('.projected-delay strong',e=>e.textContent),'32%');
    assert.match(await page.$eval('.projected-delay',e=>e.textContent),/Experimental/);
    assert.match(await page.$eval('.operational-warnings',e=>e.textContent),/Earlier weather/);
    assert.deepEqual(await page.$$eval('.chance-explainer dt',es=>es.map(e=>e.textContent)),['Why','Reliability','Updated']);
    assert.match(await page.$eval('.inbound-summary',e=>e.textContent),/20 minutes after/);
    assert.ok(await page.evaluate(()=>document.querySelector('.flight-title').getBoundingClientRect().top<document.querySelector('.next-step-card').getBoundingClientRect().top),'Flight identity precedes advice');
    assert.ok(await page.evaluate(()=>document.querySelector('.projected-delay').getBoundingClientRect().top<document.querySelector('.operational-warnings').getBoundingClientRect().top),'Estimate precedes supporting warnings');
    assert.equal(await page.$eval('.flight-analysis',e=>e.open),false);
    await page.$eval('.flight-analysis',e=>e.open=true);
    assert.equal(await page.$('.inbound-summary .mini-map'),null);
    await page.$$eval('.risk-context details',es=>es.forEach(e=>e.open=true));
    assert.match(await page.$eval('.risk-audit',e=>e.textContent),/Live aircraft/);
    assert.ok(await page.$('.aircraft-chain'));
    assert.match(await page.$eval('.takeoff-slot.assigned',e=>e.textContent),/Assigned takeoff time/);
    assert.match(await page.$eval('.takeoff-slot.assigned',e=>e.textContent),/Not gate departure/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Expanded risk audit overflow at ${width}`);
    await page.$eval('.projected-delay',e=>e.scrollIntoView());
    await page.screenshot({path:`/tmp/envolio-projected-${width}.png`});
   }
   if(['/flight/AIR1','/flight/LAND1','/flight/CANCEL1'].includes(route))assert.equal(await page.$('.projected-delay'),null);
  }
 }
 assert.deepEqual(errors,[]);
});
