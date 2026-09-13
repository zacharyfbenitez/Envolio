import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';

test('main-site polish: compact inbound-first results, codeshares and no video', {timeout:180000}, async t => {
 const app=express();
 const prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
 app.use((req,_res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
 app.get('/api/flights/:ident',(_req,res)=>{
  const data=sq12Lookup('2026-09-15');
  data.flights[0].ident_iata='YX4397';data.flights[0].operator='Republic Airways';
  data.flights[0].estimated_out=new Date(Date.parse(data.flights[0].scheduled_out)+20*60000).toISOString();
  data.refreshed_at=new Date().toISOString();
  data.inbound_aircraft={ident:'RPA4633',status:'En Route',origin:data.flights[0].destination,destination:data.flights[0].origin,scheduled_in:new Date(Date.now()+3600000).toISOString(),estimated_in:new Date(Date.now()+4920000).toISOString()};
  data.diagnostics={...data.diagnostics,match_type:'codeshare'};data.route_options=[];
  res.json(data);
 });
 app.use('/api',(_req,res)=>res.status(503).json({error:'Fixture provider unavailable'}));
 app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [320,390,1440]){
  console.info(`[polish] Layout at ${width}px`);
  await page.setViewport({width,height:1000});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.home-showcase');
  await page.$eval('.home-showcase',e=>e.scrollIntoView());
  assert.equal(await page.$('.airport-backdrop'),null,'Video background is removed');
  assert.equal(await page.$('video'),null);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.$$eval('.seo-links button',es=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=14)));
  if(process.env.POLISH_SCREENSHOTS)await page.screenshot({path:`/tmp/envolio-polished-home-${width}.png`,fullPage:true});
  await page.goto(base+'/flight/AA4397?date=2026-09-15',{waitUntil:'domcontentloaded'});await page.waitForSelector('.flight-title h1').catch(error=>{throw new Error(`${error.message}; browser errors: ${errors.join('; ')}`);});
  assert.equal(await page.$eval('.flight-title h1',e=>e.textContent),'AA4397');
  assert.match(await page.$eval('.carrier-identity',e=>e.textContent),/operated as YX4397/);
  assert.equal(await page.$eval('.inbound-details',e=>e.open),false);
  assert.equal(await page.$eval('.inbound-arrival-status',e=>e.textContent),'Expected 22 min late');
  assert.equal(await page.$eval('.route-main .freshness-badge',e=>e.textContent),'Delayed 20 min');
  assert.equal(await page.$eval('.chance-details',e=>e.open),false);
  assert.ok(await page.evaluate(()=>document.querySelector('.inbound-summary').getBoundingClientRect().top<document.querySelector('.result-brief').getBoundingClientRect().top),'Incoming plane before advice and risk');
  await page.click('.inbound-details>summary');
  assert.equal(await page.$eval('.inbound-details',e=>e.open),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.POLISH_SCREENSHOTS)await page.screenshot({path:`/tmp/envolio-polished-result-${width}.png`,fullPage:true});
 }
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 console.info('[polish] No video with motion enabled either');
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.home-showcase');await page.$eval('.home-showcase',e=>e.scrollIntoView());
 assert.equal(await page.$('video'),null);
 await page.hover('.example-flight');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.example-flight')).transform!=='none');
 assert.deepEqual(errors,[]);
});
