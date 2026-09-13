import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSearch,resolveAirport,validDate} from '../src/flight-search.js';
import {validateRouteQuery,scheduleCandidates,originDayWindow} from '../route-search.js';
test('flight search accepts airline names, codes, conversational text and booking snippets',()=>{
 for(const [input,ident] of [['AA100','AA100'],['AA 100','AA100'],['B61','B61'],['JBU1','JBU1'],['JL1','JL1'],['SQ12','SQ12'],['BA1511 JFK-LHR','BA1511'],['United flight #15','UA15'],['flight 100 with American Airlines','AA100'],['100 American Airlines','AA100'],['El Al 7 from Tel Aviv','LY7'],['Emirites 202 tomorrow','EK202'],['Booking details\nFlight: BA1511\nJFK-LHR','BA1511']])assert.equal(parseSearch(input,'2026-09-13').ident,ident,input);
});
test('missing airline, multiple flights, city ambiguity and invalid dates are not silently guessed',()=>{
 assert.equal(parseSearch('100','2026-09-13').number,'100');
 assert.equal(parseSearch('100','2026-09-13').ident,'');
 assert.deepEqual(parseSearch('AA100 and BA1511','2026-09-13').identifiers,['AA100','BA1511']);
 const trip=parseSearch('New York to London tomorrow','2026-09-13');assert.equal(trip.origin,'JFK,LGA,EWR');assert.equal(trip.destination,'LHR,LGW,LCY');
 assert.deepEqual(resolveAirport('KJFK'),['JFK']);assert.deepEqual(resolveAirport('Tokyo'),['NRT','HND']);
 assert.match(parseSearch('AA100 03/04/2027','2026-09-13').dateError,/two different/);
 assert.match(parseSearch('AA100 on 2027-02-30','2026-09-13').dateError,/doesn’t exist/);
 assert.equal(parseSearch('AA100 on 5 March 2027','2026-09-13').date,'2027-03-05');
 assert.equal(parseSearch('AA100 on March 5th 2027','2026-09-13').date,'2027-03-05');
 assert.match(parseSearch('AA100 February 30 2027','2026-09-13').dateError,/doesn’t exist/);
 assert.equal(validDate('2027-02-29'),false);
});
test('route discovery validates bounds and respects origin-local dates without inventing timezone',()=>{
 assert.deepEqual(originDayWindow('2027-03-05','America/New_York'),{start:'2027-03-05T05:00:00Z',end:'2027-03-06T05:00:00Z'});
 assert.deepEqual(originDayWindow('2027-03-14','America/New_York'),{start:'2027-03-14T05:00:00Z',end:'2027-03-15T04:00:00Z'});
 assert.deepEqual(originDayWindow('2027-03-05','Asia/Tokyo'),{start:'2027-03-04T15:00:00Z',end:'2027-03-05T15:00:00Z'});
 const q={origin:'JFK',destination:'LHR',date:'2027-03-05'};
 assert.equal(validateRouteQuery(q,new Date('2026-09-13')),null);
 assert.ok(validateRouteQuery({...q,date:'2026-02-30'},new Date('2026-09-13')));
 assert.ok(validateRouteQuery({...q,origin:'JFK,LGA'},new Date('2026-09-13')));
 const f={ident:'AA100',origin:{code:'JFK'},destination:{code:'LHR'},scheduled_out:'2027-03-06T01:00:00Z'};
 const opts={...q,airport:{code:'JFK',timezone:'America/New_York'},normalize:x=>structuredClone(x),localDate:x=>new Date(x.scheduled_out).toLocaleDateString('en-CA',{timeZone:x.origin.timezone})};
 assert.equal(scheduleCandidates([f,f],opts).length,1);
 assert.equal(scheduleCandidates([f],{...opts,airport:{code:'JFK'}}).length,0);
 assert.equal(scheduleCandidates([f],{...opts,destination:'CDG'}).length,0);
});
