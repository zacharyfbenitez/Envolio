import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {completedHistory,routeValidation} from '../validation.js';
import {assessTaf,rotationRisk,observationRisk} from '../operational-risk.js';
import {scoreAudit,airportIndicators,historicalTrend} from '../risk-audit.js';
import {monitor,monitoringSummary} from '../risk-monitor.js';
test('AA4397 storm + earlier rotation uses actual production scorer, no duplicated inbound weight',async()=>{
 const source=await readFile('server.js','utf8');
 const scorer=source.slice(source.indexOf('function createLiveDelayIndex('),source.indexOf('\nconst requestWindows='));
 const minutesSource=source.slice(source.indexOf('function minutesLate('),source.indexOf('\n}',source.indexOf('function minutesLate('))+2);
 const create=vm.runInNewContext(`${minutesSource}\n${scorer}\ncreateLiveDelayIndex`,{completedHistory,routeValidation,observationRisk,awcMetarEnabled:false});
 const now=Date.now(),at=m=>new Date(now+m*60000).toISOString(),ap=code=>({code_icao:code,code_iata:code.slice(1)});
 const flight={ident:'RPA4397',ident_iata:'AA4397',origin:ap('KJFK'),destination:ap('KBOS'),scheduled_out:at(240),estimated_out:at(240),scheduled_in:at(330)};
 const inbound={ident:'RPA4633',origin:ap('KBOS'),destination:ap('KJFK'),scheduled_in:at(180),estimated_in:at(280)};
 const earlier={ident:'RPA4370',origin:ap('KJFK'),destination:ap('KBOS'),scheduled_in:at(60),estimated_in:at(180)};
 const rotation=rotationRisk({legs:[{...inbound,scheduled_out:at(90)},earlier]},flight);
 const forecast=assessTaf({status:'available',data:[{icaoId:'KJFK',issueTime:at(-30),validTimeFrom:now/1000,validTimeTo:(now+86400000)/1000,fcsts:[{timeFrom:now/1000,timeTo:(now+86400000)/1000,wxString:'TSRA',wspd:25,visib:2,clouds:[{cover:'BKN',base:500}]}]}]},'KJFK',at(240),now);
 const clear=create(flight,{flights:[]},{}),risk=create(flight,{flights:[]},{inbound,rotationRisk:rotation,originForecast:forecast});
 assert.ok(risk.score>clear.score);assert.ok(risk.factors.find(f=>f.key==='origin_weather').value>=50);assert.equal(risk.factors.filter(f=>f.key==='inbound').length,1);assert.equal(risk.calibration.material_signal,false);
 risk.operational_warnings=forecast.warnings;assert.match(scoreAudit(risk).warning_summary,/moderate/);
 const missing=create(flight,{flights:[]},{originDelay:{color:'green',retrieved_at:at(-60)}});assert.equal(missing.factors.find(f=>f.key==='origin_airport').value,null);
});
test('audit captures missing signals and contribution reweighting',()=>{
 const index={factors:[{key:'route',value:50,weight:.5},{key:'origin_weather',value:80,weight:.5,source_detail:{forecast_used:true}}]};
 const audit=scoreAudit(index,{factors:{route:50,origin_weather:null}});assert.equal(audit.rows[0].change_points,-25);assert.match(audit.rows[1].change_reason,/became available/);assert.equal(audit.rows[1].evidence_label,'Forecast + heuristic');
});
test('airport unknown and stale are not all clear; history requires actual usable sample',()=>{
 const flight={origin:{code_iata:'JFK'},destination:{code_iata:'BOS'}};
 assert.ok(airportIndicators(flight,null,null,{status:'stale',events:[]})[0].items.every(i=>i.status==='unavailable'));
 const result=airportIndicators(flight,null,null,{status:'available',observed_at:new Date().toISOString(),events:[{airport:'JFK',type:'Ground Stop',reason:'Weather'}]});assert.equal(result[0].items[0].status,'reported');assert.equal(historicalTrend([]).sufficient,false);
});
test('monitor emits scoring and provider alerts without flight identifiers',()=>{
 monitor('score',{score:101,factors:[]});for(let i=0;i<5;i++)monitor('provider_failure','fixture');
 assert.ok(monitoringSummary().alerts.some(a=>a.kind==='scoring_regression'));assert.ok(monitoringSummary().alerts.some(a=>a.kind==='provider_failure:fixture'));
 for(let i=0;i<35;i++)monitor('score',{score:0,factors:[{key:'route',value:0,weight:1}]});assert.ok(monitoringSummary().alerts.some(a=>a.kind==='risk_distribution'));
});
