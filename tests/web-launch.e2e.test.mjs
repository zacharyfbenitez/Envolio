import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('web launch: contained search, saved flights, recovery and keyboard alerts',{timeout:120000},async t=>{
 const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173';
 app.use((req,res,next)=>{if(req.url.startsWith(prefix))req.url=req.url.slice(prefix.length)||'/';next();});
 app.get('/api/flights/SQ12',(_req,res)=>res.json(sq12Lookup('2026-09-14')));
 app.use('/api',(_req,res)=>res.status(503).json({error:'Temporarily unavailable'}));
 app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setBypassServiceWorker(true);
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:900});await page.goto(base);await page.waitForSelector('#flight-query');
  assert.ok(await page.$eval('.home-kicker',e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.height>24&&r.height<50&&r.left>=p.left&&r.right<=p.right&&e.scrollWidth<=e.clientWidth;}),`headline badge visible and contained at ${width}`);
  assert.ok(await page.$eval('.finder-form',e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),`finder containment ${width}`);
  assert.ok(await page.$eval('.home-page',home=>{
   const bounds=home.getBoundingClientRect();let previous=null;
   return [...home.children].filter(e=>e.tagName==='SECTION').every(section=>{
    const box=section.getBoundingClientRect(),ok=Math.abs(box.left-bounds.left)<2&&Math.abs(box.right-bounds.right)<2&&(!previous||box.top>=previous.bottom+20);
    previous=box;return ok;
   });
  }),`homepage sections align and do not overlap at ${width}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`homepage fits ${width}`);
  assert.equal(await page.$eval('.dock-shelf',e=>getComputedStyle(e).display),width>=768?'none':'block',`dock visibility at ${width}`);
  await page.focus('#flight-query');assert.equal(await page.$eval('.pwa-dock',e=>getComputedStyle(e).visibility),'hidden');
 }
 await page.setViewport({width:320,height:740});await page.goto(base);await page.waitForSelector('.finder-submit');assert.ok(await page.$eval('.finder-submit',e=>e.getBoundingClientRect().bottom<=document.querySelector('.dock-shelf').getBoundingClientRect().top-8),'primary search action fits above the dock on a short phone viewport');await page.evaluate(()=>scrollTo(0,500));await page.waitForFunction(()=>document.querySelector('.dock-shelf')?.dataset.hidden==='true');
 await page.evaluate(()=>localStorage.setItem('contrail.saved',JSON.stringify([{ident:'SQ12',date:'2026-09-14',key:'SQ12|2026-09-14',origin:{code_iata:'NRT'},destination:{code_iata:'LAX'}}])));
 await page.goto(base+'/dashboard');await page.waitForSelector('.saved-page .saved-main');assert.match(await page.$eval('.saved-main',e=>e.textContent),/SQ12/);
 await page.click('.remove-save');assert.match(await page.$eval('.saved-page',e=>e.textContent),/No saved flights yet/);
 await page.goto(base+'/flight/ZZ999?date=2026-12-14&origin=JFK');await page.waitForSelector('.error-panel');await page.$$eval('.error-panel button',es=>es.find(e=>e.textContent.includes('Edit search')).click());await page.waitForSelector('#flight-query');assert.equal(await page.$eval('#flight-query',e=>e.value),'ZZ999');assert.equal(await page.$eval('input[type=date]',e=>e.value),'2026-12-14');
 await page.goto(base+'/flight/SQ12?date=2026-09-14&origin=NRT');await page.waitForSelector('.alerts-button');await page.click('.alerts-button');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('.alert-sheet')));await page.keyboard.press('Escape');assert.equal(await page.$('.alert-sheet'),null);
 assert.deepEqual(errors,[]);
});
