import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldConfidence,routeVariance,aircraftIntelligence,airportOperations,disruptionBrief,connectionCheck,localEpoch,suitableAlternatives} from '../traveler-intelligence.js';
import {providerPermissions,evaluateLicensedOutcomes} from '../provider-permissions.js';
import {metarWeather,loadSkylinkContext} from '../skylink.js';
const now=Date.parse('2026-09-13T10:00:00Z'),stamp=new Date(now).toISOString();
const JFK={code:'KJFK',code_iata:'JFK',timezone:'America/New_York'},LHR={code:'EGLL',code_iata:'LHR',timezone:'Europe/London'},CDG={code:'LFPG',code_iata:'CDG',timezone:'Europe/Paris'};
const flight={fa_flight_id:'one',ident:'AAL100',ident_iata:'AA100',origin:JFK,destination:LHR,scheduled_out:'2026-09-13T12:00:00Z',estimated_out:'2026-09-13T12:20:00Z',scheduled_in:'2026-09-13T18:00:00Z',estimated_in:'2026-09-13T18:30:00Z',gate_origin:'2',registration:'N123AA'};
const secondary={comparison:{status:'matched',receipt:{retrieved_at:stamp,endpoint:'/flight_status/AA100'}},status_data:{status:'Delayed 20 min',departure:{gate:'3'},arrival:{estimated_date:'13 Sep',estimated_time:'19:30'}},airports:[]};
const next={fa_flight_id:'two',ident_iata:'BA300',origin:LHR,destination:CDG,scheduled_out:'2026-09-13T19:00:00Z'};
const freshness={firstFetched:stamp,nextFetched:stamp};
test('field evidence preserves conflicts, timezone-safe arrival agreement and ambiguous delay semantics',()=>{
  const fields=fieldConfidence(flight,secondary,stamp,now),get=f=>fields.find(x=>x.field===f);
  assert.equal(get('gate_origin').score,20);assert.equal(get('gate_origin').needs_traveler_confirmation,true);
  assert.equal(get('arrival_time').state,'agreement');assert.equal(get('arrival_time').score,85);
  assert.equal(get('departure_delay').state,'single_source');assert.equal(get('departure_delay').skylink,null);
  assert.equal(get('terminal_origin').state,'unavailable');
  assert.match(get('gate_origin').method,/not measured correctness/);
  assert.equal(fieldConfidence(flight,{...secondary,comparison:{status:'unmatched'}},stamp,now)[0].state,'single_source');
  assert.equal(fieldConfidence(flight,secondary,'2026-09-10T10:00:00Z',now+3600000)[0].state,'stale');
});
test('historical route variance excludes estimates, duplicates, future outcomes and wrong route',()=>{
  const row={...flight,fa_flight_id:'prior',scheduled_out:'2026-09-12T12:00:00Z',actual_out:'2026-09-12T12:30:00Z',scheduled_in:'2026-09-12T18:00:00Z',actual_in:'2026-09-12T17:50:00Z'};
  const h=routeVariance(flight,[row,row,flight,{...row,fa_flight_id:'est',actual_in:null,actual_out:null},{...row,fa_flight_id:'wrong',destination:CDG},{...row,fa_flight_id:'future',actual_out:'2026-09-14T12:00:00Z',actual_in:null}],now);
  assert.equal(h.departure.samples,1);assert.equal(h.departure.median_minutes,30);assert.equal(h.arrival.median_minutes,-10);
});
test('aircraft assignment requires exact inbound leg, tail position and recent observation',async()=>{
  const f={...flight,registration:'N456AA',inbound_fa_flight_id:'inbound'},inbound={fa_flight_id:'inbound',destination:JFK,ident:'AAL99',registration:'N456AA',estimated_in:'2026-09-13T11:40:00Z'};
  const position={status:'available',data:{aircraft:[{registration:'N456AA',last_seen:stamp,latitude:40,longitude:-70,callsign:'AAL99'}]}};
  const a=aircraftIntelligence(f,inbound,position,now);assert.equal(a.risk,'tight');assert.equal(a.position.flight_link_verified,true);
  assert.equal(aircraftIntelligence(f,{...inbound,fa_flight_id:'other'},position,now).assigned_inbound,false);
  assert.equal(aircraftIntelligence(f,{...inbound,registration:'N999AA'},position,now).assigned_inbound,false);
  assert.equal(aircraftIntelligence(f,inbound,position,now+3600000).position,null);
  const paths=[];await loadSkylinkContext({...f,registration:'N123AA'},async p=>{paths.push(p);return{status:'not_found',data:null}},now,{inbound:{...inbound,fa_flight_id:'wrong'}});
  assert.ok(paths.some(p=>p.includes('registration=N123AA')));assert.ok(paths.every(p=>!p.includes('N456AA')));
});
test('airport ATC notices require current, relevant airport evidence and never imply confirmed causality',()=>{
  const s={...secondary,faa:{status:'available',retrieved_at:stamp,data:{ground_stops:[{airport:'JFK',reason:'Weather'},{airport:'LHR',reason:'General aviation PPR'}],airspace_flow_programs:[{facility:'ZNY',reason:'Volume'}]}}};
  const ops=airportOperations(flight,s,{},now);assert.equal(ops[0].items.length,1);assert.equal(ops[1].items.length,0);
  assert.equal(airportOperations({...flight,schedule_only:true},s,{},now)[0].items.length,0);
  const b=disruptionBrief(flight,s,{retrieved_at:stamp},[],now);assert.equal(b.reasons[0].classification,'possible');assert.match(b.traveler_action.detail,/Verify at airport screens/);
});
test('connection checks use actual legs, freshness and explicit buffer, not a protection guarantee',()=>{
  const c=connectionCheck(flight,next,freshness,now);assert.equal(c.status,'tight');assert.equal(c.remaining_minutes,30);
  assert.equal(connectionCheck(flight,next,{...freshness,buffer:20},now).status,'within_allowance');
  assert.equal(connectionCheck(flight,{...next,origin:JFK},freshness,now).status,'unavailable');
  assert.equal(connectionCheck(flight,next,freshness,now+3600000).status,'unavailable');
  assert.equal(connectionCheck({...flight,estimated_in:'2026-09-13T19:20:00Z'},next,freshness,now).status,'at_risk');
  assert.equal(connectionCheck(flight,{...next,actual_out:next.scheduled_out},freshness,now).status,'at_risk');
});
test('alternate local times reject DST gaps, repeats, impossible dates and too-early itineraries',()=>{
  assert.equal(new Date(localEpoch('2026-09-13T20:30:00','Europe/London')).toISOString(),'2026-09-13T19:30:00.000Z');
  for(const s of ['2026-03-08T02:30:00','2026-11-01T01:30:00','2026-02-30T12:00:00'])assert.ok(Number.isNaN(localEpoch(s,'America/New_York')));
  const row=t=>({legs:[{departure_airport:'LHR',arrival_airport:'CDG',flight_number:'BA302',departure_datetime:t}]});
  const result=suitableAlternatives([row('2026-09-13T19:30:00'),row('2026-09-13T20:30:00')],flight,next,connectionCheck(flight,next,freshness,now));
  assert.equal(result.length,1);assert.equal(result[0].legs[0].departure_datetime,'2026-09-13T20:30:00');
});
test('licensing is default deny, expires, and requires separate verified history and worker capacity',()=>{
  assert.equal(providerPermissions({},now).alerts.enabled,false);
  const review={provider:'Skylink',agreement_reference:'test',reviewed_at:stamp,expires_at:'2026-10-13T00:00:00Z',historical_storage:true,model_training:true,actual_gate_timestamps_verified:true,webhook_use:true,max_active_subscriptions:10,callback_authentication_verified:true,worker_capacity_enforced:true};
  assert.equal(providerPermissions(review,now).alerts.enabled,true);
  assert.equal(providerPermissions({...review,worker_capacity_enforced:false},now).alerts.enabled,false);
  assert.equal(providerPermissions(review,now+90*86400000).history.enabled,false);
});
test('licensed outcomes exclude predictions, duplicates and future receipts without entering live features',()=>{
  const row={provider:'Skylink',record_type:'actual_outcome',actual_basis:'observed_gate_event',source_record_id:'test',operating_ident:'AAL100',origin:'KJFK',destination:'EGLL',scheduled_out:'2026-09-12T12:00:00Z',actual_out:'2026-09-12T12:30:00Z',receipt:{endpoint:'/licensed-export',retrieved_at:stamp}};
  const result=evaluateLicensedOutcomes([row,row,{...row,record_type:'prediction'},{...row,receipt:{...row.receipt,retrieved_at:'2026-09-14T00:00:00Z'}}],{history:{enabled:true}},flight,now);
  assert.equal(result.accepted,1);assert.equal(result.rejected,3);assert.equal(result.model_promoted,false);
});
test('METAR visibility normalizes international metres to statute miles',()=>{
  const result=metarWeather({status:'available',data:{raw:'EGLL 131000Z 24012KT 1000 BR',parsed:{time:stamp,visibility:{value:1000,repr:'1000'}}}},now);
  assert.ok(Math.abs(result.observations[0].visibility-.62137)<.001);
});
