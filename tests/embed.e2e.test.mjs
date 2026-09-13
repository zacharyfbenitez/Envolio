import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import express from 'express';
import puppeteer from 'puppeteer-core';
import net from 'node:net';
test('standalone cross-site embed: mobile, parameters, risk, fallback and frame protection',{timeout:60000},async t=>{
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await new Promise(r=>socket.once('listening',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),PUBLIC_BASE:'/',FLIGHTAWARE_API_KEY:''},stdio:'ignore'});t.after(()=>server.kill());const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<50;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const headers=(await fetch(base+'/embed')).headers;assert.equal(headers.get('x-frame-options'),null);assert.match(headers.get('content-security-policy'),/frame-ancestors https:/);assert.equal((await fetch(base+'/')).headers.get('x-frame-options'),'DENY');assert.equal((await fetch(base+'/embed.html')).headers.get('x-frame-options'),null);
 const parent=express();parent.get('/',(_req,res)=>res.send(`<iframe title="Flight delay checker" src="${base}/embed?flight=AA4397&date=2026-09-13" style="border:0;width:100%;height:1100px" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>`));
 const host=parent.listen(0);await new Promise(r=>host.once('listening',r));t.after(()=>host.close());
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let state='success',requests=0;
 await page.setRequestInterception(true);page.on('request',r=>{
  if(r.url().includes('/api/flights/')){requests++;assert.match(r.url(),/AA4397\?date=2026-09-13/);if(state==='error')return r.respond({status:429,contentType:'application/json',body:'{}'});
   const payload={flights:[{ident_iata:'AA4397',origin:{code_iata:'JFK'},destination:{code_iata:'BOS'},status:'Scheduled'}],refreshed_at:new Date().toISOString(),delay_index:{score:46,factors:[{value:46,weight:1,detail:'Incoming plane may arrive late'}],operational_warnings:[{airport:'JFK',title:'Earlier storms may affect incoming flights'}]}};
   if(state==='future')payload.schedule_only=true;if(state==='cached')payload.cache_fallback={active:true};
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  }return ['127.0.0.1','localhost'].includes(new URL(r.url()).hostname)?r.continue():r.abort();
 });
 for(const width of [320,390,900]){
  await page.setViewport({width,height:1200});await page.goto(`http://localhost:${host.address().port}`,{waitUntil:'networkidle0'});const frame=page.frames().find(f=>f.url().includes('/embed?'));assert.ok(frame);assert.equal(await frame.$eval('#percent',e=>e.textContent),'46%');assert.match(await frame.$eval('#reliability',e=>e.textContent),/Experimental/);assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await frame.$$eval('script',es=>es.length),1);
  await page.screenshot({path:`/tmp/envolio-embed-${width}.png`});
 }
 const frame=page.frames().find(f=>f.url().includes('/embed?'));
 for(const mode of ['future','cached','error']){state=mode;await frame.click('#check');await frame.waitForFunction(()=>!document.querySelector('#check').disabled);if(mode==='error')assert.match(await frame.$eval('#message',e=>e.textContent),/wait a minute/);else assert.equal(await frame.$eval('#risk',e=>e.hidden),true);}
 assert.ok(requests>=6);assert.deepEqual(errors,[]);
});
