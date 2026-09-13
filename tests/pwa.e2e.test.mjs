import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {readFile} from 'node:fs/promises';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';

test('PWA manifest, glass navigation, scoped offline shell and saved flight fallback',{timeout:120000},async t=>{
 const app=express(),prefix='/p/bUpWZzvZpIOeEaBV-xsmW/5173/';
 app.use((req,res,next)=>{if(req.url.startsWith(prefix))req.url='/'+req.url.slice(prefix.length);next();});
 app.use('/api',(req,res)=>res.status(503).json({error:'Offline test: live data unavailable'}));
 app.use(express.static('dist'));
 app.use((_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}${prefix}`;
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu','--renderer-process-limit=2']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2,hasTouch:true});
 await page.goto(base,{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:20000});
 assert.equal(await page.evaluate(async()=> (await navigator.serviceWorker.ready).scope),base);
 const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
 assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 assert.equal(manifest.short_name,'Envolio');
 assert.match(await page.title(),/Envolio/);
 assert.equal(await page.$eval('.site-nav .brand',el=>el.textContent.trim()),'ENVOLIO');
 assert.ok(await page.$eval('.pwa-dock',el=>{const r=el.getBoundingClientRect();return r.top>innerHeight-120&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
 for(const icon of manifest.icons){
  const png=await readFile('dist/'+icon.src);assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
 }
 await page.click('.pwa-dock button:last-child');
 assert.equal(await page.$eval('.pwa-menu',el=>el.open),true);
 assert.match(await page.$eval('.pwa-menu',el=>el.textContent),/Add to Home Screen|Install Envolio/);
 assert.ok(await page.$eval('.pwa-menu',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));
 if(process.env.PWA_SCREENSHOTS)await page.screenshot({path:'/workspace/pwa-mobile-menu.png'});
 await page.keyboard.press('Escape');
 t.diagnostic('Menu and icons checked');
 await page.click('.pwa-dock button:nth-child(2)');
 await page.waitForFunction(()=>{const r=document.querySelector('.saved-section').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0});
 const date='2026-09-13',payload=sq12Lookup(date,'NRT');
 await page.evaluate(({date,payload})=>localStorage.setItem(`contrail.lookup.SQ12.${date}.NRT.`,JSON.stringify(payload)),{date,payload});
 await page.setOfflineMode(true);
 // Chromium's network-rule emulation can leave navigator.onLine true across
 // a worker-served navigation. Model the browser's offline signal as well.
 await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
 t.diagnostic('Navigating offline to saved flight');
 await page.goto(`${base}flight/SQ12?date=${date}&origin=NRT`,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.flight-title',{timeout:15000});
 t.diagnostic('Saved flight rendered offline');
 assert.match(await page.$eval('body',el=>el.textContent),/Saved flight data/);
 assert.match(await page.$eval('.pwa-offline',el=>el.textContent),/out of date/);
 const cached=await page.evaluate(async()=>{const result=[];for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())result.push(req.url);return result;});
 assert.ok(cached.length>=9);assert.ok(cached.every(url=>!url.includes('/api/')));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.hero');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.PWA_SCREENSHOTS)await page.screenshot({path:'/workspace/pwa-mobile-home.png'});
 await page.setViewport({width:1440,height:1000});
 if(process.env.PWA_SCREENSHOTS)await page.screenshot({path:'/workspace/pwa-desktop-home.png'});
 assert.deepEqual(errors,[]);
});
