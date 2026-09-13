import test from 'node:test';
import assert from 'node:assert/strict';
import {travelerAirport,arrivalDay} from '../src/flight-summary.js';
import {forecastConditions} from '../operational-risk.js';
test('airport labels use traveler names and local arrival dates cross the date line',()=>{
 assert.equal(travelerAirport({code_iata:'HND',city:'Ota'}),'Tokyo–Haneda');
 assert.match(arrivalDay('2026-09-15T14:00:00Z','2026-09-16T05:00:00Z','America/New_York','Asia/Tokyo'),/Sep 16 · \+1 day/);
 assert.match(arrivalDay('2026-09-16T02:00:00Z','2026-09-16T10:00:00Z','Asia/Tokyo','Pacific/Honolulu'),/Sep 16|Sep 15/);
 assert.equal(arrivalDay(null,null), '');
});
test('weather explanations name only the conditions actually present',()=>{
 assert.deepEqual(forecastConditions([{clouds:[{cover:'BKN',base:500}],visib:6,wspd:5}]),['Cloud ceiling as low as 500 ft']);
 assert.deepEqual(forecastConditions([{visib:1,wgst:35,wxString:'TSRA'}]),['Thunderstorms','Visibility as low as 1 mile','Winds up to 35 knots']);
 assert.deepEqual(forecastConditions([{}]),[]);
});
