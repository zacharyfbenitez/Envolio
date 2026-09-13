import test from 'node:test';import assert from 'node:assert/strict';
import {applySlotRisk} from '../slot-risk.js';import {scoreAudit} from '../risk-audit.js';import {travelerChance} from '../src/traveler-presentation.js';
const now=Date.parse('2026-09-13T14:00:00Z'),flight={scheduled_out:'2026-09-13T19:30:00Z',scheduled_off:'2026-09-13T20:00:00Z'};
const base=(score=40)=>({score,on_time_probability:100-score,level:'elevated',factors:[{key:'route',label:'History',value:score,weight:1}],operational_warnings:[],methodology:'Existing model.'});
const slot=(minutes,extra={})=>({authority:'FAA',kind:'EDCT',status:'assigned',verified_at:new Date(now).toISOString(),assigned_time:new Date(Date.parse(flight.scheduled_off)+minutes*60000).toISOString(),...extra});
test('fresh slot risk grows strongly with delay magnitude, never adds duplicate votes',()=>{
 for(const [minutes,expected]of [[15,60],[30,75],[60,85],[120,95],[180,97]]){const result=applySlotRisk(base(),flight,slot(minutes),now);assert.equal(result.score,expected);assert.equal(result.on_time_probability,100-expected);assert.equal(result.factors.length,1);assert.equal(result.slot_adjustment.applied_points,expected-40);}
 assert.equal(applySlotRisk(base(96),flight,slot(60),now).score,96);
});
test('no/invalid/stale/removed/early slot preserves baseline byte-for-byte',()=>{
 for(const value of [null,slot(0),slot(-10),slot(60,{status:'removed'}),slot(60,{status:'unavailable'}),slot(60,{kind:'estimate'}),slot(60,{authority:'EUROCONTROL'}),slot(60,{verified_at:new Date(now-301000).toISOString()}),slot(60,{verified_at:new Date(now+61000).toISOString()})]){const index=base(),before=JSON.stringify(index);applySlotRisk(index,flight,value,now);assert.equal(JSON.stringify(index),before);}
 for(const key of ['actual_out','actual_off','actual_in','cancelled','schedule_only']){const index=base(),before=JSON.stringify(index);applySlotRisk(index,{...flight,[key]:true},slot(60),now);assert.equal(JSON.stringify(index),before);}
});
test('AA4397 actual FAA response materially raises risk with explicit taxi fallback',()=>{
 const f={scheduled_out:'2026-09-13T19:30:00Z'},s=slot(140);const result=applySlotRisk(base(49),f,s,now);assert.equal(s.assigned_time,'2026-09-13T22:20:00.000Z');assert.equal(result.score,96);assert.equal(result.slot_adjustment.source_detail.taxi_allowance_minutes,30);assert.match(result.slot_adjustment.source_detail.taxi_basis,/Heuristic/);
 const audit=scoreAudit(result,{factors:{route:49}});assert.equal(audit.rows.at(-1).contribution_points,47);assert.equal(audit.rows.at(-1).change_points,47);
 const presentation=travelerChance(result);assert.match(presentation.why,/140 minutes/);assert.match(presentation.reliability,/heuristic/);
});
test('published taxi interval is used; a slot within expected taxi time does not imply late gate departure',()=>{
 const f={...flight,scheduled_off:'2026-09-13T20:15:00Z'};assert.equal(applySlotRisk(base(),f,slot(0),now).score,40);
 const result=applySlotRisk(base(),f,slot(60),now);assert.equal(result.slot_adjustment.delay_minutes,45);assert.equal(result.slot_adjustment.source_detail.taxi_allowance_minutes,45);
});
