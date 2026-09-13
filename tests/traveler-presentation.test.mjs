import test from 'node:test';
import assert from 'node:assert/strict';
import {travelerChance,weatherWords} from '../src/traveler-presentation.js';
test('unvalidated scores never become consumer probabilities',()=>{
 const index={score:15,calibration:{material_signal:false,route:{sample_size:12,delay_rate:25}}};
 assert.equal(travelerChance(index).percent,25);
 assert.match(travelerChance(index).detail,/past performance/);
 assert.equal(travelerChance(index,true).percent,null);
 assert.equal(travelerChance(index,false,true).percent,null);
 assert.equal(travelerChance({score:15}).percent,null);
 assert.equal(travelerChance({...index,calibration:{material_signal:true}}).percent,15);
});
test('weather is translated without inventing a forecast or delay probability',()=>{
 assert.equal(weatherWords('TSRA · wind 10 kt'),'thunderstorms with rain · wind around 19 km/h (12 mph)');
 assert.match(weatherWords(),/isn’t available/);
 assert.equal(weatherWords('low cloud or visibility'),'low cloud or visibility');
});
