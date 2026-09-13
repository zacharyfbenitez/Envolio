import test from 'node:test';
import assert from 'node:assert/strict';
import {observationRisk,assessTaf,traceRotation,rotationRisk,createTafLoader} from '../operational-risk.js';
const now=Date.parse('2026-09-13T12:00:00Z'),iso=h=>`2026-09-13T${h}:00:00Z`,sec=h=>Date.parse(iso(h))/1000;
const row=(from,to,wx,change=null,probability=null)=>({timeFrom:sec(from),timeTo:sec(to),wxString:wx,fcstChange:change,probability,wspd:10,visib:'6+',clouds:[{cover:'BKN',base:4000}]});
const taf=rows=>({status:'available',retrieved_at:iso('12'),data:[{icaoId:'KJFK',issueTime:iso('11'),validTimeFrom:sec('12'),validTimeTo:sec('23'),fcsts:rows}]});
test('AA4397-style earlier storms warn without claiming storms at afternoon departure',()=>{
 const result=assessTaf(taf([row('12','14','+TSRA'),row('14','23',null,'FM')]),'KJFK',iso('19'),now);
 assert.equal(result.status,'available');assert.equal(result.score,.08);assert.equal(result.warnings[0].kind,'earlier_weather');assert.match(result.warnings[0].detail,/no thunderstorm period matches/);
});
test('flight-time storms affect weather once; PROB is not a flight probability',()=>{
 const result=assessTaf(taf([row('12','23',null),row('18','21','TSRA','PROB',30)]),'KJFK',iso('19'),now);
 assert.equal(result.warnings[0].kind,'flight_weather');assert.equal(result.warnings[0].periods[0].weather_probability,30);assert.ok(result.score>.08&&result.score<.3);
 const duplicate=assessTaf(taf([row('12','23',null),row('18','21','TSRA','TEMPO'),row('18','21','TSRA','TEMPO')]),'KJFK',iso('19'),now);
 assert.equal(duplicate.score,.58);
});
test('wrong airport, expired forecasts, malformed periods and unknown weather never become clear weather',()=>{
 assert.equal(assessTaf(taf([row('12','23','TSRA')]),'KBOS',iso('19'),now).score,null);
 assert.equal(assessTaf(taf([row('12','23','TSRA')]),'KJFK','2026-09-14T19:00:00Z',now).score,null);
 assert.equal(assessTaf(taf([{timeFrom:sec('12'),timeTo:sec('23')}]),'KJFK',iso('19'),now).score,null);
 assert.equal(observationRisk({observations:[{time:iso('11')}]},now),null);
 assert.equal(observationRisk({observations:[{time:'2026-09-12T11:00:00Z',wind_speed:0}]},now),null);
 assert.ok(observationRisk({observations:[{time:iso('11'),wind_speed:10,visibility:4,raw_data:'KJFK 131151Z 17010KT 4SM -RA BR OVC006',conditions:'-RA BR'}]},now)>=.38);
});
const ap=code=>({code_icao:code});
const current={fa_flight_id:'C',registration:'N1',origin:ap('KJFK'),scheduled_out:iso('19'),inbound_fa_flight_id:'B'};
const b={fa_flight_id:'B',ident:'B2',registration:'N1',origin:ap('KBOS'),destination:ap('KJFK'),scheduled_out:iso('16'),scheduled_in:iso('18'),inbound_fa_flight_id:'A'};
const a={fa_flight_id:'A',ident:'A1',registration:'N1',origin:ap('KDCA'),destination:ap('KBOS'),scheduled_out:iso('13'),scheduled_in:iso('15'),estimated_in:iso('17')};
test('verified second leg propagates delays with buffer absorption, not summed provider estimates',async()=>{
 const chain=await traceRotation(current,b,async()=>({flights:[a]}));assert.equal(chain.legs.length,2);
 const risk=rotationRisk(chain,current);assert.equal(risk.propagated_minutes,90);assert.equal(risk.score,1);
 const recovered=rotationRisk({legs:[{...b,actual_out:iso('16'),estimated_in:iso('18')}]},current);assert.equal(recovered.propagated_minutes,0);
 const roomy=rotationRisk(chain,{...current,scheduled_out:iso('23')});assert.equal(roomy.propagated_minutes,0);
});
test('cancelled prior leg warns, tail changes and ambiguous links stop traversal',async()=>{
 const chain=await traceRotation(current,b,async()=>({flights:[{...a,cancelled:true}]}));assert.equal(rotationRisk(chain,current).score,1);
 assert.match(rotationRisk(chain,current).warnings[0].detail,/not confirmed cancelled/);
 assert.equal((await traceRotation(current,b,async()=>({flights:[{...a,registration:'N2'}]}))).legs.length,1);
 assert.equal((await traceRotation(current,{...b,actual_out:iso('16')},async()=>{throw Error('must not look behind a departed leg')})).legs.length,1);
 assert.equal((await traceRotation(current,{...b,fa_flight_id:'WRONG'},async()=>null)).legs.length,0);
});
test('earlier-leg forecast risk participates once without inventing delay minutes',()=>{
 const risk=rotationRisk({legs:[b]},current,[{ident:'B2',forecast:{status:'available',score:.58,provider:'AWC'}}]);assert.equal(risk.score,.58);assert.equal(risk.propagated_minutes,0);assert.equal(risk.warnings[0].kind,'rotation_weather');
});
test('TAF requests coalesce and cache airport data across target times',async()=>{
 let calls=0;const load=createTafLoader(async()=>{calls++;return {ok:true,status:200,json:async()=>taf([row('12','23','TSRA')]).data}},()=>now);
 await Promise.all([load('KJFK',iso('19')),load('KJFK',iso('20'))]);assert.equal(calls,1);
});
