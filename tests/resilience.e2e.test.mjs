import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';

test('privacy-restricted storage, corrupt preferences, empty data and keyboard settings remain usable', {timeout:120000}, async t=>{
 const app=express();app.use(express.static('dist'));app.use((_q,s)=>s.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());
 for(const mode of ['blocked','corrupt','empty']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:320,height:720,isMobile:true,hasTouch:true});await page.setBypassServiceWorker(true);
  await page.evaluateOnNewDocument(mode=>{
   localStorage.clear();
   if(mode==='blocked'){Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw new DOMException('Storage blocked','SecurityError');};}
   if(mode==='corrupt'){localStorage.setItem('contrail.saved','{');localStorage.setItem('contrail.alerts.SQ12.2026-09-15','"invalid preferences"');}
  },mode);
  await page.setRequestInterception(true);page.on('request',r=>{
   const u=new URL(r.url());if(u.pathname.startsWith('/api/'))return r.respond({status:u.pathname==='/api/flights/SQ12'?200:503,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/flights/SQ12'?(mode==='empty'?{flights:[]}:sq12Lookup('2026-09-15')):{error:'Unavailable in fixture'})});
   return u.hostname==='127.0.0.1'?r.continue():r.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/flight/SQ12?date=2026-09-15`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector(mode==='empty'?'.error-panel':'.flight-summary',{timeout:30000}).catch(async error=>{console.log(JSON.stringify({mode,errors,text:await page.evaluate(()=>document.body.innerText)}));throw error;});
  if(mode!=='empty'){
   await page.click('.alerts-button');await page.waitForSelector('.alert-sheet');
   await page.click('.alert-options label:nth-child(2)');
   for(let i=0;i<16;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('.alert-sheet').contains(document.activeElement)),'Focus stays inside settings');}
   await page.keyboard.press('Escape');assert.equal(await page.$('.alert-sheet'),null);
   assert.ok(await page.evaluate(()=>document.activeElement?.classList.contains('alerts-button')),'Focus returns to Watch');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[],mode);await page.close();
 }
});
