/* Read-only widget: no cookies, storage, parent access, third-party scripts or secrets. */
(() => {
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 const today=new Date(),localDate=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 $('flight').value=(params.get('flight')||'').slice(0,16);
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 $('date').value=validDate(params.get('date')||'')?params.get('date'):localDate;
 const code=a=>a?.code_iata||a?.alternate_ident||a?.code_icao||a?.code||'Airport unknown';
 let active=null;
 async function search(event){
  event?.preventDefault();$('result').hidden=true;const flight=$('flight').value.replace(/[\s-]/g,'').toUpperCase(),date=$('date').value;
  if(!/^(?:[A-Z]{2,3}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/.test(flight)||!validDate(date)){$('message').textContent='Enter a flight number like AA4397 and a valid departure date.';$('message').className='error';return;}
  active?.abort();const controller=new AbortController();active=controller;
  const timeout=setTimeout(()=>controller.abort(),45000);
  $('check').disabled=true;$('check').textContent='Checking flight…';$('result').hidden=true;$('message').className='';$('message').textContent='Checking flight reports, weather and the incoming plane…';$('search').setAttribute('aria-busy','true');
  const query=new URLSearchParams({date});
  for(const key of ['origin','destination']){const value=(params.get(key)||'').toUpperCase();if(/^[A-Z]{3,4}$/.test(value))query.set(key,value);}
  try{
   const response=await fetch(`/api/flights/${encodeURIComponent(flight)}?${query}`,{signal:controller.signal,credentials:'omit'});
   const data=await response.json();
   if(!response.ok){throw new Error(response.status===404?'No matching flight was found. Check the number and date, or try the operating airline’s flight number.':response.status===429?'Too many checks right now. Please wait a minute and try again.':'Flight updates are temporarily unavailable. Please try again shortly.');}
   const f=data.flights?.[0];if(!f)throw new Error('No flight details were returned. Try another flight or open Envolio.');
   const index=data.delay_index,cached=data.cache_fallback?.active;
   const completed=!!f.actual_out,cancelled=f.cancelled||/cancel/i.test(f.status||'');
   const score=index?.score,usable=!cached&&!completed&&!cancelled&&!data.schedule_only&&Number.isFinite(score)&&score>=0&&score<=100&&index?.factors?.some(x=>Number.isFinite(x.value));
   $('route').textContent=`${code(f.origin)} → ${code(f.destination)}`;
   $('status').textContent=`${flight}${f.ident_iata&&f.ident_iata!==flight?` · operated as ${f.ident_iata}`:''} · ${f.status||'Status not published'}`;
   $('risk').hidden=!usable;$('unavailable').hidden=usable;
   $('unavailable').textContent=cached?'Saved update only. A fresh delay estimate is unavailable.':cancelled?'This flight is cancelled. Check rebooking options with the airline.':completed?'This flight has departed. Open the full details for arrival updates.':data.schedule_only?'Schedule found. Live delay risk becomes available closer to departure.':'Not enough current data to estimate delay risk.';
   if(usable){$('percent').textContent=`${score}%`;$('risk').className=score>=65?'high':score>=35?'caution':'';$('meter').setAttribute('aria-valuenow',score);$('fill').style.width=`${score}%`;}
   const warnings=index?.operational_warnings||[],driver=[...(index?.factors||[])].filter(f=>Number.isFinite(f.value)&&f.value>=35).sort((a,b)=>b.value*b.weight-a.value*a.weight)[0];
   $('why').textContent=usable?(warnings.length?`Watch for: ${warnings.slice(0,2).map(w=>`${w.airport?`${w.airport}: `:''}${w.title}`).join('. ')}. These signals do not confirm a delay.`:driver?`Why: ${driver.detail}`:'No strong warning appeared in the available signals. That is not an all-clear.'):'Follow the airline’s latest information.';
   $('reliability').textContent=usable?`Experimental estimate, not a proven prediction. ${index.factors.some(f=>!Number.isFinite(f.value))?'Some inputs are missing; missing data is not a favorable signal.':'Based on available flight reports, history and weather, with heuristic adjustments.'}`:'';
   const stamp=cached?data.cache_fallback.saved_at:data.refreshed_at;
   $('updated').textContent=Number.isFinite(Date.parse(stamp))?`${cached?'Saved':'Checked'} ${new Date(stamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}`:'Update time unavailable';
   const link=new URL(`/flight/${encodeURIComponent(flight)}`,location.origin);link.search=query.toString();$('details').href=link.href;
   $('message').textContent=data.route_options?.length>1?'Multiple flight legs matched. Check the route below; choose another leg in full details.':'';
   $('result').hidden=false;
  }catch(error){$('message').className='error';$('message').textContent=error.name==='AbortError'?'This check is taking too long. Please try again.':error instanceof SyntaxError?'Flight updates are temporarily unavailable. Please try again.':error.message||'Unable to check this flight. Please try again.';}
  finally{clearTimeout(timeout);$('check').disabled=false;$('check').innerHTML='Check flight <span aria-hidden="true">→</span>';$('search').removeAttribute('aria-busy');}
 }
 $('search').addEventListener('submit',search);
 if($('flight').value)search();
})();
