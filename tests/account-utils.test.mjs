import test from 'node:test';
import assert from 'node:assert/strict';
import {profileErrors,normalizePhone,logErrors,minutesLabel,logFromJourney} from '../src/account-utils.js';
test('signup requires international private contact and complete favorites',()=>{
 const profile={display_name:'Alex',handle:'alex_flies',home_airport:'JFK',favorite_airline:'Porter Airlines',favorite_aircraft:'Airbus A220'};
 assert.deepEqual(profileErrors(profile,'+1 (212) 555-0123'),{});
 assert.equal(normalizePhone('+1 (212) 555-0123'),'+12125550123');
 assert.ok(profileErrors(profile,'2125550123').phone);
 assert.ok(profileErrors({...profile,handle:'admin'}).handle);
 assert.ok(profileErrors({...profile,home_airport:'KJFK'}).home_airport);
 assert.ok(profileErrors({...profile,favorite_aircraft:''}).favorite_aircraft);
});
test('travel log rejects impossible dates and does not invent flight times',()=>{
 const flight={flight_number:'AA100',travel_date:'2026-02-28',origin:'JFK',destination:'LHR'};
 assert.deepEqual(logErrors(flight),{});
 assert.ok(logErrors({...flight,travel_date:'2026-02-30'}).travel_date);
 assert.ok(logErrors({...flight,travel_date:'2099-01-01'}).travel_date);
 assert.ok(logErrors({...flight,destination:'JFK'}).destination);
 assert.equal(minutesLabel(null),'Not recorded');
 assert.equal(minutesLabel(125),'2h 5m');
 const record=logFromJourney({ident:'AA100',date:'2026-02-28',origin:{code_iata:'JFK'},destination:{code_iata:'LHR'}});
 assert.equal(record.actual_departure,null);assert.equal(record.actual_takeoff,null);
});
