// Contract for an authorized upstream adapter, NOT an undocumented FAA/NM API.
// An adapter must map official EDCT/CTOT messages, including withdrawal events.
import {monitor} from './risk-monitor.js';
const iso=value=>typeof value==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const stamp=value=>iso(value)?Date.parse(value):NaN;
const airport=a=>a?.code_icao||(/^[A-Z]{4}$/.test(a?.code||'')?a.code:null);
const unavailable=reason=>({status:'unavailable',reason,assigned_time:null,notice:'An estimated takeoff time is not an assigned ATC slot.'});
export function slotConfig(env=process.env,now=Date.now()){
 return ['FAA','EUROCONTROL'].map(authority=>{
  const prefix=`SLOT_${authority}_`,url=env[prefix+'URL'],expires=env[prefix+'RIGHTS_EXPIRES_AT'];
  let validURL=false;try{const parsed=new URL(url);validURL=parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.hash;}catch{}
  return {authority,url,token:env[prefix+'TOKEN'],enabled:env[prefix+'ENABLED']==='true'&&env[prefix+'PUBLIC_DISPLAY_APPROVED']==='true'&&stamp(expires)>now&&validURL&&Boolean(env[prefix+'TOKEN']),provider:String(env[prefix+'PROVIDER_NAME']||authority).slice(0,80)};
 });
}
export function normalizeSlots(body,flight,config,now=Date.now()){
 if(!config.enabled)return unavailable('Source access or public-display permission is not configured.');
 if(!Array.isArray(body?.records)||body.records.length>50)return unavailable('The slot source returned an unsupported response.');
 const origin=airport(flight.origin),destination=airport(flight.destination);
 if(!origin||!destination||!iso(flight.scheduled_out))return unavailable('Flight details are insufficient to match an official slot.');
 const records=body.records.filter(r=>r&&r.authority===config.authority&&r.kind===(config.authority==='FAA'?'EDCT':'CTOT')&&r.origin===origin&&r.destination===destination&&stamp(r.scheduled_out)===stamp(flight.scheduled_out)&&r.operating_ident===flight.ident&&typeof r.message_id==='string'&&r.message_id.length>0&&r.message_id.length<=160&&['assigned','revised','removed','not_assigned'].includes(r.status)&&iso(r.issued_at)&&iso(r.verified_at)&&stamp(r.issued_at)<=stamp(r.verified_at)&&stamp(r.verified_at)<=now+60000);
 if(!records.length)return unavailable('No verified slot record matched this operating flight, route and departure.');
 records.sort((a,b)=>stamp(b.issued_at)-stamp(a.issued_at));const r=records[0];
 if(records.some(other=>stamp(other.issued_at)===stamp(r.issued_at)&&(other.status!==r.status||other.assigned_time!==r.assigned_time)))return unavailable('The slot source returned conflicting revisions.');
 // verified_at means the adapter has reconciled the current assignment, NOT fetch time.
 if(now-stamp(r.verified_at)>300000)return {...unavailable('The last slot report is too old to show as current.'),status:'stale'};
 if(r.status==='assigned'||r.status==='revised'){
  if(!iso(r.assigned_time)||Math.abs(stamp(r.assigned_time)-stamp(flight.scheduled_out))>86400000)return unavailable('The assignment time could not be verified.');
  if(stamp(r.assigned_time)<now-900000)return {...unavailable('The reported takeoff slot has passed; a current assignment is unavailable.'),status:'stale'};
 }
 if(r.valid_until!==undefined&&(!iso(r.valid_until)||stamp(r.valid_until)<now))return {...unavailable('The slot record has expired.'),status:'stale'};
 return {status:r.status,kind:r.kind,authority:r.authority,provider:config.provider,assigned_time:['assigned','revised'].includes(r.status)?r.assigned_time:null,previous_time:iso(r.previous_time)?r.previous_time:null,issued_at:r.issued_at,verified_at:r.verified_at,message_id:r.message_id,reason:typeof r.reason==='string'?r.reason.slice(0,300):null,notice:'ATC-assigned takeoff time, not gate departure or takeoff clearance. It can change. Follow the airline’s boarding guidance.'};
}
export function createSlotLoader(fetcher=fetch,env=process.env,clock=Date.now){
 const cache=new Map(),pending=new Map(),latest=new Map();
 return async flight=>{
  if(flight.actual_off||flight.actual_in||flight.cancelled||flight.schedule_only)return {status:'not_applicable',assigned_time:null};
  const config=slotConfig(env,clock()).filter(c=>c.enabled);
  if(!config.length)return unavailable('An authorized takeoff-slot feed is not connected yet.');
  const results=await Promise.all(config.map(async c=>{
   const key=JSON.stringify([c.authority,c.url,c.provider,c.token,flight.ident,airport(flight.origin),airport(flight.destination),flight.scheduled_out]);
   const load=async()=>{
    try{
     const url=new URL(c.url);for(const [k,v]of Object.entries({operating_ident:flight.ident,origin:airport(flight.origin),destination:airport(flight.destination),scheduled_out:flight.scheduled_out}))if(v)url.searchParams.set(k,v);
     const response=await fetcher(url,{headers:{Authorization:`Bearer ${c.token}`,Accept:'application/json'},signal:AbortSignal.timeout(3000),redirect:'error'});
     if(!response.ok)throw Error('slot provider unavailable');
     // Bound streamed response size; never accept an unbounded vendor payload.
     const reader=response.body.getReader(),chunks=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>131072)throw Error('slot payload too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
     const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));cache.set(key,{at:clock(),body});if(cache.size>200)cache.delete(cache.keys().next().value);return body;
    }catch{monitor('provider_failure',`slot-${c.authority}`);return null;}
   };
   let body=cache.get(key);if(!body||clock()-body.at>=30000){if(!pending.has(key))pending.set(key,load().finally(()=>pending.delete(key)));body=await pending.get(key);}else body=body.body;
   const result=normalizeSlots(body,flight,c,clock()),previous=latest.get(key);
   if(result.issued_at){
    if(previous&&(stamp(result.issued_at)<stamp(previous.issued_at)||(stamp(result.issued_at)===stamp(previous.issued_at)&&(result.status!==previous.status||result.assigned_time!==previous.assigned_time))))return unavailable('An older or conflicting revision was returned; current slot cannot be confirmed.');
    latest.set(key,result);if(latest.size>200)latest.delete(latest.keys().next().value);
   }
   return result;
  }));
  const assigned=results.filter(r=>['assigned','revised'].includes(r.status));
  if(assigned.length>1)return unavailable('Multiple authorities returned assignments. Verify with the airline; no single slot is presented.');
  return assigned[0]||results.find(r=>['removed','not_assigned','stale'].includes(r.status))||results[0];
 };
}
export const loadTakeoffSlot=createSlotLoader();
