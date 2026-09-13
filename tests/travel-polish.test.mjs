import test from 'node:test';
import assert from 'node:assert/strict';
import {nextJourney,filterFlights,flightChanges} from '../src/travel-polish.js';
import {alertCapabilities,travelerAlert} from '../alert-delivery.js';
test('next trip excludes departed and cancelled flights and uses origin-local date',()=>{
 const now=Date.parse('2026-09-14T01:00:00Z');
 const flight={ident:'AA100',date:'2026-09-13',origin:{timezone:'America/New_York'}};
 assert.equal(nextJourney([flight],now),flight);
 assert.equal(nextJourney([{...flight,snapshot:{cancelled:true}}],now),undefined);
 assert.equal(nextJourney([{...flight,snapshot:{scheduled_out:'2026-09-13T23:00:00Z'}}],now),undefined);
});
test('route filters use local time and confirmed marketing airline, never invented times',()=>{
 const f={ident:'YX4397',codeshares_iata:['AA4397'],origin:{timezone:'America/New_York'},scheduled_out:'2026-09-15T19:00:00Z'};
 assert.equal(filterFlights([f],{carrier:'AA',window:'afternoon'}).length,1);
 assert.equal(filterFlights([f],{window:'evening'}).length,0);
 assert.equal(filterFlights([{ident:'AA100'}],{window:'morning'}).length,0);
 assert.equal(filterFlights([{ident:'AA100'}]).length,1);
});
test('changes compare actual published revisions, not missing fields',()=>{
 const before={gate_origin:'B1',scheduled_out:'2026-09-15T19:00:00Z'};
 assert.deepEqual(flightChanges(null,before),[]);
 assert.deepEqual(flightChanges(before,{gate_origin:null}),[]);
 assert.deepEqual(flightChanges(before,{gate_origin:'B2',estimated_out:'2026-09-15T19:20:00Z'}),['Gate B1 → B2','Departure 20 min later']);
});
test('delivery never looks configured without worker and credentials; messages include actions',()=>{
 assert.equal(alertCapabilities({}).sms,false);
 assert.equal(alertCapabilities({ENABLE_ALERT_SUBSCRIPTIONS:'true',TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_FROM_NUMBER:'test'}).sms,false);
 assert.match(travelerAlert({flight:'AA100',event:'gate',after:'B2'}),/B2.*Check airport screens/);
 assert.match(travelerAlert({flight:'AA100',event:'probability',reason:'Incoming plane is late'}),/Why: Incoming plane is late/);
});
