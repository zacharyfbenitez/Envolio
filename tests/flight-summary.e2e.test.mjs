import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('compact summary distinguishes reported times, forecasts and planning; floating mobile dock',{timeout:180000},async t=>{
 const date=new Date(Date.now()+86400000*2).toISOString().slice(0,10),next=new Date(Date.now()+86400000*3).toISOString().slice(0,10),data=sq12Lookup(date);
 data.route_options=[];data.refreshed_at=new Date().toISOString();
 Object.assign(data.flights[0],{origin:{code_iata:'JFK',city:'New York',timezone:'America/New_York'},destination:{code_iata:'HND',city:'Ota',timezone:'Asia/Tokyo'},scheduled_out:`${date}T23:00:00Z`,estimated_out:`${date}T23:00:00Z`,scheduled_in:`${next}T13:00:00Z`,estimated_in:`${next}T13:00:00Z`});
 data.inbound_aircraft={...data.flights[0],ident_iata:'SQ11',actual_in:`${date}T20:00:00Z`};
 data.delay_index={score:23,on_time_probability:77,coverage_percent:30,factors:[{key:'origin_weather',label:'Departure weather',value:40,weight:1,detail:'Cloud ceiling 500 ft'}],operational_warnings:[{airport:'JFK',kind:'flight_weather',title:'Cloud ceiling as low as 500 ft near flight time',detail:'May slow arrivals and departures; delay not confirmed.',source:'NOAA TAF fixture'}]};
 const app=express();app.use(express.static('dist'));app.use((_q,r)=>r.sendFile(process.cwd()+'/dist/index.html'));const server=app.listen(0);await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=process.env.TEST_PUBLIC_URL||`http://localhost:${server.address().port}`,browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setBypassServiceWorker(true);
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))return r.respond({status:u.pathname==='/api/flights/SQ12'?200:503,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/flights/SQ12'?data:{error:'Test source unavailable'})});return u.hostname===new URL(base).hostname?r.continue():r.abort();});
 for(const width of [390,320,430,1440]){
  await page.setViewport({width,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('input[type=date]');
  assert.ok(await page.$eval('input[type=date]',e=>{const r=e.getBoundingClientRect(),p=e.closest('form').getBoundingClientRect();return r.right<=p.right-10&&r.left>=p.left&&e.scrollWidth<=e.clientWidth+2;}));
  assert.ok(await page.$eval('.pwa-dock',e=>e.getBoundingClientRect().height<=56));assert.equal(await page.$eval('.dock-shelf',e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.screenshot({path:`/tmp/envolio-summary-home-${width}.png`});
  await page.goto(`${base}/flight/SQ12?date=${date}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.flight-summary');
  const summary=await page.$eval('.flight-summary',e=>e.textContent);assert.match(summary,/Reported departure/);assert.match(summary,/Envolio delay outlook.*23%/);assert.match(summary,/Tokyo–Haneda/);assert.match(summary,/\+1 day/);assert.doesNotMatch(summary,/Ota|Favorite/);
  assert.ok(await page.$eval('.everyday-chance h3 strong',e=>e.getBoundingClientRect().bottom<document.querySelector('.dock-shelf').getBoundingClientRect().top),'Delay percentage stays above the dock on the first screen');
  assert.equal(await page.$eval('.route-track',e=>getComputedStyle(e).display),'none');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.$eval('.operational-warnings>summary',e=>e.textContent),/1 update$/);
  await page.screenshot({path:`/tmp/envolio-summary-result-${width}.png`});
  await page.$$eval('details',es=>es.find(e=>e.firstElementChild?.textContent==='Departure timeline').open=true);
  assert.equal(await page.$$eval('.timeline-steps>div',es=>es.find(e=>e.textContent.includes('Plane preparation')).querySelector('b').textContent),'After gate arrival');
  await page.click('.alerts-button');await page.waitForSelector('.alert-sheet');assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')).some(f=>f.ident==='SQ12')));await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);
});
