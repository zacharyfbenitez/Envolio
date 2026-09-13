import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
test('saved cards show logos, snapshot timing and routes; rounded search focus stays visible', {timeout:180000},async t=>{
 const app=express();app.get('/api/airline-icon',(_req,res)=>res.type('svg').send('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#303758"/><text x="12" y="40" fill="white" font-size="24">PD</text></svg>'));app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=process.env.TEST_PUBLIC_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setBypassServiceWorker(true);
 await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).pathname.includes('/api/flights/')?r.respond({status:503,contentType:'application/json',body:'{"error":"Fixture: flight lookup not requested during layout QA"}'}):r.continue());
 const saved=[{ident:'PD604',date:'2026-09-14',key:'PD604|2026-09-14|LGA',origin:{code_iata:'LGA',city:'New York',timezone:'America/New_York'},destination:{code_iata:'YYZ',city:'Toronto',timezone:'America/Toronto'}},{ident:'AA4397',date:'2026-09-13',key:'AA4397|2026-09-13|JFK',origin:{code_iata:'JFK',city:'New York',timezone:'America/New_York'},destination:{code_iata:'BOS',city:'Boston',timezone:'America/New_York'},snapshot:{scheduled_out:'2026-09-13T19:30:00Z',estimated_out:'2026-09-13T19:50:00Z',scheduled_in:'2026-09-13T20:55:00Z',status:'Delayed',gate_origin:'42',checked_at:'2026-09-13T18:00:00Z'}}];
 await page.evaluateOnNewDocument(items=>localStorage.setItem('contrail.saved',JSON.stringify(items)),saved);
 for(const width of [1440,390,320]){
  await page.setViewport({width,height:1000});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.goto(base+'/dashboard',{waitUntil:'domcontentloaded'});await page.waitForSelector('.journey-card');
  assert.equal(await page.$$eval('.journey-card',es=>es.length),2);
  await page.waitForFunction(()=>[...document.querySelectorAll('.journey-carrier img')].length===2&&[...document.querySelectorAll('.journey-carrier img')].every(e=>e.complete&&e.naturalWidth>0));
  assert.match(await page.$eval('.journey-card',e=>e.textContent),/Porter Airlines/);
  assert.match(await page.$eval('.journey-card',e=>e.textContent),/Open for latest status/);
  assert.match(await page.$eval('.journey-card:nth-child(2)',e=>e.textContent),/Last seen: 20 min delayed/);
  assert.match(await page.$eval('.journey-card:nth-child(2)',e=>e.textContent),/3:50 PM/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/envolio-${process.env.TEST_PUBLIC_URL?'public':'local'}-saved-${width}.png`,fullPage:true});
 }
 await page.click('.remove-save');assert.equal(await page.$$eval('.journey-card',es=>es.length),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')).length),1);
 assert.ok(page.url().includes('/dashboard'));
 await page.click('.journey-main');await page.waitForFunction(()=>location.pathname.includes('/flight/AA4397'));
 assert.equal(new URL(page.url()).searchParams.get('destination'),'BOS');
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#flight-query');await page.focus('#flight-query');
 assert.equal(await page.$eval('#flight-query',e=>getComputedStyle(e).outlineStyle),'none');
 assert.notEqual(await page.$eval('.input-wrap',e=>getComputedStyle(e).boxShadow),'none');
 assert.ok(await page.$eval('.input-wrap',e=>parseFloat(getComputedStyle(e).borderRadius)>0));
 assert.deepEqual(errors,[]);
});
