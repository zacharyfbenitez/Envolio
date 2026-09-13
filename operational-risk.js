// Bounded, explainable operational heuristics. None are calibrated delay probabilities.
const time=v=>Date.parse(v);
const airport=a=>a?.code_icao||a?.code||a?.code_iata;
const cancelled=f=>f?.cancelled||/cancel/i.test(f?.status||'');
const severe=wx=>/TS|thunderstorm|FZRA|freezing rain|\bSN\b|snow|\bFG\b|fog/i.test(wx||'');
export function observationRisk(data,now=Date.now()){
 const o=data?.observations?.[0],age=now-time(o?.time||o?.report_time);
 if(!o||!Number.isFinite(age)||age< -300000||age>7200000)return null;
 const raw=o.raw_data||'',ceilings=[...raw.matchAll(/\b(?:BKN|OVC|VV)(\d{3})/g)].map(m=>Number(m[1])*100);
 const ceiling=ceilings.length?Math.min(...ceilings):null;
 const gust=o.wind_speed_gust??o.wind_speed,visibility=o.visibility;
 if(!Number.isFinite(gust)&&!Number.isFinite(visibility)&&ceiling===null&&!o.conditions&&!o.cloud_friendly)return null;
 return Math.min(1,(Number.isFinite(gust)?gust>=35?.55:gust>=22?.28:.08:0)+(Number.isFinite(visibility)&&visibility<3?.3:0)+(ceiling!==null&&ceiling<1000?.3:0)+(severe(o.conditions)?.38:0));
}
const epoch=v=>typeof v==='number'?v*1000:time(v);
function periodRisk(p){
 const ceiling=Math.min(...(p.clouds||[]).filter(c=>['BKN','OVC','VV'].includes(c.cover)&&Number.isFinite(c.base)).map(c=>c.base));
 const gust=p.wgst??p.wspd,vis=typeof p.visib==='number'?p.visib:p.visib==='6+'?6.1:null;
 if(!Number.isFinite(gust)&&vis===null&&!(p.clouds||[]).length&&!p.wxString)return null;
 const risk=Math.min(1,.08+(Number.isFinite(gust)&&gust>=35?.5:Number.isFinite(gust)&&gust>=22?.2:0)+(vis!==null&&vis<3?.3:0)+(ceiling<1000?.3:0)+(severe(p.wxString)?.5:0));
 return Number.isFinite(p.probability)?risk*Math.min(1,Math.max(0,p.probability/100)):risk;
}
export function forecastConditions(periods){
 const details=[];const wx=periods.map(p=>p.wxString||'').join(' ');
 if(/TS|thunderstorm/i.test(wx))details.push('Thunderstorms');
 if(/FZRA|freezing rain/i.test(wx))details.push('Freezing rain');
 if(/SN|snow/i.test(wx))details.push('Snow');
 if(/FG|fog/i.test(wx))details.push('Fog');
 const ceilings=periods.flatMap(p=>(p.clouds||[]).filter(c=>['BKN','OVC','VV'].includes(c.cover)&&Number.isFinite(c.base)&&c.base<1000).map(c=>c.base));
 const visibility=periods.map(p=>p.visib).filter(v=>typeof v==='number'&&v<3);
 const winds=periods.map(p=>p.wgst??p.wspd).filter(v=>Number.isFinite(v)&&v>=22);
 if(ceilings.length)details.push(`Cloud ceiling as low as ${Math.min(...ceilings)} ft`);
 if(visibility.length)details.push(`Visibility as low as ${Math.min(...visibility)} ${Math.min(...visibility)===1?'mile':'miles'}`);
 if(winds.length)details.push(`Winds up to ${Math.max(...winds)} knots`);
 return details;
}
export function assessTaf(result,icao,target,now=Date.now()){
 const receipt={provider:'NOAA Aviation Weather Center',endpoint:`https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`,retrieved_at:result?.retrieved_at||null};
 const unavailable=reason=>({...receipt,status:'unavailable',reason,score:null,warnings:[]});
 if(result?.status!=='available')return unavailable(result?.status||'not_returned');
 const taf=result.data?.find(r=>r.icaoId===icao),at=time(target),issued=time(taf?.issueTime);
 if(!taf||!Number.isFinite(at)||!Number.isFinite(issued)||issued>now+300000||now-issued>12*3600000||at<now-3600000||epoch(taf.validTimeFrom)>at||epoch(taf.validTimeTo)<=at)return unavailable('No current airport forecast covers this flight time');
 if(!Array.isArray(taf.fcsts))return unavailable('Malformed forecast periods');
 const periods=taf.fcsts.filter(p=>Number.isFinite(epoch(p.timeFrom))&&Number.isFinite(epoch(p.timeTo)));
 const relevant=periods.filter(p=>epoch(p.timeFrom)<at+3600000&&epoch(p.timeTo)>at-3600000);
 if(!relevant.some(p=>!p.probability&&(!p.fcstChange||p.fcstChange==='FM')&&Number.isFinite(periodRisk(p))))return unavailable('Forecast periods could not be matched');
 const currentStorms=relevant.filter(p=>severe(p.wxString));
 const earlier=periods.filter(p=>severe(p.wxString)&&epoch(p.timeTo)<=at-3600000&&epoch(p.timeTo)>at-12*3600000);
 const warnings=[];
 if(currentStorms.length||Math.max(...relevant.map(periodRisk))>=.35){const conditions=forecastConditions(currentStorms.length?currentStorms:relevant);warnings.push({kind:'flight_weather',title:`${conditions.slice(0,2).join(' · ')||'Forecast disruption signal'} near flight time`,detail:`${conditions.join('; ')||'The returned forecast contains a disruption signal'}. These conditions are forecast at this airport within an hour of the planned flight time. They may slow arrivals or departures; an airport restriction or a flight delay is not confirmed.`});}
 if(!currentStorms.length&&earlier.length)warnings.push({kind:'earlier_weather',title:'Earlier weather may affect incoming flights',detail:'Disruptive weather is forecast earlier in the day, but no thunderstorm period matches this flight’s time window. Aircraft or airport delays can continue afterward; carry-over is not confirmed.'});
 return {...receipt,status:'available',score:Math.max(...relevant.map(periodRisk)),issued_at:taf.issueTime,target_at:target,raw:taf.rawTAF,warnings:warnings.map(w=>({...w,source:receipt.provider,issued_at:taf.issueTime,periods:(w.kind==='earlier_weather'?earlier:currentStorms.length?currentStorms:relevant.filter(p=>periodRisk(p)>=.35)).map(p=>({from:new Date(epoch(p.timeFrom)).toISOString(),to:new Date(epoch(p.timeTo)).toISOString(),weather:p.wxString,weather_probability:p.probability??null}))})),policy:'Highest applicable forecast pressure replaces, rather than adds to, current weather pressure. Weather probabilities are not delay probabilities; earlier weather produces a warning only.'};
}
export function createTafLoader(fetcher=fetch,now=Date.now){
 const cache=new Map(),pending=new Map();
 let windowStart=now(),requests=0;
 return async function load(icao,target){
  if(!/^[A-Z]{4}$/.test(icao||''))return assessTaf(null,icao,target,now());
  if(process.env.ENABLE_AWC_TAF==='false')return assessTaf({status:'disabled'},icao,target,now());
  let result=cache.get(icao);
  if(!result||now()-time(result.retrieved_at)>(result.status==='available'?600000:60000)){
   if(!pending.has(icao)){
    if(now()-windowStart>=60000){windowStart=now();requests=0;}
    if(requests>=60)return assessTaf({status:'request_budget'},icao,target,now());
    requests++;
    pending.set(icao,(async()=>{
    let value;try{const r=await fetcher(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`,{headers:{'User-Agent':'Envolio/1.0 (envolio.travel weather)'},signal:AbortSignal.timeout(3500)});value={status:r.ok&&r.status!==204?'available':`http_${r.status}`,data:r.ok&&r.status!==204?await r.json():null,retrieved_at:new Date(now()).toISOString()};if(!Array.isArray(value.data))value.status='unavailable';}catch{value={status:'timeout_or_network',retrieved_at:new Date(now()).toISOString()};}
    cache.set(icao,value);if(cache.size>100)cache.delete(cache.keys().next().value);return value;
    })().finally(()=>pending.delete(icao)));
   }
   result=await pending.get(icao);
  }
  return assessTaf(result,icao,target,now());
 };
}
export const loadTaf=createTafLoader();
export async function traceRotation(current,first,lookup,maxLegs=3){
 const legs=[],seen=new Set([current.fa_flight_id]),warnings=[];let next=current,candidate=first;
 for(let i=0;i<maxLegs;i++){
  const id=next.inbound_fa_flight_id;if(!id)break;
  if(seen.has(id)){warnings.push('Aircraft rotation contains a repeated flight; traversal stopped.');break;}
  if(!candidate){let timer;try{candidate=(await Promise.race([lookup(`/flights/${encodeURIComponent(id)}?max_pages=1`),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2500);})]))?.flights?.find(f=>f.fa_flight_id===id);}catch{candidate=null;}finally{clearTimeout(timer);}}
  const matching=candidate?.fa_flight_id===id&&airport(candidate.destination)===airport(next.origin)&&Number.isFinite(time(candidate.scheduled_out))&&time(candidate.scheduled_out)<time(next.scheduled_out)&&time(next.scheduled_out)-time(candidate.scheduled_out)<48*3600000&&candidate.registration&&next.registration&&candidate.registration===next.registration;
  if(!matching){warnings.push('An earlier aircraft assignment or route could not be verified.');break;}
  legs.push(candidate);seen.add(id);if(candidate.actual_out||candidate.actual_in)break;next=candidate;candidate=null;
 }
 return {legs,warnings,limit:maxLegs,policy:'Only exact provider-linked, same-tail, connected legs are used; stop once a leg has departed, or at swaps, unknown assignments or the request limit. Each additional lookup has a 2.5-second wait budget.'};
}
export function rotationRisk(rotation,current,forecasts=[]){
 let propagated=0,risk=null;const warnings=[];
 for(const leg of [...rotation.legs].reverse()){
  if(leg.actual_in){propagated=0;continue;}
  if(cancelled(leg)){risk=1;warnings.push({kind:'rotation',title:'An earlier flight of your plane is cancelled',detail:`${leg.ident_iata||leg.ident} is cancelled in the verified aircraft rotation. Your airline may need to reassign the plane; your own flight is not confirmed cancelled.`,source:'FlightAware linked aircraft rotation'});break;}
  const depDelay=Math.max(0,(time(leg.estimated_out)-time(leg.scheduled_out))/60000||0);
  const arrDelay=Math.max(0,(time(leg.estimated_in)-time(leg.scheduled_in))/60000||0);
  const reported=Number.isFinite(time(leg.estimated_in))?arrDelay:depDelay;
  propagated=leg.actual_out?reported:Math.max(propagated,reported);
  const downstream=rotation.legs[rotation.legs.indexOf(leg)-1]||current;
  const ground=(time(downstream.scheduled_out)-time(leg.scheduled_in))/60000;
  if(!Number.isFinite(ground)){warnings.push({kind:'rotation',title:'Earlier aircraft timing is incomplete',detail:'The previous legs are linked, but there is not enough timing data to estimate carry-over.',source:'FlightAware linked aircraft rotation'});propagated=0;continue;}
  // Explicit planning heuristic: absorb delay using ground time beyond a 45-minute allowance.
  propagated=Math.max(0,propagated-Math.max(0,ground-45));
 }
 if(propagated>0){risk=Math.max(risk||0,Math.min(1,propagated/60));warnings.push({kind:'rotation',title:'An earlier flight may hold up your plane',detail:`About ${Math.round(propagated)} minutes of delay may carry through the linked rotation after allowing 45 minutes at each stop for preparation. This is a planning estimate, not an airline minimum or a confirmed delay.`,source:'FlightAware linked aircraft rotation'});}
 const weather=forecasts.filter(f=>f.forecast?.status==='available'&&f.forecast.score>=.35).sort((a,b)=>b.forecast.score-a.forecast.score)[0];
 if(weather){risk=Math.max(risk||0,weather.forecast.score);warnings.push({kind:'rotation_weather',title:'Weather may disrupt an earlier flight of your plane',detail:`${weather.ident} has disruptive forecast conditions near its departure time. That may affect the later rotation, but extra ground time or an aircraft swap could prevent a delay to your flight.`,source:weather.forecast.provider,issued_at:weather.forecast.issued_at});}
 return {score:risk,propagated_minutes:Math.round(propagated),warnings,forecasts,policy:'Use the maximum of direct inbound risk, propagated delay and earlier-leg forecast pressure, never their sum. Airport weather already used for the current flight is excluded from upstream weather. Extra ground time can absorb earlier delays.'};
}
