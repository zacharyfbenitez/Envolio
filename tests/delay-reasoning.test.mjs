import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDelayReasoning, parseFaaAdvisories } from '../delay-reasoning.js';
const now = Date.parse('2026-09-12T12:00:00Z');
const flight = { ident:'AA100', fa_flight_id:'outbound', scheduled_out:'2026-09-12T13:00:00Z', origin:{code_iata:'JFK'}, destination:{code_iata:'LHR'}, status:'Delayed', inbound_fa_flight_id:'inbound' };
test('delayed status alone never confirms a cause',()=>{
  const data=buildDelayReasoning(flight,{},now);
  assert.equal(data.status,'unavailable');assert.equal(data.primary_reason,null);
});
test('explicit flight status cause is confirmed',()=>{
  const data=buildDelayReasoning({...flight,status:'Delayed due to maintenance'}, {},now);
  assert.equal(data.primary_reason.classification,'confirmed');
  assert.equal(data.primary_reason.detail,'maintenance');
});
test('late assigned inbound is likely; a different aircraft is excluded',()=>{
  const inbound={fa_flight_id:'inbound',ident_iata:'AA99',destination:{code_iata:'JFK'},scheduled_in:'2026-09-12T12:00:00Z',estimated_in:'2026-09-12T13:25:00Z'};
  assert.equal(buildDelayReasoning(flight,{inbound},now).primary_reason.classification,'likely');
  assert.equal(buildDelayReasoning(flight,{inbound:{...inbound,fa_flight_id:'other'}},now).primary_reason,null);
});
test('future and departed flights exclude present-day operational theories',()=>{
  const context={originDelay:{color:'red',reasons:[{reason:'Weather'}]}};
  assert.equal(buildDelayReasoning({...flight,schedule_only:true},context,now).reasons.length,0);
  assert.equal(buildDelayReasoning({...flight,actual_out:'2026-09-12T11:00:00Z'},context,now).reasons.length,0);
});
test('weather requires a recent observation and stays a possible cause',()=>{
  const weather={provider:'FlightAware',observations:[{time:'2026-09-12T11:50:00Z',conditions:'TSRA'}]};
  assert.equal(buildDelayReasoning(flight,{originWeather:weather},now).primary_reason.classification,'possible');
  weather.observations[0].time='2026-09-11T12:00:00Z';
  assert.equal(buildDelayReasoning(flight,{originWeather:weather},now).primary_reason,null);
});
test('FAA feed is matched by airport, never claims confirmed flight causality, rejects stale data',()=>{
  const xml='<AIRPORT_STATUS_INFORMATION><Update_Time>Sat Sep 12 11:55:00 2026 GMT</Update_Time><Delay_type><Name>Ground Stops</Name><Ground_Stop_List><Ground_Stop><ARPT>JFK</ARPT><Reason>Thunderstorms</Reason></Ground_Stop></Ground_Stop_List></Delay_type></AIRPORT_STATUS_INFORMATION>';
  const faa=parseFaaAdvisories(xml,now);
  assert.equal(faa.status,'available');
  assert.equal(buildDelayReasoning(flight,{faa},now).primary_reason.classification,'possible');
  assert.equal(buildDelayReasoning(flight,{faa},now+3600000).primary_reason,null);
  assert.throws(()=>parseFaaAdvisories('<html>Error</html>',now));
});
test('restricted general-aviation closure does not imply an airline disruption',()=>{
  const faa={status:'available',observed_at:'2026-09-12T11:55:00Z',events:[{airport:'JFK',type:'Airport Closures',reason:'CLSD TO NON SKED TRANSIENT GA ACFT EXC PPR'}]};
  assert.equal(buildDelayReasoning(flight,{faa},now).primary_reason,null);
});
