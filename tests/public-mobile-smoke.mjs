import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {sq12Lookup} from './fixtures/flight-lookups.mjs';
const base=process.env.TEST_PUBLIC_URL||'https://envolio.travel';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--renderer-process-limit=2']});
const page=await browser.newPage(),errors=[],results=[];
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
await page.setBypassServiceWorker(true);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);page.on('pageerror',e=>errors.push(e.message));
let scenario=null;
const date=new Date(Date.now()+86400000).toISOString().slice(0,10),next=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
function fixture(kind){const d=sq12Lookup(date);d.route_options=[];d.refreshed_at=new Date().toISOString();const f=d.flights[0];Object.assign(f,{ident:'AAL100',ident_iata:'AA100',operator:'American Airlines',operator_iata:'AA',origin:{code_iata:'JFK',city:'New York',timezone:'America/New_York'},destination:{code_iata:'LHR',city:'London',timezone:'Europe/London'},scheduled_out:`${date}T23:00:00Z`,estimated_out:`${date}T23:00:00Z`,scheduled_in:`${next}T06:00:00Z`,estimated_in:`${next}T06:00:00Z`,gate_origin:null,terminal_origin:null});
 d.delay_index={score:23,on_time_probability:77,factors:[{key:'route',label:'Route history',value:23,weight:1}],coverage_percent:20};
 if(kind.startsWith('cancelled')){f.cancelled=true;if(kind==='cancelled')f.status='Cancelled';}
 if(kind.startsWith('diverted')){f.diverted=true;f.actual_out=f.scheduled_out;f.actual_off=f.scheduled_out;if(kind==='diverted')f.status='Diverted';}
 if(kind==='missing_baggage'){f.status='Arrived';f.actual_out=f.scheduled_out;f.actual_in=f.scheduled_in;f.gate_destination=null;f.baggage_claim=null;}
 if(kind==='partial_position'||kind==='missing_metrics'){f.status='En Route';f.actual_out=f.scheduled_out;d.flight_position={timestamp:d.refreshed_at,altitude:null,groundspeed:null,...(kind==='missing_metrics'?{latitude:40,longitude:-73}:{})};}
 return d;}
await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(scenario&&u.pathname.startsWith('/api/'))return r.respond({status:u.pathname==='/api/flights/AA100'?200:503,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/flights/AA100'?fixture(scenario):{error:'Controlled unavailable source'})});r.continue();});
try{
 scenario=process.env.LIVE_LOOKUP==='1'?null:'overnight';
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#flight-query');await page.type('#flight-query','American 100 tomorrow');await page.click('.finder-submit');
 try{await page.waitForSelector('.flight-summary',{timeout:35000});results.push({step:'search to summary',result:'passed',live:!scenario,url:page.url()});
 await page.click('.alerts-button');await page.waitForSelector('.alert-sheet');const beforePreference=await page.$eval('.alert-options label:nth-child(2) input',e=>e.checked);await page.click('.alert-options label:nth-child(2)');const gatePreference=await page.$eval('.alert-options label:nth-child(2) input',e=>e.checked);await page.click('[aria-label="Close notification settings"]');
 await page.click('.pwa-dock button:last-child');await page.waitForSelector('.journey-card');await page.click('.saved-watch-settings');await page.waitForSelector('.alert-sheet');const retained=await page.$eval('.alert-options label:nth-child(2) input',e=>e.checked);
 results.push({step:'Watch → Saved → notification settings',result:retained===gatePreference&&beforePreference!==gatePreference?'passed':'FAILED preference change or persistence',beforePreference,gatePreference,retained,savedCount:await page.evaluate(()=>JSON.parse(localStorage.getItem('contrail.saved')||'[]').length),url:page.url()});await page.click('[aria-label="Close notification settings"]');
 }catch(e){results.push({step:'primary flow',result:'blocked',detail:(await page.evaluate(()=>document.body.innerText)).slice(-2200),error:e.message});}
 for(const kind of (process.env.SKIP_EDGES==='1'?[]:['cancelled','cancelled_flag','diverted','diverted_flag','overnight','missing_baggage','missing_metrics','partial_position'])){
  scenario=kind;const before=errors.length;await page.goto(`${base}/flight/AA100?date=${date}&origin=JFK&case=${kind}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.flight-summary')||document.querySelector('.error-panel'),{timeout:15000}).catch(()=>{});
  await page.screenshot({path:`/tmp/envolio-smoke-${kind}.png`,fullPage:true});
  results.push({case:kind,errors:errors.slice(before),...await page.evaluate(()=>({summary:document.querySelector('.flight-summary')?.innerText,advice:document.querySelector('.next-step-card')?.innerText,ops:document.querySelector('.live-ops')?.innerText,inbound:!!document.querySelector('.inbound-summary'),delayOutlook:!!document.querySelector('.projected-delay'),timeline:!!document.querySelector('.turn-timeline'),overflow:document.documentElement.scrollWidth>innerWidth}))});
 }
 console.log(JSON.stringify({base,viewport:'390 × 844 · touch/mobile Chromium, not physical Safari',results,errors},null,2));
 if(process.env.ASSERT_FIXED==='1'){
  assert.ok(results.filter(r=>r.step).every(r=>r.result==='passed'),'Primary flow must pass');
  for(const r of results.filter(r=>r.case)){
   assert.ok(r.summary,`${r.case}: flight summary must render, not the error boundary`);assert.equal(r.overflow,false);
   if(r.case.startsWith('cancelled')){assert.match(r.summary,/Cancelled/);assert.doesNotMatch(r.summary,/EXPECTED ON TIME/);assert.equal(r.timeline,false);assert.match(r.advice,/rebooking/);}
   if(r.case.startsWith('diverted')){assert.match(r.summary,/Diverted/);assert.match(r.advice,/new arrival airport/);assert.doesNotMatch(r.ops,/En route to LHR/);assert.match(r.summary,/Confirm arrival/);}
   if(r.case==='missing_metrics'||r.case==='partial_position'){assert.match(r.ops,/Not reported/);assert.doesNotMatch(r.ops,/null kt|0 ft|NaN/);}
   if(r.case==='missing_baggage')assert.match(r.ops,/BAGGAGE CLAIM\nNot reported/);
   if(r.case==='overnight')assert.match(r.summary,/\+1 day/);
  }
  assert.deepEqual(errors,[]);console.log('PASS: all mobile flow and edge-case assertions');
 }
}finally{await browser.close();}
