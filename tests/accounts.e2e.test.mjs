import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import puppeteer from 'puppeteer-core';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
test('accounts: verified signup, favorites, saving, profile editing, friends, travel log and privacy',{timeout:300000},async t=>{
 const app=express();app.use(express.static('dist'));app.use((_q,s)=>s.sendFile(process.cwd()+'/dist/index.html'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});t.after(()=>browser.close());const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:390,height:844});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);console.log('Account QA: browser ready');
 let authAvailable=false,rows=[],profile=null,contact=null,logs=[],requested=false;const network=[];p.on('requestfailed',r=>network.push({failed:r.url(),reason:r.failure()?.errorText}));p.on('console',m=>{if(m.type()==='error')network.push({console:m.text()});});
 const uid='11111111-1111-4111-8111-111111111111',user={id:uid,email:'traveler@example.com',aud:'authenticated'},token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url()),reply=(body,status=200)=>r.respond({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,x-client-info,content-type,prefer,x-supabase-api-version,accept-profile,content-profile,x-retry-count','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'},body:JSON.stringify(body)});
  if(u.pathname==='/api/accounts/config')return reply({enabled:true,url:'https://qa.supabase.co',publishableKey:'sb_publishable_fixture',emailReady:false});
  if(u.hostname==='qa.supabase.co'){
   network.push({method:r.method(),path:u.pathname,headers:r.method()==='OPTIONS'?r.headers():undefined});
   if(r.method()==='OPTIONS')return reply({});
   if(!authAvailable)return reply({error:'Controlled auth unavailable'},503);
   if(u.pathname.endsWith('/verify'))return reply({access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});
   if(u.pathname.endsWith('/user'))return reply(user);
   if(u.pathname.endsWith('/traveler_profiles')){if(r.method()==='PATCH')profile={...profile,...JSON.parse(r.postData())};return reply(profile);}
   if(u.pathname.endsWith('/account_contacts'))return reply({phone:contact});
   if(u.pathname.endsWith('/profile_blocks'))return reply([]);
   if(u.pathname.endsWith('/find_traveler'))return reply({user_id:'22222222-2222-4222-8222-222222222222',handle:'jamie_flies',display_name:'Jamie',avatar_color:'mint',relationship:requested?'outgoing':'none',can_view:false});
   if(u.pathname.endsWith('/request_friend')){requested=true;return reply('friend-request');}
   if(u.pathname.endsWith('/travel_log')){if(r.method()==='POST')logs=[{...JSON.parse(r.postData()),id:'trip-one'}];if(r.method()==='DELETE')logs=[];return reply(logs);}
   if(u.pathname.endsWith('/complete_traveler_profile')){const body=JSON.parse(r.postData());profile={...body.profile_data,user_id:uid};contact=body.phone_number;assert.equal(profile.home_airport,'JFK');assert.equal(contact,'+12125550123');assert.equal(profile.discoverable,false);return reply(profile);}
   if(u.pathname.endsWith('/traveler_statistics'))return reply({taken:0,airports:0,airtime_minutes:null,airtime_observations:0,on_time_percent:null,departure_observations:0,months:[],delayed:0,cancelled:0,missed:0});
   if(u.pathname.endsWith('/traveler_connections'))return reply([]);
   if(u.pathname.endsWith('/saved_flights')){assert.equal(r.headers().authorization,`Bearer ${token}`);if(r.method()==='POST'){const body=JSON.parse(r.postData());assert.equal(body.user_id,uid);rows=[{journey:body.journey}];return reply(rows);}return setTimeout(()=>reply(rows),150);}
   if(u.pathname.endsWith('/notification_preferences'))return reply(null);
   return reply({});
  }
  if(u.pathname==='/api/flights/SQ12')return reply(sq12Lookup('2026-09-15'));
  if(u.pathname.startsWith('/api/'))return reply({error:'Unavailable'},503);return u.hostname==='127.0.0.1'?r.continue():r.abort();
 });
 await p.goto(`http://127.0.0.1:${server.address().port}/flight/SQ12?date=2026-09-15`);await p.waitForSelector('.flight-summary');await p.waitForFunction(()=>document.querySelector('.site-nav')?.textContent.includes('Account'));
 console.log('Account QA: sign-in available');await p.click('.alerts-button');await p.waitForSelector('.account-dialog');assert.equal(await p.$('.alert-sheet'),null,'Do not stack notification and sign-in dialogs');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')||'[]').length),0);
 await p.type('.account-dialog input','traveler@example.com');await p.click('.account-dialog form>button');await p.waitForFunction(()=>document.querySelector('.account-dialog')?.textContent.includes('could not send a code'));
 console.log('Account QA: auth error recovered');authAvailable=true;await p.click('.account-dialog form>button');await p.waitForSelector('[autocomplete="one-time-code"]');await p.type('[autocomplete="one-time-code"]','123456');await p.click('.account-dialog form>button');await p.waitForFunction(()=>!document.querySelector('.account-dialog'));console.log('Account QA: authenticated');
 await p.waitForFunction(()=>document.querySelector('.site-nav')?.textContent.includes('Account'));
 await p.waitForSelector('#account-display_name');
 await p.click('.account-onboarding .account-primary');await p.waitForSelector('[aria-invalid="true"]');
 await p.type('#account-display_name','Alex Traveler');await p.type('#account-handle','alex_flies');await p.type('#account-phone','+1 212 555 0123');await p.click('.account-onboarding .account-primary');
 await p.waitForSelector('#account-home_airport');await p.type('#account-home_airport','JFK');await p.type('#account-favorite_airline','Porter Airlines');await p.type('#account-favorite_aircraft','Airbus A220');
 await p.click('.account-onboarding .account-check:last-of-type input');await p.click('.account-onboarding .account-primary');await p.waitForSelector('.account-hero');
 console.log('Account QA: profile created');await p.waitForSelector('.profile-preference-tiles');assert.equal(await p.$eval('.profile-preference-tiles',e=>e.textContent.includes('Porter Airlines')),true);
 assert.equal(await p.$eval('.account-hero',e=>e.textContent.includes('traveler@example.com')||e.textContent.includes('2125550123')),false);
 for(const width of [320,390,768,1440]){await p.setViewport({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Account overflow at ${width}`);}
 await p.setViewport({width:390,height:844});await p.screenshot({path:'/tmp/envolio-account-mobile.png',fullPage:true});
 await p.goto(`http://127.0.0.1:${server.address().port}/flight/SQ12?date=2026-09-15`);await p.waitForSelector('.flight-summary');
 // Signing in starts a separate saved-flight sync. Do not click the disabled
 // Save button before that request finishes; Puppeteer's click does not wait.
 await p.waitForSelector('.alerts-button:not([disabled])');await p.click('.alerts-button');await p.waitForSelector('.alert-sheet').catch(async error=>{console.log('Account save diagnostics',JSON.stringify({errors,network,rows,html:await p.$eval('.alerts-button',e=>e.outerHTML),text:await p.evaluate(()=>document.body.innerText.slice(-12000))}));throw error;});await p.waitForFunction(()=>document.querySelector('.alert-sheet')?.textContent.includes('Background email delivery is not available yet'));
 assert.equal(rows.length,1);assert.equal(rows[0].journey.ident,'SQ12');await p.keyboard.press('Escape');await p.click('.pwa-dock button:last-child');await p.waitForSelector('.journey-card');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('Account QA: saved flight verified');const accountUrl=`http://127.0.0.1:${server.address().port}/account`;
 await p.goto(`${accountUrl}?section=profile`);await p.waitForSelector('#account-favorite_aircraft');
 await p.$eval('#account-favorite_aircraft',e=>e.select());await p.type('#account-favorite_aircraft','Boeing 787');await p.click('.account-area form .account-primary');await p.waitForFunction(()=>document.body.innerText.includes('Profile updated.'));assert.equal(profile.favorite_aircraft,'Boeing 787');
 await p.goto(`${accountUrl}?section=friends`);await p.waitForSelector('#friend-handle');await p.type('#friend-handle','jamie_flies');await p.click('.friend-search button');await p.waitForSelector('.friend-row .account-primary');await p.click('.friend-row .account-primary');await p.waitForFunction(()=>document.body.innerText.includes('Friend request sent.'));assert.equal(requested,true);
 await p.goto(`${accountUrl}?section=history`);await p.waitForSelector('.account-hero-actions .account-primary');await p.click('.account-hero-actions .account-primary');await p.waitForSelector('#account-log-flight');
 await p.type('#account-log-flight','PD604');await p.$eval('#account-log-date',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2026-09-01');e.dispatchEvent(new Event('input',{bubbles:true}));});await p.type('#account-log-origin','LGA');await p.type('#account-log-destination','YYZ');await p.click('.account-modal .account-check input');await p.click('.account-modal form .account-primary');await p.waitForSelector('.travel-log-row');assert.equal(logs.length,1);assert.equal(logs[0].actual_departure,null);
 await p.click('.travel-log-row .log-actions .account-text-button');await p.click('.log-remove-confirm .account-danger');await p.waitForFunction(()=>document.body.innerText.includes('No flights logged yet'));assert.equal(logs.length,0);
 await p.goto(`${accountUrl}?section=settings`);await p.waitForSelector('#account-phone');assert.equal(await p.$eval('#account-phone',e=>e.value),contact);
 await p.click('.privacy-row input');await p.waitForFunction(()=>document.body.innerText.includes('Privacy settings updated.'));assert.equal(profile.discoverable,true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
});
