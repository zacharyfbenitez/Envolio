export const RISK_RELEASE='risk-audit-v4';
export function scoreAudit(index,previous=null){
 const factors=index.factors||[],weight=factors.reduce((s,f)=>s+(Number.isFinite(f.value)?f.weight:0),0);
 const priorWeight=previous?factors.reduce((s,f)=>s+(Number.isFinite(previous.factors?.[f.key])?f.weight:0),0):0;
 const rows=factors.map(f=>{
  const available=Number.isFinite(f.value),receipt=f.source_detail||{};
  const kind=!available?'Unavailable':f.key==='route'?'Historical outcomes':receipt.forecast_used?'Forecast + heuristic':f.key==='inbound'?'Live aircraft + heuristic':f.key.includes('airport')?'Live airport report + heuristic':f.key.includes('weather')?'Observation + heuristic':f.key==='schedule'?'Live estimate + heuristic':'Live operations sample';
  const before=previous?.factors?.[f.key],contribution=available&&weight?f.value*f.weight/weight:0;
  const prior=Number.isFinite(before)&&priorWeight?before*f.weight/priorWeight:0;
  return {...f,evidence_label:kind,contribution_points:Number(contribution.toFixed(2)),change_points:previous?Number((contribution-prior).toFixed(2)):null,change_reason:!previous?'First observation':!Number.isFinite(before)&&available?'Data became available; weights adjusted':Number.isFinite(before)&&!available?'Data became unavailable; remaining weights adjusted':before!==f.value?'Source signal changed':Math.abs(contribution-prior)>.001?'Other inputs changed availability; weights adjusted':'Unchanged'};
 });
 return {version:RISK_RELEASE,rows,warning_summary:index.operational_warnings?.length?'Important risk signals are present. The overall estimate averages several factors, so a moderate percentage does not mean all clear.':null,policy:'Factor scores are risk indicators, not separate delay probabilities. Available weights are normalized. Forecasts and aircraft timing use unvalidated rules; missing inputs are not favorable evidence.'};
}
export function airportIndicators(flight,origin,arrival,faa,now=Date.now()){
 return [[flight.origin,origin],[flight.destination,arrival]].map(([airport,data])=>{
  const code=airport?.code_iata||airport?.code_icao||airport?.code;
  const fresh=stamp=>Number.isFinite(Date.parse(stamp))&&now-Date.parse(stamp)<=1800000&&now-Date.parse(stamp)>=-300000;
  const faaFresh=faa?.status==='available'&&fresh(faa.observed_at);
  const events=faaFresh?(faa.events||[]).filter(e=>[code,airport?.code_icao].includes(e.airport)&&!/GA ONLY|PPR|NON.?SKED|TRANSIENT/i.test(e.reason||'')):[];
  const live=data&&fresh(data.retrieved_at);
  return {airport:code,source:'FAA NAS status / FlightAware airport delays',updated_at:faa?.observed_at||data?.retrieved_at||null,items:['Ground stop','Ground delay','Closure','Congestion'].map(label=>{
   const matches=events.filter(e=>new RegExp(label==='Closure'?'clos':label==='Congestion'?'arrival|departure':label,'i').test(e.type||''));
   const congested=label==='Congestion'&&live&&['red','yellow'].includes(data.color);
   return {label,status:matches.length||congested?'reported':(label==='Congestion'?live:faaFresh)?'not_reported':'unavailable',detail:matches.map(e=>e.reason).join('; ')||(congested?data.reasons?.[0]?.reason:null)};
  })};
 });
}
export function historicalTrend(points=[]){
 const valid=points.filter(p=>Number.isFinite(p.minutes)&&Number.isFinite(Date.parse(p.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const half=Math.floor(valid.length/2),summarize=rows=>({samples:rows.length,delayed_percent:rows.length?Math.round(rows.filter(r=>r.minutes>=15).length/rows.length*100):null,from:rows[0]?.date,to:rows.at(-1)?.date});
 return {scope:'This flight number and route; not the whole airline',earlier:summarize(valid.slice(0,half)),recent:summarize(valid.slice(half)),sufficient:half>=3};
}
