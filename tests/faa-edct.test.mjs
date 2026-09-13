import test from 'node:test';import assert from 'node:assert/strict';
import {parseFaaEdct,edctQuery,createPublicEdctLoader} from '../faa-edct.js';
const now=Date.parse('2026-09-13T14:00:00Z'),flight={ident:'RPA4397',origin:{code_icao:'KJFK',code_iata:'JFK'},destination:{code_icao:'KBOS',code_iata:'BOS'},scheduled_out:'2026-09-13T19:30:00Z'},q=edctQuery(flight,now);
// Minimal structural fixture transcribed from the live FAA response, 2026-09-13.
const row=(date,slot='22:20',cancel='No')=>`<tr><td>${date} ${slot}</td><td>${date} 19:30</td><td>BOS</td><td>${cancel}</td></tr>`;
const html=(rows=row('09/12/2026','20:27')+row('09/13/2026'))=>`<title>EDCT Information</title><table><tr><td>CALL SIGN:&nbsp;</td><td>RPA4397</td></tr><tr><td>ORIGIN:&nbsp;</td><td>JFK</td></tr><tr><td>DESTINATION:&nbsp;</td><td>BOS</td></tr></table><table><tr><th>EDCT</th><th>Filed Departure Time</th><th>Control Element</th><th>Flight Cancelled?</th></tr>${rows}</table>All Dates/Times are in <b>Zulu</b>`;
const parse=h=>parseFaaEdct(h,flight,q,new Date(now).toISOString());
test('AA4397: picks correct UTC filed departure, not yesterday’s first row',()=>{
 const r=parse(html());assert.equal(r.assigned_time,'2026-09-13T22:20:00.000Z');assert.equal(r.kind,'EDCT');assert.equal(r.issued_at,null);assert.equal(r.reason,null);assert.equal(r.control_element,'BOS');
});
test('wrong date/identity, ambiguous rows, cancelled plans, format changes and estimates fail closed',()=>{
 for(const h of [html(row('09/12/2026')),html(row('09/13/2026')+row('09/13/2026','22:30')),html(row('09/13/2026','22:20','Yes')),html().replace('RPA4397','AAL4397'),html().replace('Zulu','Local'),html(row('09/13/2026','Estimate 22:20')),html().replace('Filed Departure Time','Departure')])assert.equal(parse(h).status,'unavailable');
 assert.equal(parse(html(row('09/13/2026','10:00'))).status,'stale');
});
test('public lookup uses observed FAA form, coalesces, caches and respects HTTP blocks',async()=>{
 let calls=0;const load=createPublicEdctLoader(async(url,opts)=>{calls++;assert.equal(url,'https://www.fly.faa.gov/edct/showEDCT');assert.equal(opts.method,'POST');assert.equal(opts.body.get('callsign'),'RPA4397');return new Response(html());},{},()=>now);
 const results=await Promise.all([load(flight),load(flight)]);assert.equal(results[0].status,'assigned');await load(flight);assert.equal(calls,1);
 const blocked=createPublicEdctLoader(async()=>{calls++;return new Response('',{status:403});},{},()=>now);await blocked(flight);await blocked({...flight,ident:'RPA1234'});assert.equal(calls,2);
 assert.equal(edctQuery({...flight,scheduled_out:'2026-10-13T19:30:00Z'},now),null);
 assert.equal(edctQuery({...flight,actual_off:new Date(now).toISOString()},now),null);
});
