import test from 'node:test';
import assert from 'node:assert/strict';
import {slotConfig,normalizeSlots,createSlotLoader} from '../takeoff-slots.js';
const now=Date.parse('2026-09-13T12:00:00Z'),at=m=>new Date(now+m*60000).toISOString();
const flight={ident:'RPA4397',ident_iata:'AA4397',origin:{code_icao:'KJFK'},destination:{code_icao:'KBOS'},scheduled_out:at(60),estimated_off:at(90)};
const env={SLOT_FAA_ENABLED:'true',SLOT_FAA_PUBLIC_DISPLAY_APPROVED:'true',SLOT_FAA_RIGHTS_EXPIRES_AT:at(1440),SLOT_FAA_URL:'https://adapter.example/slots',SLOT_FAA_TOKEN:'fixture',SLOT_FAA_PROVIDER_NAME:'Test adapter'};
const config=slotConfig(env,now)[0];
const record={authority:'FAA',kind:'EDCT',operating_ident:flight.ident,origin:'KJFK',destination:'KBOS',scheduled_out:at(60),issued_at:at(-2),verified_at:at(-1),status:'assigned',assigned_time:at(90),message_id:'TEST-1'};
const parse=(r=record,f=flight)=>normalizeSlots({records:[r]},f,config,now);
test('explicit EDCT/CTOT only; no estimate promotion or marketing-number matching',()=>{
 assert.equal(parse().assigned_time,at(90));assert.equal(parse({...record,assigned_time:undefined,estimated_off:at(90)}).status,'unavailable');assert.equal(parse({...record,operating_ident:'AA4397'}).status,'unavailable');
 for(const changes of [{origin:'KLGA'},{scheduled_out:at(61)},{kind:'estimated'},{authority:'EUROCONTROL'},{verified_at:at(2)},{issued_at:'2026-09-13T12:00:00'},{message_id:''}])assert.equal(parse({...record,...changes}).status,'unavailable');
 assert.equal(normalizeSlots({records:[{...record,authority:'EUROCONTROL',kind:'CTOT'}]},flight,{...config,authority:'EUROCONTROL'},now).kind,'CTOT');
});
test('stale, expired, removed and absent assignments never show an assigned time',()=>{
 assert.equal(parse({...record,issued_at:at(-10),verified_at:at(-6)}).status,'stale');assert.equal(parse({...record,valid_until:at(-1)}).status,'stale');
 for(const status of ['removed','not_assigned'])assert.equal(parse({...record,status}).assigned_time,null);
 assert.equal(normalizeSlots({records:[]},flight,config,now).status,'unavailable');
 const conflicting={...record,assigned_time:at(100)};assert.equal(normalizeSlots({records:[record,conflicting]},flight,config,now).status,'unavailable');
});
test('license/HTTPS gates prevent outbound requests; expiry revokes cached access',async()=>{
 let calls=0;const no=async()=>{calls++;throw Error('must not fetch')};
 for(const changes of [{SLOT_FAA_ENABLED:'false'},{SLOT_FAA_PUBLIC_DISPLAY_APPROVED:'false'},{SLOT_FAA_RIGHTS_EXPIRES_AT:at(-1)},{SLOT_FAA_URL:'http://adapter.example'},{SLOT_FAA_TOKEN:''}])assert.equal((await createSlotLoader(no,{...env,...changes},()=>now)(flight)).status,'unavailable');
 assert.equal(calls,0);
 let clock=now;const short={...env,SLOT_FAA_RIGHTS_EXPIRES_AT:at(1)};const load=createSlotLoader(async()=>new Response(JSON.stringify({records:[record]})),short,()=>clock);assert.equal((await load(flight)).status,'assigned');clock+=120000;assert.equal((await load(flight)).status,'unavailable');
});
test('adapter uses authenticated bounded request, coalesces, handles errors and rejects rollback',async()=>{
 let calls=0,clock=now,rows=[record];const load=createSlotLoader(async(url,opts)=>{calls++;assert.equal(url.searchParams.get('operating_ident'),'RPA4397');assert.equal(opts.headers.Authorization,'Bearer fixture');assert.equal(opts.redirect,'error');return new Response(JSON.stringify({records:rows}));},env,()=>clock);
 await Promise.all([load(flight),load(flight)]);assert.equal(calls,1);clock+=31000;rows=[{...record,status:'removed',issued_at:at(0),verified_at:at(0)}];assert.equal((await load(flight)).status,'removed');clock+=31000;rows=[record];assert.equal((await load(flight)).status,'unavailable');
 assert.equal((await createSlotLoader(async()=>new Response('{}',{status:429}),env,()=>now)(flight)).status,'unavailable');
 assert.equal((await createSlotLoader(async()=>new Response('x'.repeat(140000)),env,()=>now)(flight)).status,'unavailable');
 assert.equal((await load({...flight,actual_off:at(0)})).status,'not_applicable');
});
