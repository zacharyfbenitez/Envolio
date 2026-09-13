import test from 'node:test';
import assert from 'node:assert/strict';
import {travelerChance,weatherWords,inboundOverview} from '../src/traveler-presentation.js';
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
