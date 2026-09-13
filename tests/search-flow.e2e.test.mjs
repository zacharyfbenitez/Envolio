import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ba1511Lookup,sq12Lookup} from './fixtures/flight-lookups.mjs';

const base=process.env.TEST_PUBLIC_URL||'http://127.0.0.1:5173/';

async function mockFlightAwareLookup(page){
  // PWA behavior is tested separately; keep provider fixtures deterministic.
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.endsWith('/api/search-access'))return request.respond({status:201,contentType:'application/json',body:'{"ok":true}'});
    if(url.pathname.endsWith('/api/airline-icon'))return request.respond({status:200,contentType:'image/svg+xml',headers:{'cache-control':'no-store'},body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#d7e3fa"/><path d="M7 18h18M16 7l4 11-4 7" stroke="#141e32" stroke-width="2" fill="none"/></svg>'});
    const match=url.pathname.match(/\/api\/flights\/(SQ12|BA1511)$/i);
    if(!match)return request.continue();
    const date=url.searchParams.get('date')||new Date().toISOString().slice(0,10);
    const payload=match[1].toUpperCase()==='SQ12'?sq12Lookup(date,url.searchParams.get('origin')||'NRT'):ba1511Lookup(date);
    return request.respond({status:200,contentType:'application/json',headers:{'cache-control':'no-store','x-contrail-test-fixture':'flight-lookup'},body:JSON.stringify(payload)});
  });
}

test('input → lookup → route choice → diagnostics',async t=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  await mockFlightAwareLookup(page);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.type('.input-wrap input','SQ12 from NRT tomorrow');
  assert.equal(await page.$('.email-capture input'),null);
  await page.$eval('.search-box',form=>form.requestSubmit());
  await page.waitForFunction(()=>location.pathname.includes('/flight/SQ12'),{timeout:5000});
  await page.waitForSelector('.flight-title',{timeout:15000});
  assert.equal(await page.$eval('.route-main strong',element=>element.textContent),'NRT');
  assert.match(page.url(),/origin=NRT/);
  await page.click('.lookup-diagnostics summary');
  assert.match(await page.$eval('.lookup-diagnostics',element=>element.textContent),/Origin hint matched/);
  assert.equal(errors.length,0,errors.join('\n'));
});

test('codeshare diagnostics and manual partner controls render',async t=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  await mockFlightAwareLookup(page);
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await page.goto(`${base}flight/BA1511?date=${tomorrow}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.flight-title',{timeout:15000});
  assert.equal(await page.$eval('.flight-title h1',element=>element.textContent),'AA100');
  assert.match(await page.$eval('.carrier-identity>div:last-child>span',element=>element.textContent),/marketed as BA1511/i);
  await page.click('.lookup-diagnostics summary');
  assert.ok(await page.$('.match-confidence'));
  assert.ok(await page.$('.alternate-identifiers button'));
});

test('loading and provider-error states stay explicit and recoverable',async t=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  let releaseRequest;
  const pendingRequest=new Promise(resolve=>{releaseRequest=resolve;});
  page.on('request',request=>{
    if(!new URL(request.url()).pathname.match(/\/api\/flights\/ZZ999$/i))return request.continue();
    releaseRequest(request);
  });
  await page.goto(`${base}flight/ZZ999?date=2026-09-12`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.loading-state');
  assert.match(await page.$eval('.loading-state',element=>element.textContent),/Checking status, aircraft, airports, and weather/i);
  // Release the fixture only after observing loading; avoid a 350ms timing race.
  await (await pendingRequest).respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Live flight data is temporarily unavailable.',detail:'The provider did not respond before the lookup deadline.',diagnostics:{requested_ident:'ZZ999',requested_date:'2026-09-12',identifiers_tried:['ZZ999'],match_type:null,reason:'Provider timeout'}})});
  await page.waitForSelector('.error-panel',{timeout:5000});
  const copy=await page.$eval('.error-panel',element=>element.textContent);
  assert.match(copy,/No flight status or delay probability was estimated/i);
  assert.match(copy,/Edit search/i);
});
