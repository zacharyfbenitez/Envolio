import test from 'node:test';
import assert from 'node:assert/strict';
import {flightOptionIdentity,flightOptionStatus,travelerFlightLabel} from '../src/flight-option.js';
test('incoming flight numbers favor verified major carriers, not invented regional replacements',()=>{
 assert.equal(travelerFlightLabel({ident:'RPA4633',codeshares:['AAL4633']}),'AA4633');
 assert.equal(travelerFlightLabel({ident:'SKW1234',codeshares:['UAL5678']}),'UA5678');
 assert.equal(travelerFlightLabel({ident:'EDV111',codeshares_iata:['DL222']}),'DL222');
 assert.equal(travelerFlightLabel({ident:'RPA4633'}),'Flight number not confirmed');
 assert.equal(travelerFlightLabel({ident_iata:'YX4633'}),'Flight number not confirmed');
});
test('regional marketing numbers require an explicit provider codeshare',()=>{
 assert.equal(flightOptionIdentity({ident:'RPA4397',ident_iata:'YX4397',operator_icao:'RPA',codeshares:['AAL4397']}).display,'AA4397');
 assert.equal(flightOptionIdentity({ident:'SKW1234',codeshares:['UAL5678']}).display,'UA5678');
 assert.equal(flightOptionIdentity({ident:'EDV111',codeshares_iata:['DL222']}).display,'DL222');
 assert.equal(flightOptionIdentity({ident:'YX4397',operator:'Republic Airways',codeshares_iata:['AA4397']}).display,'AA4397');
 assert.equal(flightOptionIdentity({ident:'RPA4397',codeshares:[]}).display,'RPA4397');
 assert.equal(flightOptionIdentity({ident:'SKW1234',codeshares:['UA123','DL456']}).display,'SKW1234');
 assert.equal(flightOptionIdentity({ident:'SKW1234',codeshares:['UA123','DL456']},'DL').display,'DL456');
 assert.equal(flightOptionIdentity({ident:'AA100',codeshares:['BA1511']}).display,'AA100');
});
test('status colors never turn schedules or missing data into on-time claims',()=>{
 assert.equal(flightOptionStatus({schedule_only:true,status:'Scheduled'}).tone,'scheduled');
 assert.equal(flightOptionStatus({}).label,'Status not reported');
 assert.equal(flightOptionStatus({status:'On time'}).tone,'on-time');
 assert.equal(flightOptionStatus({status:'On time',scheduled_out:'2026-09-13T12:00Z',estimated_out:'2026-09-13T12:35Z'}).label,'35 min delayed');
 assert.equal(flightOptionStatus({cancelled:true}).tone,'cancelled');
 assert.equal(flightOptionStatus({actual_in:'2026-09-13T12:35Z'}).tone,'arrived');
 assert.equal(flightOptionStatus({status:'En Route'}).tone,'airborne');
});
