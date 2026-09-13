import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkylinkClient,compareStatus,forecastAt,relevantNotices,metarWeather,loadSkylinkContext} from '../skylink.js';
import {completedHistory,routeValidation} from '../validation.js';
const now=Date.parse('2026-09-12T16:00:00Z');
const flight={ident:'AAL100',ident_iata:'AA100',fa_flight_id:'current',origin:{code:'KJFK',code_iata:'JFK',timezone:'America/New_York'},destination:{code:'EGLL',code_iata:'LHR'},scheduled_out:'2026-09-12T22:20:00Z',scheduled_in:'2026-09-13T06:00:00Z',gate_origin:'2'};
const result=data=>({provider:'Skylink',status:'available',endpoint:'/test',retrieved_at:new Date(now).toISOString(),data});
const status=()=>result({flight_number:'AA100',departure:{airport:'JFK • New York',scheduled_date:'12 Sep',scheduled_time:'18:20',gate:'3',terminal:'8',checkin:'--'},arrival:{airport:'LHR • London',gate:'25',baggage:'--'}});
test('secondary status matches exact leg/date/time, fills only missing fields and retains conflicts',()=>{
  const s=compareStatus(flight,status());assert.equal(s.status,'matched');assert.equal(s.fields.terminal_origin,'8');assert.equal(s.fields.gate_origin,undefined);assert.equal(s.fields.baggage_claim,undefined);assert.deepEqual(s.conflicts,[{field:'gate_origin',flightaware:'2',skylink:'3'}]);assert.equal(s.fields.actual_out,undefined);
});
test('wrong date, route, flight number, time, stale response and annual ambiguity never merge',()=>{
  for(const mutate of [d=>d.departure.scheduled_date='13 Sep',d=>d.departure.airport='NRT • Tokyo',d=>d.flight_number='AA101',d=>d.departure.scheduled_time='18:25']){const r=status();mutate(r.data);assert.equal(compareStatus(flight,r).status,'unmatched');}
  assert.equal(compareStatus(flight,{...status(),status:'stale'}).status,'stale');
  assert.equal(compareStatus({...flight,scheduled_out:'2027-09-12T22:20:00Z'},status()).status,'unmatched');
});
const taf=()=>result({icao:'KJFK',raw:'TAF test',parsed:{start_time:'2026-09-12T12:00:00Z',end_time:'2026-09-13T12:00:00Z',forecast:[{type:'FROM',start_time:'2026-09-12T12:00:00Z',end_time:'2026-09-13T12:00:00Z',wind:{speed:12},wx_codes:[],flight_rules:'VFR'},{type:'FROM',probability:{value:30},start_time:'2026-09-12T20:00:00Z',end_time:'2026-09-13T00:00:00Z',wx_codes:[{value:'Thunderstorm rain'}]}]}});
test('TAF probabilistic FROM groups stay modifiers, never become baseline or delay probability',()=>{
  const f=forecastAt(taf(),flight.scheduled_out,now);assert.equal(f.status,'available');assert.equal(f.summary,'wind 12 kt');assert.equal(f.modifiers[0].weather_probability,30);assert.match(f.note,/not a flight-delay/);
  assert.equal(forecastAt(taf(),'2027-03-12T12:00:00Z',now).status,'outside_window');
});
test('stale or missing observation cannot become clear weather',()=>{
  assert.equal(metarWeather(result({parsed:{time:'2026-09-11T00:00:00Z'}}),now),null);
  const w=metarWeather(result({icao:'KJFK',parsed:{time:new Date(now).toISOString(),visibility:{value:0},wind:{speed:0}}}),now);
  assert.equal(w.observations[0].visibility,0);assert.equal(w.observations[0].wind_speed,0);
});
test('notices require matching airport, applicable time, closure and unrestricted schedule',()=>{
  const n={notam_id:'1',location:'KJFK',type:'N',effective:'202609120000',expiration:'202609130000',body:'RWY 04L CLSD'};
  const r=result({notams:[n,{...n,notam_id:'2',schedule:'DAILY 0000-0200'},{...n,notam_id:'3',location:'EGLL'},{...n,notam_id:'4',type:'C'},{...n,notam_id:'5',body:'RWY 04L CLSD EXC SCHEDULED FLIGHTS'}]});
  assert.deepEqual(relevantNotices(r,'KJFK',flight.scheduled_out).map(v=>v.id),['1']);
  assert.deepEqual(relevantNotices(result({notams:[{...n,body:'CRANE WILL ONLY OPR WHEN RWY 09L/27R IS CLSD.'}]}),'KJFK',flight.scheduled_out),[]);
  assert.equal(relevantNotices(result({notams:[{...n,body:'RWY 09L/27R ENRTY/EXIT AB11/A11 CLSD.'}]}),'KJFK',flight.scheduled_out)[0].title,'Runway access restriction');
});
test('client coalesces requests, preserves fetch time, returns stale on timeout',async()=>{
  let clock=now,calls=0,fail=false;
  const request=createSkylinkClient({key:'test',now:()=>clock,fetcher:async()=>{calls++;if(fail)throw new Error('timeout');return{ok:true,status:200,json:async()=>({value:1})}}});
  const [a,b]=await Promise.all([request('/x',100),request('/x',100)]);assert.equal(calls,1);assert.equal(a.retrieved_at,b.retrieved_at);
  clock+=50;assert.equal((await request('/x',100)).retrieved_at,a.retrieved_at);
  clock+=200;fail=true;const s=await request('/x',100);assert.equal(s.status,'stale');assert.equal(s.retrieved_at,a.retrieved_at);
});
test('plan denial, rate limits, budget and missing credentials stay explicit',async()=>{
  for(const [http,expected] of [[403,'plan_restricted'],[429,'rate_limited'],[404,'not_found']]){
    const request=createSkylinkClient({key:'test',fetcher:async()=>({ok:false,status:http})});assert.equal((await request('/x')).status,expected);
  }
  assert.equal((await createSkylinkClient({key:''})('/x')).status,'not_configured');
  assert.equal((await createSkylinkClient({key:'test',budget:0})('/x')).status,'budget_limited');
});
test('far-future enrichment skips live status and weather, still checks published future notices',async()=>{
  const paths=[];await loadSkylinkContext({...flight,schedule_only:true,scheduled_out:'2027-03-12T22:20:00Z',scheduled_in:'2027-03-13T06:00:00Z'},async path=>{paths.push(path);return{...result({notams:[]}),endpoint:path}},now);
  assert.equal(paths.length,2);assert.ok(paths.every(p=>p.startsWith('/notams/')));
});
test('historical validation excludes estimates, duplicates, later actuals and current flight',()=>{
  const row={...flight,fa_flight_id:'previous',scheduled_out:'2026-09-11T12:00:00Z',actual_out:'2026-09-11T12:30:00Z'};
  const records=completedHistory(flight,[row,row,{...row,fa_flight_id:'estimated',actual_out:null,estimated_out:row.actual_out},{...row,fa_flight_id:'current'},{...row,fa_flight_id:'late',actual_out:'2026-09-13T00:00:00Z'}],now);
  assert.equal(records.length,1);assert.equal(records[0].minutes,30);
});
test('changing a later outcome cannot rewrite an earlier backtest prediction',()=>{
  const records=Array.from({length:24},(_,i)=>({date:new Date(Date.UTC(2026,7,i+1,12)).toISOString(),actual_at:new Date(Date.UTC(2026,7,i+1,13)).toISOString(),minutes:i%3===0?30:0}));
  const a=routeValidation(records);records[23].minutes=60;const b=routeValidation(records);
  assert.deepEqual(a.backtest.slice(0,-1),b.backtest.slice(0,-1));
});
