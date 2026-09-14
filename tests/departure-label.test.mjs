import test from 'node:test';
import assert from 'node:assert/strict';
import {departureTimingLabel} from '../src/flight-state.js';
import {flightOptionStatus} from '../src/flight-option.js';
const now=Date.parse('2026-09-13T12:00:00Z'),f={status:'Scheduled',scheduled_out:'2026-09-14T13:55:00Z',estimated_out:'2026-09-14T13:55:00Z',checked_at:'2026-09-13T12:00:00Z'};
test('within 48h, published departure timing supports green On time; delay wins',()=>{
 assert.equal(departureTimingLabel(f,now).label,'On time');assert.equal(flightOptionStatus(f,now).tone,'on-time');
 assert.equal(departureTimingLabel({...f,estimated_out:'2026-09-14T14:00:00Z'},now).label,'5 min delayed');
 assert.equal(flightOptionStatus({...f,status:'On time',estimated_out:'2026-09-14T14:00:00Z'},now).label,'5 min delayed');
 assert.equal(flightOptionStatus({...f,cancelled:true},now).label,'Cancelled');assert.equal(flightOptionStatus({...f,diverted:true},now).label,'Diverted');
});
test('never promote missing, schedule-only, stale, departed or distant data to on time',()=>{
 for(const change of [{estimated_out:null},{schedule_only:true},{actual_out:f.scheduled_out},{status:'Delayed'},{checked_at:'2026-09-13T11:00:00Z'},{scheduled_out:'2026-09-16T12:00:00Z'}])assert.equal(departureTimingLabel({...f,...change},now),null);
 assert.equal(departureTimingLabel(f,Date.parse('2026-09-15T12:00:00Z')),null);
 assert.equal(departureTimingLabel(f,NaN),null);
 assert.equal(departureTimingLabel({...f,scheduled_out:'2026-09-15T12:00:00Z',estimated_out:'2026-09-15T12:00:00Z'},now).label,'On time');
});
