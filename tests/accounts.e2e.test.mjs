import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('configured accounts require sign-in to Watch, preserve local saves, and explain email delivery availability',{timeout:180000},async t=>{
 const app=express();app.use(express.static('dist'));app.use((_q,s)=>s.sendFile(process.cwd()+'/dist/index.html'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:390,height:844});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);console.log('Account QA: browser ready');
 let authAvailable=false,rows=[];
 const uid='11111111-1111-4111-8111-111111111111',user={id:uid,email:'traveler@example.com',aud:'authenticated'},token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url()),reply=(body,status=200)=>r.respond({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,x-client-info,content-type,prefer,x-supabase-api-version','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'},body:JSON.stringify(body)});
  if(u.pathname==='/api/accounts/config')return reply({enabled:true,url:'https://qa.supabase.co',publishableKey:'sb_publishable_fixture',emailReady:false});
  if(u.hostname==='qa.supabase.co'){
   if(r.method()==='OPTIONS')return reply({});
   if(!authAvailable)return reply({error:'Controlled auth unavailable'},503);
   if(u.pathname.endsWith('/verify'))return reply({access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});
   if(u.pathname.endsWith('/user'))return reply(user);
   if(u.pathname.endsWith('/saved_flights')){assert.equal(r.headers().authorization,`Bearer ${token}`);if(r.method()==='POST'){const body=JSON.parse(r.postData());assert.equal(body.user_id,uid);rows=[{journey:body.journey}];}return reply(rows);}
   if(u.pathname.endsWith('/notification_preferences'))return reply(null);
   return reply({});
  }
  if(u.pathname==='/api/flights/SQ12')return reply(sq12Lookup('2026-09-15'));
  if(u.pathname.startsWith('/api/'))return reply({error:'Unavailable'},503);return u.hostname==='127.0.0.1'?r.continue():r.abort();
 });
 await p.goto(`http://127.0.0.1:${server.address().port}/flight/SQ12?date=2026-09-15`);await p.waitForSelector('.flight-summary');await p.waitForFunction(()=>document.querySelector('.site-nav')?.textContent.includes('Sign in'));
 console.log('Account QA: sign-in available');await p.click('.alerts-button');await p.waitForSelector('.account-dialog');assert.equal(await p.$('.alert-sheet'),null,'Do not stack notification and sign-in dialogs');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')||'[]').length),0);
 await p.type('.account-dialog input','traveler@example.com');await p.click('.account-dialog form>button');await p.waitForFunction(()=>document.querySelector('.account-dialog')?.textContent.includes('could not send a code'));
 console.log('Account QA: auth error recovered');authAvailable=true;await p.click('.account-dialog form>button');await p.waitForSelector('[autocomplete="one-time-code"]');await p.type('[autocomplete="one-time-code"]','123456');await p.click('.account-dialog form>button');await p.waitForFunction(()=>!document.querySelector('.account-dialog'));console.log('Account QA: authenticated');
 await p.waitForFunction(()=>document.querySelector('.site-nav')?.textContent.includes('Account'));await p.click('.alerts-button');await p.waitForSelector('.alert-sheet');await p.waitForFunction(()=>document.querySelector('.alert-sheet')?.textContent.includes('Background email delivery is not available yet'));
 assert.equal(rows.length,1);assert.equal(rows[0].journey.ident,'SQ12');await p.keyboard.press('Escape');await p.click('.pwa-dock button:last-child');await p.waitForSelector('.journey-card');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
});
