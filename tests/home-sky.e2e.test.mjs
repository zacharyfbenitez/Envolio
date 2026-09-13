import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
test('home planes stay outside content throughout their flight paths', {timeout:180000},async t=>{
 const app=express();app.use(express.static('dist'));app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());
 const base=process.env.TEST_PUBLIC_URL||`http://127.0.0.1:${server.address().port}`;
 const page=await browser.newPage(),errors=[];await page.setBypassServiceWorker(true);page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname===new URL(base).hostname?r.continue():r.abort());
 for(const width of [1366,1440,1920,1024,390,320]){
  await page.setViewport({width,height:1000});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.finder-form');
  assert.equal(await page.$$eval('.sky-plane',es=>es.length),8);
  assert.equal(await page.$$eval('.sky-plane',es=>es.filter(e=>getComputedStyle(e).display!=='none').length),width<=1300?4:8);
  for(const fraction of [0,.125,.25,.375,.5,.625,.75,.875]){
   const overlaps=await page.evaluate(f=>{
    document.querySelectorAll('.sky-plane').forEach(e=>e.getAnimations().forEach(a=>{a.pause();const timing=a.effect.getTiming();a.currentTime=timing.delay+timing.duration*f;}));
    const r=document.createRange();r.selectNodeContents(document.querySelector('.hero h1'));
    const protectedRects=[...r.getClientRects(),document.querySelector('.flight-finder').getBoundingClientRect()];
    return [...document.querySelectorAll('.sky-plane')].filter(e=>getComputedStyle(e).display!=='none').filter(e=>{const a=e.getBoundingClientRect();return protectedRects.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);}).length;
   },fraction);
   assert.equal(overlaps,0,`No overlap at ${width}px, phase ${fraction}`);
  }
  await page.screenshot({path:`/tmp/envolio-${process.env.TEST_PUBLIC_URL?'public':'local'}-planes-${width}.png`});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await page.$eval('.sky-plane',e=>getComputedStyle(e).animationName),'none');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);
});
