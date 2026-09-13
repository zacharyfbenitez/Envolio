import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { sq12Lookup } from './fixtures/flight-lookups.mjs';
import { buildDelayReasoning } from '../delay-reasoning.js';

test('reason cards render on desktop and mobile with readable evidence and no runtime errors', async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    for (const width of [1440,390]) {
      const page = await browser.newPage();
      await page.setViewport({width,height:1000});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      const payload=sq12Lookup('2026-09-12');
      const f=payload.flights[0];f.inbound_fa_flight_id='test-inbound';
      payload.delay_reasoning=buildDelayReasoning(f,{inbound:{fa_flight_id:'test-inbound',ident_iata:'SQ11',destination:f.origin,estimated_in:'2026-09-12T19:40:00Z',scheduled_in:'2026-09-12T18:00:00Z'}},Date.parse('2026-09-12T18:00:00Z'));
      await page.setRequestInterception(true);
      page.on('request',request=>request.url().includes('/api/flights/') ? request.respond({status:200,contentType:'application/json',body:JSON.stringify(payload)}) : request.continue());
      await page.goto('http://127.0.0.1:5173/flight/SQ12?date=2026-09-12',{waitUntil:'domcontentloaded'});
      await page.waitForSelector('.delay-reasoning');
      await page.$eval('.flight-analysis',e=>e.open=true);
      assert.match(await page.$eval('.delay-reasoning',e=>e.textContent),/Likely contributor/);
      await page.$eval('.delay-reasoning',e=>e.scrollIntoView());
      await page.$eval('.reason-cards summary',e=>e.click());
      assert.equal(await page.$eval('.reason-cards details',e=>e.open),true);
      assert.match(await page.$eval('.reason-cards details',e=>e.textContent),/not empirically calibrated/);
      assert.equal(await page.$eval('.delay-reasoning',e=>e.scrollWidth<=e.clientWidth),true);
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally { await browser.close(); }
});
