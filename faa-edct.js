import {monitor} from './risk-monitor.js';
export const FAA_EDCT_URL='https://www.fly.faa.gov/edct/';
const POST_URL='https://www.fly.faa.gov/edct/showEDCT';
const text=value=>String(value).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const unknown=reason=>({status:'unavailable',assigned_time:null,provider:'FAA EDCT public lookup',source_url:FAA_EDCT_URL,reason});
function utc(value){const m=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value);if(!m)return null;const s=`${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:00.000Z`;const n=Date.parse(s);return Number.isFinite(n)&&new Date(n).toISOString()===s?s:null;}
export function edctQuery(flight,now=Date.now()){
 const origin=flight.origin?.code_icao||flight.origin?.code||'';
 if(!/^(K[A-Z]{3}|P[AH][A-Z]{2}|T[JI][A-Z]{2})$/.test(origin)||!/^\w{2,7}$/.test(flight.ident||'')||flight.actual_off||flight.actual_in||flight.cancelled||flight.schedule_only)return null;
 const departure=Date.parse(flight.scheduled_out),delta=departure-now;
 if(!Number.isFinite(delta)||delta< -2*3600000||delta>24*3600000)return null;
 const airport=a=>a?.code_lid||a?.code_iata||a?.code_icao||a?.code;
 const dept=airport(flight.origin),arr=airport(flight.destination);
 if(!/^[A-Z0-9]{3,4}$/.test(dept||'')||!/^[A-Z0-9]{3,4}$/.test(arr||''))return null;
 return {callsign:flight.ident,dept,arr};
}
export function parseFaaEdct(html,flight,query,checkedAt=new Date().toISOString()){
 if(typeof html!=='string'||html.length>131072||!/<title>EDCT Information<\/title>/i.test(html)||!/All Dates\/Times are in\s*<b>Zulu<\/b>/i.test(html))return unknown('The FAA lookup response could not be verified.');
 for(const [label,value]of [['CALL SIGN',query.callsign],['ORIGIN',query.dept],['DESTINATION',query.arr]]){
  const m=new RegExp(`${label}:?(?:&nbsp;|\\s)*<\\/td>\\s*<td\\b[^>]*>([\\s\\S]*?)<\\/td>`,'i').exec(html);
  if(!m||text(m[1])!==value)return unknown('The FAA lookup did not confirm the requested operating flight and route.');
 }
 const heading=/<th\b[^>]*>\s*EDCT\s*<\/th>/i.exec(html);if(!heading)return unknown('No date-matched assignment was returned. This does not establish that no slot exists.');
 const start=html.lastIndexOf('<table',heading.index),end=html.indexOf('</table>',heading.index);if(start<0||end<0)return unknown('FAA table format changed.');
 const table=html.slice(start,end),headers=[...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>text(m[1]));
 if(headers.join('|')!=='EDCT|Filed Departure Time|Control Element|Flight Cancelled?')return unknown('FAA table columns changed.');
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>text(c[1]))).filter(r=>r.length===4);
 // Match the complete filed date/time, never simply the first row or today's date.
 const candidates=rows.filter(r=>utc(r[1])&&Date.parse(utc(r[1]))===Date.parse(flight.scheduled_out));
 if(candidates.length!==1)return unknown(candidates.length?'More than one FAA assignment matches this departure.':'The FAA filed departure does not exactly match this flight’s scheduled departure.');
 const row=candidates[0],assigned=utc(row[0]);
 if(row[3]!=='No')return unknown('FAA flight-plan cancellation or unknown status reported. Verify with the airline; no active slot is shown.');
 if(!assigned||Math.abs(Date.parse(assigned)-Date.parse(flight.scheduled_out))>86400000)return unknown('An explicit, valid EDCT was not returned.');
 if(Date.parse(assigned)<Date.parse(checkedAt)-900000)return {...unknown('The FAA-reported slot has passed; refresh for a current assignment.'),status:'stale'};
 return {status:'assigned',authority:'FAA',kind:'EDCT',assigned_time:assigned,filed_departure:utc(row[1]),control_element:row[2].slice(0,80),provider:'FAA EDCT public lookup',source_url:FAA_EDCT_URL,verified_at:checkedAt,issued_at:null,reason:null,matching:'Exact operating callsign, queried route and filed departure UTC matched. Filed and scheduled times can differ; unmatched records are not guessed.',notice:'FAA-reported takeoff slot, not gate departure or takeoff clearance. It can change. Follow the airline’s boarding guidance.'};
}
export function createPublicEdctLoader(fetcher=fetch,env=process.env,clock=Date.now){
 const cache=new Map(),pending=new Map();let windowStart=0,count=0,blockedUntil=0;
 return async flight=>{
  if(env.ENABLE_FAA_EDCT_LOOKUP==='false')return unknown('FAA public EDCT lookup is disabled.');
  const q=edctQuery(flight,clock());if(!q)return unknown('FAA public EDCT lookup is limited to nearby US departures with a known operating flight.');
  const key=JSON.stringify([q,flight.scheduled_out]),old=cache.get(key);
  if(old&&clock()-old.at<120000)return old.value;
  if(pending.has(key))return pending.get(key);
  if(clock()<blockedUntil)return unknown('FAA lookup is temporarily unavailable. Try again later.');
  if(clock()-windowStart>=60000){count=0;windowStart=clock();}
  if(count>=10)return unknown('FAA lookup capacity is temporarily limited. Try again shortly.');count++;
  const task=(async()=>{
   let value;
   try{
    const response=await fetcher(POST_URL,{method:'POST',body:new URLSearchParams(q),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Envolio/1.0 (+https://envolio.travel; flight-specific EDCT lookup)'},signal:AbortSignal.timeout(4000),redirect:'error'});
    if(!response.ok){if([403,429].includes(response.status))blockedUntil=clock()+900000;throw Error('FAA lookup unavailable');}
    const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)throw Error('FAA response too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
    value=parseFaaEdct(Buffer.concat(chunks).toString('utf8'),flight,q,new Date(clock()).toISOString());
   }catch{monitor('provider_failure','FAA EDCT public lookup');value=unknown('FAA lookup could not be reached. No assignment is assumed.');}
   cache.set(key,{at:clock(),value});if(cache.size>300)cache.delete(cache.keys().next().value);return value;
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 };
}
export const loadPublicEdct=createPublicEdctLoader();
