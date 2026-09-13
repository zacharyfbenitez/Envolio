import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberFlight,SAVED_KEY,journeySnapshot} from '../src/journeys.js';
test('reopening a favorite updates its saved summary without losing other favorites',()=>{
 const storage=new Map(),prior=globalThis.localStorage;
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 try{
  const origin={code_iata:'LGA'},destination={code_iata:'YYZ'},old={ident:'PD604',date:'2026-09-14',key:'existing-key',origin,destination},other={...old,ident:'PD605',key:'other-key'};
  storage.set(SAVED_KEY,JSON.stringify([old,other]));
  rememberFlight(old.ident,old.date,{origin,destination,estimated_out:'2026-09-14T12:00Z',status:'Scheduled'});
  const saved=JSON.parse(storage.get(SAVED_KEY));assert.equal(saved[0].key,'existing-key');assert.equal(saved[0].snapshot.estimated_out,'2026-09-14T12:00Z');assert.deepEqual(saved[1],other);
  assert.equal(journeySnapshot({status:'Delayed',secret:'not for storage'}).secret,undefined);
 }finally{globalThis.localStorage=prior;}
});
