import test from 'node:test';
import assert from 'node:assert/strict';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);

async function lookup(ident,query='') {
  const response=await fetch(`${base}/api/flights/${ident}?date=${tomorrow}${query}`);
  const data=await response.json();
  assert.equal(response.status,200,`${ident}: ${data.error||response.status}`);
  return data;
}

test('AA100 resolves directly',async()=>{
  const data=await lookup('AA100');
  assert.equal(data.flights[0].ident_iata,'AA100');
  assert.equal(data.diagnostics.match_type,'direct');
});

test('B61 falls back to JBU1',async()=>{
  const data=await lookup('B61');
  assert.equal(data.flights[0].ident_iata,'B61');
  assert.deepEqual(data.diagnostics.identifiers_tried.slice(0,2),['B61','JBU1']);
});

test('JL1 resolves through JAL1 when required',async()=>{
  const data=await lookup('JL1');
  assert.equal(data.flights[0].ident_iata,'JL1');
  assert.ok(data.diagnostics.identifiers_tried.includes('JAL1'));
});

test('SQ12 exposes and selects route legs',async()=>{
  const data=await lookup('SQ12');
  const routes=data.route_options.map(item=>`${item.origin.code_iata}-${item.destination.code_iata}`);
  assert.ok(routes.includes('NRT-LAX'));
  assert.ok(routes.includes('SIN-NRT'));
  const nrt=await lookup('SQ12','&origin=NRT');
  assert.equal(nrt.flights[0].origin.code_iata,'NRT');
});

test('BA1511 resolves to partner-operated AA100',async()=>{
  const data=await lookup('BA1511');
  assert.equal(data.flights[0].ident_iata,'AA100');
  assert.equal(data.diagnostics.match_type,'codeshare');
  assert.ok(data.diagnostics.match_confidence.score>=85);
});

test('SQ12 accepts a schedule lookup six months ahead',async()=>{
  const future=new Date();
  future.setUTCMonth(future.getUTCMonth()+6);
  const date=future.toISOString().slice(0,10);
  const response=await fetch(`${base}/api/flights/SQ12?date=${date}&origin=NRT`);
  const data=await response.json();
  assert.equal(response.status,200,data.error||String(response.status));
  assert.equal(data.schedule_only,true);
  assert.equal(data.flights[0].schedule_only,true);
  assert.equal(data.flights[0].origin.code_iata,'NRT');
  assert.match(data.schedule_notice,/Published airline schedule/);
});
