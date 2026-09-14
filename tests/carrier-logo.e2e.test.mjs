import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
import {carrierName} from '../src/carrier-name.js';
test('Porter uses a familiar name without changing flight identity',()=>{
 assert.equal(carrierName({operator:'POE',ident_iata:'PD604'}),'Porter Airlines');
 assert.equal(carrierName({operator:'POE',operator_iata:'PD'}),'Porter Airlines');
 assert.equal(carrierName({operator:'Published Airline',ident_iata:'AA100'}),'Published Airline');
});
test('African ICAO operators use traveler-facing airline names',()=>{
 assert.equal(carrierName({operator:'KQA',operator_icao:'KQA',ident_iata:'KQ762'}),'Kenya Airways');
 assert.equal(carrierName({operator:'APK',operator_icao:'APK',ident_icao:'APK7538'}),'Air Peace');
 assert.equal(carrierName({operator:'SAA',operator_icao:'SAA',ident_iata:'SA303'}),'South African Airways');
});
test('airline artwork stays square, rounded and uncropped on phone and desktop',{timeout:180000},async t=>{
 const app=express();app.use(express.static('dist'));app.use((_q,s)=>s.sendFile(process.cwd()+'/dist/index.html'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setBypassServiceWorker(true);await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const data=sq12Lookup('2026-09-15');data.route_options=[];Object.assign(data.flights[0],{ident:'POE604',ident_iata:'PD604',operator:'POE',operator_iata:'PD'});
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/airline-icon')return r.respond({status:404});if(u.hostname==='images.kiwi.com')return r.respond({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" fill="#173f69"/><text x="5" y="28" fill="white" font-size="25">Porter</text></svg>'});if(u.pathname.startsWith('/api/'))return r.respond({status:u.pathname==='/api/flights/PD604'?200:503,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/flights/PD604'?data:{error:'Fixture unavailable'})});return u.hostname==='127.0.0.1'?r.continue():r.abort();});
 for(const width of [320,390,1440]){await p.setViewport({width,height:844});await p.goto(`http://127.0.0.1:${server.address().port}/flight/PD604?date=2026-09-15`,{waitUntil:'domcontentloaded'});await p.waitForSelector('.flight-summary .carrier-logo[data-artwork="airline"] img');await p.waitForFunction(()=>document.querySelector('.flight-summary .carrier-logo img')?.naturalWidth>0);
  assert.match(await p.$eval('.flight-title',e=>e.textContent),/Porter Airlines/);
  const metrics=await p.$eval('.flight-summary .carrier-logo',el=>{const r=el.getBoundingClientRect(),img=el.querySelector('img'),ir=img.getBoundingClientRect();return {width:r.width,height:r.height,radius:getComputedStyle(el).borderRadius,fit:getComputedStyle(img).objectFit,contained:ir.width<=r.width+.5&&ir.height<=r.height+.5};});assert.ok(metrics.width>=30);assert.equal(metrics.width,metrics.height);assert.equal(metrics.radius,'22%');assert.equal(metrics.fit,'contain');assert.equal(metrics.contained,true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`/tmp/porter-logo-${width}.png`});
 }assert.deepEqual(errors,[]);
});
