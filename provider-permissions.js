import fs from 'node:fs/promises';
import {routeValidation} from './validation.js';

// Operator-reviewed, server-side record. Never toggle commercial rights from a public request.
export function providerPermissions(review={},now=Date.now()) {
  const valid=review.provider==='Skylink'&&typeof review.agreement_reference==='string'&&review.agreement_reference.length>0
    && Date.parse(review.reviewed_at)<=now&&Date.parse(review.expires_at)>now;
  const history=valid&&review.historical_storage===true&&review.model_training===true&&review.actual_gate_timestamps_verified===true;
  const alerts=valid&&review.webhook_use===true&&Number.isInteger(review.max_active_subscriptions)&&review.max_active_subscriptions>0
    &&review.callback_authentication_verified===true&&review.worker_capacity_enforced===true;
  return {history:{enabled:!!history,status:history?'licensed_dataset_enabled':'awaiting_license_review',reason:history?'Reviewed outcome data is evaluated separately from live predictions.':'Skylink historical storage, training rights and actual gate-time semantics must be confirmed before use.'},
    alerts:{enabled:!!alerts,status:alerts?'reviewed_worker_required':'awaiting_license_and_capacity',capacity:alerts?review.max_active_subscriptions:0,reason:alerts?'A capacity-enforcing background worker must accept each subscription.':'Skylink alert licensing, subscription capacity and callback authentication have not all been confirmed.'}};
}
export async function readProviderPermissions() {
  try{return providerPermissions(JSON.parse(await fs.readFile(new URL('./.data/skylink-license-review.json',import.meta.url),'utf8')))}catch{return providerPermissions()}
}

export function evaluateLicensedOutcomes(rows,permissions,flight,now=Date.now()) {
  if(!permissions.history.enabled)return {...permissions.history,accepted:0,rejected:0,backtest:[]};
  const code=a=>a?.code_icao||a?.code||a?.code_iata;
  const accepted=[],seen=new Set();let rejected=0;
  for(const r of rows){
    // This is a reviewed normalized export, not the live /flight_status response.
    const d=Date.parse(r.scheduled_out),a=Date.parse(r.actual_out),cutoff=Math.min(now,Date.parse(flight.scheduled_out)||now);
    const key=`${r.operating_ident}|${r.scheduled_out}|${r.origin}|${r.destination}`;
    if(r.provider!=='Skylink'||r.record_type!=='actual_outcome'||r.actual_basis!=='observed_gate_event'||!r.source_record_id
      ||!r.operating_ident||!r.receipt||!Number.isFinite(Date.parse(r.receipt.retrieved_at))||Date.parse(r.receipt.retrieved_at)>now||!r.receipt.endpoint||seen.has(key)
      ||r.origin!==code(flight.origin)||r.destination!==code(flight.destination)||!(d<cutoff&&a<cutoff)||!Number.isFinite(d)||!Number.isFinite(a)
      ||Math.abs(a-d)>48*3600000){rejected++;continue;}
    seen.add(key);accepted.push({date:r.scheduled_out,actual_at:r.actual_out,minutes:Math.max(0,(a-d)/60000)});
  }
  accepted.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const tested=routeValidation(accepted);
  return {enabled:true,status:accepted.length?'evaluated':'no_eligible_outcomes',accepted:accepted.length,rejected,backtest:tested.backtest.slice(-12),brier:tested.brier,
    source:'Licensed Skylink actual outcomes',evaluation_scope:'Separate historical route baseline; not used as live prediction features or pooled with FlightAware duplicates.',model_promoted:false};
}
export async function licensedHistory(flight,permissions) {
  if(!permissions.history.enabled)return evaluateLicensedOutcomes([],permissions,flight);
  try{
    const file=new URL('./.data/skylink-reviewed-outcomes.jsonl',import.meta.url);
    if((await fs.stat(file)).size>10*1024*1024)return {enabled:true,status:'dataset_too_large',accepted:0,backtest:[]};
    const lines=(await fs.readFile(file,'utf8')).split('\n').filter(Boolean);
    return evaluateLicensedOutcomes(lines.map(l=>JSON.parse(l)),permissions,flight);
  }catch{return {enabled:true,status:'reviewed_dataset_unavailable',accepted:0,backtest:[]}}
}
