import test from 'node:test';
import assert from 'node:assert/strict';
import {travelerChance,weatherWords,inboundOverview,inboundArrivalStatus,flightTimingStatus} from '../src/traveler-presentation.js';
test('route times show delays while distinguishing estimates from actuals',()=>{
 const f={scheduled:'2026-09-13T19:30:00Z',estimated:'2026-09-13T19:50:00Z'};
 assert.equal(flightTimingStatus(f).label,'Delayed 20 min');
 assert.equal(flightTimingStatus({...f,actual:'2026-09-13T19:55:00Z'}).label,'Departed 25 min late');
 assert.equal(flightTimingStatus({...f,event:'arrival',actual:f.estimated}).label,'Arrived 20 min late');
 assert.equal(flightTimingStatus({...f,estimated:f.scheduled}).label,'Expected on time');
 assert.equal(flightTimingStatus({scheduled:f.scheduled}).label,'Scheduled');
 assert.equal(flightTimingStatus({...f,cached:true}).label,'Saved update');
 assert.equal(flightTimingStatus({...f,active:true}).label,'Refresh to check');
});
test('inbound gate status compares scheduled gate arrival, never landing or next departure',()=>{
 const now=Date.parse('2026-09-13T17:00:00Z'),options={now,refreshed:new Date(now).toISOString()};
 const f={scheduled_in:'2026-09-13T18:30:00Z',estimated_in:'2026-09-13T18:52:00Z'};
 assert.deepEqual(inboundArrivalStatus(f,options),{tone:'late',label:'Expected 22 min late'});
 assert.equal(inboundArrivalStatus({...f,estimated_in:f.scheduled_in},options).label,'Expected on time');
 assert.equal(inboundArrivalStatus({...f,estimated_in:'2026-09-13T18:20:00Z'},options).label,'Expected 10 min early');
 assert.equal(inboundArrivalStatus({...f,actual_in:'2026-09-13T18:35:00Z'},options).label,'Arrived 5 min late');
 assert.equal(inboundArrivalStatus({scheduled_in:f.scheduled_in,actual_on:f.scheduled_in},options).tone,'unknown');
 assert.equal(inboundArrivalStatus({...f,scheduled_in:null},options).tone,'unknown');
 assert.equal(inboundArrivalStatus(f,{...options,cached:true}).tone,'unknown');
 assert.equal(inboundArrivalStatus(f,{...options,refreshed:'2026-09-13T16:00:00Z'}).tone,'unknown');
 assert.equal(inboundArrivalStatus({...f,cancelled:true},options).tone,'unknown');
 assert.equal(inboundArrivalStatus({scheduled_in:'2026-09-13T23:55:00Z',estimated_in:'2026-09-14T00:15:00Z'},options).label,'Expected 20 min late');
});
test('backend percentage is preserved, experimental and incomplete estimates are explicit',()=>{
 const index={score:32,factors:[{key:'route',value:25,weight:.28},{key:'inbound',value:75,weight:.2}],calibration:{material_signal:false,route:{sample_size:12,delay_rate:25}}};
 assert.equal(travelerChance(index).percent,32);
 assert.match(travelerChance(index).reliability,/Experimental/);
 assert.match(travelerChance(index).reliability,/missing.*weather/);
 assert.match(travelerChance(index).why,/incoming aircraft/);
 assert.equal(travelerChance(index,true).percent,null);
 assert.equal(travelerChance(index,false,true).percent,null);
 assert.equal(travelerChance({score:15}).percent,null);
 assert.equal(travelerChance({...index,calibration:{material_signal:true}}).percent,32);
 assert.equal(travelerChance({...index,score:0}).percent,0);
 assert.equal(travelerChance({...index,score:120}).percent,null);
 assert.equal(travelerChance(index,false,false,'2026-09-13T12:00:00Z').updated,'2026-09-13T12:00:00Z');
 assert.equal(travelerChance(index,false,false,'invalid').updated,null);
 assert.equal(travelerChance({...index,factors:[...index.factors,index.factors[1]]}).percent,32);
});
test('inbound separates landing from gate arrival and rejects stale map positions',()=>{
 const current={scheduled_out:'2026-09-13T14:00:00Z'},flight={actual_on:'2026-09-13T13:00:00Z',estimated_in:'2026-09-13T13:20:00Z'};
 assert.match(inboundOverview(flight,current).title,/not at the gate/);
 assert.equal(inboundOverview(flight,current).turnMinutes,40);
 assert.equal(inboundOverview({...flight,actual_in:'2026-09-13T13:20:00Z'},current).arrived,true);
 assert.equal(inboundOverview({...flight,estimated_in:'2026-09-13T14:20:00Z'},current).tone,'caution');
 const pos={latitude:40,longitude:-73,timestamp:'2026-09-13T13:00:00Z'};
 assert.equal(inboundOverview(flight,current,pos,false,Date.parse('2026-09-13T13:10:00Z')).map,true);
 assert.equal(inboundOverview(flight,current,pos,false,Date.parse('2026-09-13T14:00:00Z')).map,false);
 assert.equal(inboundOverview(null,current).map,false);
});
test('weather is translated without inventing a forecast or delay probability',()=>{
 assert.equal(weatherWords('TSRA · wind 10 kt'),'thunderstorms with rain · wind around 19 km/h (12 mph)');
 assert.match(weatherWords(),/isn’t available/);
 assert.equal(weatherWords('low cloud or visibility'),'low cloud or visibility');
});
