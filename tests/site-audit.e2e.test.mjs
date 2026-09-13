import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('site-wide layout and traveler results states',{timeout:120000},async t=>{
 const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
 app.use((req,_res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
 app.get('/api/flights/:ident',(req,res)=>{
  if(req.params.ident==='ERROR1')return res.status(503).json({error:'Flight updates are temporarily unavailable.'});
  const payload=sq12Lookup('2026-09-15');payload.route_options=[];
  const f=payload.flights[0];
  payload.delay_index={score:32,on_time_probability:68,coverage_percent:48,factors:[{key:'route',label:'Route history',value:25,weight:.28,source:'Fixture history',detail:'Recent flights'},{key:'inbound',label:'Incoming aircraft',value:75,weight:.2,source:'Fixture rotation',detail:'Incoming plane running late'}],live_series:[{at:'2026-09-13T12:00:00Z',delay:32}],methodology:'Test fixture—not live data'};
  payload.inbound_aircraft={...f,ident:'SIA11',ident_iata:'SQ11',origin:f.destination,destination:f.origin,scheduled_in:'2026-09-15T18:00:00Z',estimated_in:'2026-09-15T19:30:00Z',actual_off:'2026-09-15T12:00:00Z',actual_in:null};
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
   await page.goto(base+route,{waitUntil:'networkidle0'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${route} at ${width}`);
   if(route==='/flight/SQ12'){
    await page.waitForSelector('.projected-delay');
    assert.equal(await page.$eval('.projected-delay strong',e=>e.textContent),'32%');
    assert.match(await page.$eval('.projected-delay',e=>e.textContent),/Experimental/);
    assert.deepEqual(await page.$$eval('.chance-explainer dt',es=>es.map(e=>e.textContent)),['Why','Reliability','Updated']);
    assert.match(await page.$eval('.inbound-summary',e=>e.textContent),/20 minutes after/);
    assert.equal(await page.$('.inbound-summary .mini-map'),null);
    await page.$eval('.projected-delay',e=>e.scrollIntoView());
    await page.screenshot({path:`/tmp/envolio-projected-${width}.png`});
   }
   if(['/flight/AIR1','/flight/LAND1','/flight/CANCEL1'].includes(route))assert.equal(await page.$('.projected-delay'),null);
  }
 }
 assert.deepEqual(errors,[]);
});
