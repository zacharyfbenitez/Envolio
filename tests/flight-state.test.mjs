import test from 'node:test';
import assert from 'node:assert/strict';
import {reportedStatus,positionReadout} from '../src/flight-state.js';
import {travelAdvice} from '../src/travel-advice.js';
import {journeyUrl} from '../src/journeys.js';
test('explicit disruption flags override stale status text and ordinary travel advice',()=>{
 assert.equal(reportedStatus({status:'Scheduled',cancelled:true}),'Cancelled');
 assert.equal(reportedStatus({status:'Scheduled',diverted:true}),'Diverted');
 assert.match(travelAdvice({cancelled:true,status:'Scheduled'})[0],/rebooking/);
 assert.match(travelAdvice({diverted:true,status:'Scheduled',actual_out:'2026-09-14T23:00:00Z'})[0],/new arrival airport/);
});
test('partial position never throws or converts missing metrics to zero',()=>{
 assert.deepEqual(positionReadout({altitude:null,groundspeed:null}),{position:'Position unavailable',altitude:'Not reported',speed:'Not reported'});
 assert.equal(positionReadout({latitude:40,longitude:-73,altitude:0,groundspeed:0}).altitude,'0 ft');
 assert.equal(positionReadout({latitude:999,longitude:0}).position,'Position unavailable');
});
test('saved links retain the selected scheduled departure',()=>{
 const t='2026-09-14T23:00:00Z',url=journeyUrl({ident:'AA100',date:'2026-09-14',snapshot:{scheduled_out:t}},'/');
 assert.equal(new URL(url,'https://envolio.travel').searchParams.get('departure'),t);
});
