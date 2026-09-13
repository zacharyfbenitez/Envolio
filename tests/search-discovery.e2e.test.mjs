import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import express from 'express';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('guided search clarifies airline/airports, offers real returned legs and keeps route date explicit',{timeout:120000},async t=>{
 const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
 app.use((req,_res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
 app.use('/api',(_req,res)=>res.status(503).json({error:'No live providers in browser tests'}));
 app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];let lookupCalls=0,routeQuery='';
 await page.setBypassServiceWorker(true);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=new URL(r.url());
  if(u.pathname.endsWith('/api/flights/SQ12')){lookupCalls++;return r.respond({status:200,contentType:'application/json',body:JSON.stringify(sq12Lookup(u.searchParams.get('date')))});}
  if(u.pathname.endsWith('/api/flight-search')){routeQuery=u.search;return r.respond({status:200,contentType:'application/json',body:JSON.stringify({source:'FlightAware published schedules',flights:[{ident:'AA100',origin:{code_iata:'JFK',timezone:'America/New_York'},destination:{code_iata:'LHR'},scheduled_out:'2027-03-05T23:00:00Z'},{ident:'BA112',origin:{code_iata:'JFK',timezone:'America/New_York'},destination:{code_iata:'LHR'},scheduled_out:'2027-03-05T22:00:00Z'}]})});}
  if(u.pathname.includes('/api/'))return r.respond({status:503,contentType:'application/json',body:'{"error":"Test: no enrichment available"}'});
  if(u.hostname!=='127.0.0.1')return r.abort();
  return r.continue();
 });
 const home=async()=>{await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#flight-query');};
 const type=async q=>{await page.$eval('#flight-query',el=>el.focus());await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.type('#flight-query',q);};
 await home();await type('100');assert.match(await page.$eval('.finder-followup',e=>e.textContent),/Which airline/);
 await page.type('#finder-airline','American');await page.click('.finder-followup button');assert.match(await page.$eval('.finder-understood',e=>e.textContent),/AA100/);
 await type('SQ12');await page.$eval('.finder-form',f=>f.requestSubmit());await page.waitForSelector('.finder-match');assert.equal((await page.$$('.finder-match')).length,2);
 await page.$$eval('.finder-match',buttons=>buttons.find(b=>b.textContent.includes('NRT → LAX')).click());await page.waitForSelector('.flight-title');
 assert.match(page.url(),/origin=NRT/);assert.match(page.url(),/destination=LAX/);assert.equal(lookupCalls,1,'exact leg hands off its fetched payload without a second lookup');
 await home();await type('New York to London');
 await page.$eval('#finder-from',el=>el.parentElement.querySelector('button').click());
 await page.$eval('#finder-to',el=>el.parentElement.querySelector('button').click());
 await page.$eval('#finder-date',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'2027-03-05');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.$eval('.finder-form',f=>f.requestSubmit());await page.waitForSelector('.finder-match');assert.match(routeQuery,/origin=JFK/);assert.match(routeQuery,/destination=LHR/);assert.match(routeQuery,/date=2027-03-05/);
 assert.equal((await page.$$('.finder-match')).length,2);assert.match(await page.$eval('.finder-results',e=>e.textContent),/FlightAware published schedules/);
 assert.equal((await page.$$('.finder-match .carrier-logo')).length,2,'Every route option has an airline identity');
 assert.equal((await page.$$('.finder-match.status-scheduled')).length,2,'Schedule-only discovery is not falsely green');
 for(const width of [1440,390,320]){
  await page.setViewport({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page fits ${width}`);
  assert.equal(await page.$eval('.finder-form',e=>e.scrollWidth<=e.clientWidth+1),true,`form fits ${width}`);
  if(process.env.SEARCH_SCREENSHOTS)await page.screenshot({path:`/workspace/search-discovery-${width}.png`});
 }
 await type('AA100 and BA1511');assert.equal((await page.$$('.finder-followup button')).length,2);
 await type('AA100 03/04/2027');assert.match(await page.$eval('.finder-date-warning',e=>e.textContent),/two different/);
 assert.deepEqual(errors,[]);
});
