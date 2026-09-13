const events=[],alerts=[],lastAlert=new Map();
function alert(kind,detail){
 if(Date.now()-(lastAlert.get(kind)||0)<900000)return;
 lastAlert.set(kind,Date.now());const event={kind,detail,at:new Date().toISOString()};alerts.push(event);if(alerts.length>100)alerts.shift();console.warn(JSON.stringify({monitor:'envolio',...event}));
 const url=process.env.MONITOR_WEBHOOK_URL;
 if(url?.startsWith('https://'))fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:`Envolio monitoring: ${kind}. ${detail}`}),signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)console.warn('Monitoring webhook rejected delivery')}).catch(()=>console.warn('Monitoring webhook delivery failed'));
}
export function monitor(kind,value){
 events.push({kind,value:kind==='score'?{score:value.score}:value,at:Date.now()});while(events.length>500||events[0]?.at<Date.now()-3600000)events.shift();
 if(kind==='score'){
  const rows=value.factors||[],usable=rows.filter(f=>Number.isFinite(f.value)),weight=usable.reduce((s,f)=>s+f.weight,0),expected=usable.reduce((s,f)=>s+f.value*f.weight,0)/weight;
  const adjusted=Math.max(expected,value.slot_adjustment?.risk_floor||0);
  if(!Number.isFinite(value.score)||value.score<0||value.score>100||Math.abs(adjusted-value.score)>1||new Set(rows.map(f=>f.key)).size!==rows.length)alert('scoring_regression','Score range, factor uniqueness or weighted-score/slot-floor invariant failed.');
  const scores=events.filter(e=>e.kind==='score').map(e=>e.value.score);
  if(scores.length>=30&&(scores.filter(s=>s<=5).length/scores.length>.9||scores.filter(s=>s>=95).length/scores.length>.9))alert('risk_distribution','Over 90% of at least 30 estimates are at an extreme. Investigate source coverage; this is not proof of model failure.');
 }
 if(kind==='provider_failure'&&events.filter(e=>e.kind===kind&&e.value===value).length>=5)alert('provider_failure:'+value,'At least five failures in the rolling hour. Check provider availability and account limits.');
}
export function monitoringSummary(){return {window:'Up to 500 events in the last hour, per process; resets on restart',external_delivery_configured:Boolean(process.env.MONITOR_WEBHOOK_URL),counts:Object.fromEntries(['score','provider_failure'].map(k=>[k,events.filter(e=>e.kind===k&&e.at>Date.now()-3600000).length])),alerts};}
