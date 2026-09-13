import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {recentFlightLabel} from '../src/recent-flight-label.js';
test('recent flight names are familiar without inventing a major-carrier match',()=>{
 assert.equal(recentFlightLabel({ident:'PD604'}),'Porter 604');
 assert.equal(recentFlightLabel({ident:'SQ12'}),'Singapore Airlines 12');
 assert.equal(recentFlightLabel({ident:'YX4397',display_ident:'AA4397'}),'American 4397');
 assert.equal(recentFlightLabel({ident:'YX4397'}),'Flight 4397');
});
test('example scenarios are colorful, keyboard accessible and clearly not live', {timeout:180000},async t=>{
 const app=express();app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=process.env.TEST_PUBLIC_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setBypassServiceWorker(true);
 await page.evaluateOnNewDocument(()=>localStorage.setItem('envolio.recent-flights',JSON.stringify([{ident:'PD604',date:'2026-09-14',key:'PD604',origin:{code_iata:'LGA'},destination:{code_iata:'YYZ'}},{ident:'SQ12',date:'2026-09-14',key:'SQ12'}])));
 for(const width of [1440,390,320]){
  await page.setViewport({width,height:1100});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.scenario-showcase');
  assert.match(await page.$eval('.recent-flight-chips',e=>e.textContent),/Porter 604/);assert.match(await page.$eval('.recent-flight-chips',e=>e.textContent),/Singapore Airlines 12/);
  const colors=[];
  for(const [id,text] of [['delayed','Delayed 45 min'],['cancelled','Flight cancelled'],['on-time','On time']]){
   await page.focus(`.choice-${id}`);await page.keyboard.press('Enter');await page.waitForFunction(v=>document.querySelector('.scenario-status').textContent.includes(v),{},text);
   assert.match(await page.$eval('.showcase-heading',e=>e.textContent),/NOT LIVE FLIGHT DATA/);
   assert.equal(await page.$eval(`.choice-${id}`,e=>e.getAttribute('aria-pressed')),'true');
   colors.push(await page.$eval('.scenario-status>span',e=>getComputedStyle(e).color));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} fits ${width}`);
   if(width!==390)await page.$eval('.scenario-showcase',e=>e.scrollIntoView({block:'center'}));
   await page.$eval('.scenario-showcase',e=>e.scrollIntoView({block:'start'}));
   await (await page.$('.scenario-showcase')).screenshot({path:`/tmp/envolio-${process.env.TEST_PUBLIC_URL?'public':'local'}-scenario-${id}-${width}.png`});
  }
  assert.equal(new Set(colors).size,3);
 }
 await page.focus('.scenario-try');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'flight-query');
 await page.click('.recent-flight-chips button');assert.match(await page.$eval('#flight-query',e=>e.value),/^PD604/);
 assert.deepEqual(errors,[]);
});
