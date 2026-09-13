import test from 'node:test';
import assert from 'node:assert/strict';
import {tripTimeline,playbooks,airportPressure,connectionSurvival,rankBackups,travelPreferences,tripStrategy} from '../trip-strategy.js';
const now=Date.parse('2026-09-13T10:00:00Z'),stamp=new Date(now).toISOString();
const flight={ident_iata:'AA100',origin:{code_iata:'JFK',timezone:'America/New_York'},destination:{code_iata:'LHR',timezone:'Europe/London'},scheduled_out:'2026-09-13T22:20:00Z'};
const brief={aircraft:{assigned_inbound:false},fields:[],operations:[],reasons:[]};
test('72-hour timeline has null gaps, preserves evidence and does not extrapolate current ATC',()=>{
  const secondary={checked_at:stamp,airports:[{airport:'JFK',windows:Array.from({length:25},(_,i)=>({forecast:i<2?{status:'available',summary:i?'Thunderstorm rain':'wind 10 kt',retrieved_at:stamp}:{status:'outside_window'},notices:[]}))}]};
  const b={...brief,operations:[{airport:'JFK',items:[{type:'atc',title:'Ground stop',detail:'Weather',source:'FAA',observed_at:stamp}]}]};
  const t=tripTimeline(flight,secondary,b,now);assert.equal(t.rows.length,25);assert.equal(t.rows[0].score,60);assert.equal(t.rows[1].score,70);assert.equal(t.rows[2].score,null);assert.equal(t.rows[24].score,null);
  assert.equal(t.rows[1].facts.some(f=>f.kind==='atc'),false);assert.match(t.rows[1].movement,/rises/);assert.match(t.method,/not a delay probability/);
});
test('empty airport evidence is unknown, and stale data cannot become a low chaos score',()=>{
  const p=airportPressure('JFK',{items:[]},{observations:[{time:'2026-09-01T00:00:00Z',wind_speed:0}]},null,now);assert.equal(p.score,null);
  const active=airportPressure('JFK',{items:[{type:'runway',title:'Runway closure',detail:'RWY 04L CLSD',source:'NOTAM',observed_at:stamp}]},null,null,now);assert.equal(active.score,45);assert.ok(active.missing.includes('Security queues'));
});
test('playbooks never imply permission to miss original check-in or a measured turnaround minimum',()=>{
  const p=playbooks({...brief,aircraft:{assigned_inbound:true,risk:'tight',ident:'AA99',status:'En route',turnaround_minutes:28}})[0];
  assert.match(p.evidence,/28 minutes/);assert.match(p.evidence,/not an observed airline minimum/);assert.match(p.now,/original check-in/);assert.match(p.avoid,/Do not leave/);
});
test('connection score exposes margin heuristic, terminal uncertainty and real historical sample',()=>{
  const c=connectionSurvival({remaining_minutes:30,scheduled_minutes:100,buffer_minutes:60,status:'tight'},{terminal_destination:'2'},{terminal_origin:'5'},{rows:[{arrival:0},{arrival:50},{arrival:null}]});
  assert.equal(c.score,25);assert.equal(c.terminal_change,true);assert.equal(c.history.samples,2);assert.equal(c.history.within_allowance,1);assert.match(c.method,/not the probability/);
  assert.equal(connectionSurvival({status:'unavailable'},{},{},{}).score,null);
  assert.equal(connectionSurvival({status:'at_risk',buffer_minutes:60},{},{},{}).score,0);
});
const option=(number='AA102',departure='2026-09-13T20:00:00',price=500)=>({price_usd:price,stops:0,total_duration_min:420,legs:[{flight_number:number,departure_airport:'JFK',arrival_airport:'LHR',departure_datetime:departure,arrival_datetime:'2026-09-14T08:00:00'}]});
test('backup ranking is deterministic, deduplicated and excludes the original flight and unreachable options',()=>{
  const rows=[option(),option(),option('AA100','2026-09-13T18:20:00'),option('BA178','2026-09-13T07:00:00'),option('BA180','2026-09-13T19:00:00',300)];
  const r=rankBackups(rows,flight,{priority:'price'},now);assert.equal(r.flights.length,2);assert.equal(r.flights[0].price_usd,300);assert.match(r.note,/not a validated/);
});
test('backup filters handle overnight departures, unknown aircraft, airport changes and published layovers',()=>{
  assert.equal(rankBackups([option('AA102','2026-09-13T23:00:00')],flight,{avoidRedeye:true},now).flights.length,0);
  const regional=option();regional.legs[0].aircraft_type='CRJ9';assert.equal(rankBackups([regional],flight,{avoidRegional:true},now).flights.length,0);
  assert.equal(rankBackups([option()],flight,{avoidRegional:true},now).flights[0].aircraft_preference_verified,false);
  const multi=option();multi.legs[0].arrival_airport='CDG';multi.legs[0].arrival_datetime='2026-09-14T04:30:00';multi.legs.push({flight_number:'AF100',departure_airport:'CDG',arrival_airport:'LHR',departure_datetime:'2026-09-14T06:00:00',arrival_datetime:'2026-09-14T08:00:00'});
  assert.equal(rankBackups([multi],flight,{},now).flights.length,0);
  multi.layovers=[{airport:'CDG',duration_min:90}];assert.equal(rankBackups([multi],flight,{},now).flights.length,1);
  multi.legs[1].departure_airport='ORY';assert.equal(rankBackups([multi],flight,{},now).flights.length,0);
});
test('preference limits are bounded and assignment changes are observations, not maintenance predictions',()=>{
  assert.equal(travelPreferences({minLayover:9999,readyMinutes:-1}).minLayover,360);assert.equal(travelPreferences({readyMinutes:-1}).readyMinutes,30);
  const s=tripStrategy(flight,{airports:[]},brief,{assignment_changes:[{from:'N1',to:'N2',at:stamp}]},now);assert.match(s.airline_view.signals[0].detail,/does not establish a maintenance/);
});
