import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRouteStatus} from '../route-search.js';
import {airportConditionWords} from '../src/airport-presentation.js';
const schedule={ident:'YX4397',codeshares:['AA4397'],origin:{code_iata:'JFK'},destination:{code_iata:'BOS'},scheduled_out:'2026-09-13T19:30:00Z',schedule_only:true};
const live={...schedule,ident:'RPA4397',ident_iata:'YX4397',estimated_out:'2026-09-13T19:50:00Z',status:'Delayed'};
test('route status matches direct legs from real AeroAPI segments envelope',()=>{
 const [f]=mergeRouteStatus([schedule],{flights:[{segments:[live]}]},'2026-09-13T18:00Z');
 assert.equal(f.schedule_only,false);assert.equal(f.status,'Delayed');assert.equal(f.estimated_out,live.estimated_out);assert.ok(f.codeshares.includes('AA4397'));
});
test('route status never merges connecting, wrong-time, wrong-route or ambiguous legs',()=>{
 for(const flights of [[{segments:[live,live]}],[{segments:[{...live,scheduled_out:'2026-09-13T20:30Z'}]}],[{segments:[{...live,destination:{code_iata:'LAX'}}]}],[{segments:[live]},{segments:[live]}],[]])assert.equal(mergeRouteStatus([schedule],{flights},'now')[0].schedule_only,true);
});
test('African IATA schedules match ICAO live identities and bounded schedule revisions',()=>{
 const african={ident:'SA303',ident_iata:'SA303',operator_iata:'SA',origin:{code_iata:'JNB'},destination:{code_iata:'CPT'},scheduled_out:'2026-09-14T04:05:00Z',schedule_only:true};
 const status={ident:'SAA303',ident_icao:'SAA303',operator_icao:'SAA',origin:{code_iata:'JNB'},destination:{code_iata:'CPT'},scheduled_out:'2026-09-14T04:12:00Z',actual_out:'2026-09-14T04:10:00Z',status:'Arrived'};
 const [matched]=mergeRouteStatus([african],{flights:[status]},'2026-09-14T06:00:00Z');
 assert.equal(matched.schedule_only,false);assert.equal(matched.actual_out,status.actual_out);assert.equal(matched.status_match.schedule_delta_minutes,7);
 assert.equal(mergeRouteStatus([african],{flights:[{...status,scheduled_out:'2026-09-14T04:30:00Z'}]},'now')[0].schedule_only,true);
});
test('airport language explains raw weather and notices without calling a runway closure an airport closure',()=>{
 assert.match(airportConditionWords({kind:'weather',evidence:'MVFR'}).detail,/Low clouds or reduced visibility/);
 assert.match(airportConditionWords({label:'Runway closure notice',evidence:'RWY 13R/31L CLSD'}).detail,/Runway 13R\/31L is closed/);
 assert.match(airportConditionWords({label:'Runway closure notice',evidence:'RWY 13R/31L CLSD'}).detail,/does not mean the whole airport/);
});
