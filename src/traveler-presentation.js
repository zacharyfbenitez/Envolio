const signalNames={route:'recent route history',airline:'airline operations',inbound:'incoming aircraft timing',origin_airport:'departure airport conditions',arrival_airport:'arrival airport conditions',origin_weather:'departure weather',arrival_weather:'arrival weather',schedule:'the latest departure estimate'};
export function inboundOverview(flight,current,position,cached=false,now=Date.now()){
 if(!flight)return {title:'Your incoming plane isn’t confirmed yet',advice:'We’ll show its previous flight when an aircraft is assigned. Keep following your airline’s boarding time.',tone:'neutral',map:false};
 const arrival=flight.actual_in||flight.estimated_in||flight.scheduled_in;
 const turn=(Date.parse(current.scheduled_out)-Date.parse(arrival))/60000;
 const turnMinutes=Number.isFinite(turn)?Math.round(turn):null;
 const arrived=!!flight.actual_in,estimated=!!flight.estimated_in;
 const age=now-Date.parse(position?.timestamp);
 const map=!cached&&Number.isFinite(age)&&age>=0&&age<=15*60000&&Number.isFinite(position?.latitude)&&Math.abs(position.latitude)<=90&&Number.isFinite(position?.longitude)&&Math.abs(position.longitude)<=180;
 const late=turnMinutes!==null&&turnMinutes<0;
 const title=cached?'Last known incoming-plane update':/cancel/i.test(flight.status||'')?'Previous flight cancelled—check for an aircraft change':/divert/i.test(flight.status||'')?'Previous flight diverted—check with your airline':arrived?'Your plane has reached the gate':flight.actual_on?'Your plane has landed—not at the gate yet':flight.actual_off||/en route|airborne/i.test(flight.status||'')?'Your plane is on its way':flight.actual_out?'Your plane has left its previous gate':/scheduled/i.test(flight.status||'')?'Previous flight scheduled to depart':'Previous flight status not confirmed';
 const advice=cached?'These are saved details. Check the airline for current boarding information.':late?'The reported gate arrival is after your scheduled departure. Boarding may move; check the airline’s latest time.':arrived?'Stay near your gate if boarding is approaching, and listen for announcements.':'Follow your original check-in guidance. We’ll update this section as the previous flight progresses.';
 return {arrival,turnMinutes,arrived,estimated,map,title,advice,tone:cached?'neutral':late?'caution':arrived?'arrived':'neutral'};
}
export function travelerChance(index, future=false, cached=false, refreshed=null) {
 const label='Estimated chance of leaving 15+ minutes late';
 const timestamp=index?.live_series?.at(-1)?.at||refreshed;
 const updated=timestamp&&Number.isFinite(Date.parse(timestamp))?timestamp:null;
 const unavailable=(why,reliability)=>({label,percent:null,tone:'neutral',why,reliability,updated});
 if(future)return unavailable('Live weather and aircraft updates are not yet available for this future schedule.','Too early for a live estimate. Check again closer to departure.');
 if(cached)return unavailable('Live updates could not be retrieved. Your saved flight details are still available.','Saved information only. Refresh before relying on it.');
 // Presentation only: never recalculate the backend's weighted estimate or add provider votes.
 const factors=[...new Map((index?.factors||[]).filter(f=>Object.hasOwn(signalNames,f.key)).map(f=>[f.key,f])).values()];
 const available=factors.filter(f=>Number.isFinite(f.value));
 if(!Number.isFinite(index?.score)||index.score<0||index.score>100||!available.length)return unavailable('There isn’t enough usable evidence to give a delay percentage.','Estimate unavailable. Missing information does not mean an on-time flight.');
 const missing=Object.keys(signalNames).filter(key=>!available.some(f=>f.key===key));
 const drivers=available.filter(f=>f.value>=35).sort((a,b)=>(b.value*(b.weight||0))-(a.value*(a.weight||0))).slice(0,2);
 const why=drivers.length?`${drivers.map(f=>signalNames[f.key]).join(' and ')} ${drivers.length===1?'is':'are'} raising the estimate. A delay is not confirmed.`:'The available history and live updates show less delay pressure. That does not guarantee an on-time departure.';
 const missingGroups=[...new Set(missing.map(key=>({route:'route history',airline:'airline updates',inbound:'incoming-plane timing',origin_airport:'airport updates',arrival_airport:'airport updates',origin_weather:'weather',arrival_weather:'weather',schedule:'a departure estimate'}[key])))];
 const experimental=!index.calibration?.material_signal;
 const reliability=[experimental?'Experimental estimate—individual-flight accuracy is not yet proven.':'Validated estimate—not a guarantee.',missing.length?`Limited by missing ${missingGroups.join(', ')}. Missing data is not a good-weather or on-time signal.`:index.coverage_percent<100?'Some supporting evidence is missing; reliability is limited.':'All modeled signal groups are available.'].join(' ');
 return {label,percent:Math.round(index.score),tone:index.score>=65?'high':index.score>=35?'caution':'neutral',why,reliability,updated};
}

export function weatherWords(summary) {
 if(!summary)return 'A forecast for your flight time isn’t available yet.';
 const words={TSRA:'thunderstorms with rain',SHRA:'rain showers',SN:'snow',RA:'rain',DZ:'drizzle',FG:'fog',BR:'mist',HZ:'haze',TS:'thunderstorms',SHSN:'snow showers',FZRA:'freezing rain',CAVOK:'good visibility with no significant weather reported',NSW:'no significant weather reported'};
 return summary.replace(/\b(?:TSRA|SHRA|SHSN|FZRA|CAVOK|NSW|SN|RA|DZ|FG|BR|HZ|TS)\b/g,m=>words[m]).replace(/wind (\d+(?:\.\d+)?) kt/gi,(_,n)=>`wind around ${Math.round(Number(n)*1.852)} km/h (${Math.round(Number(n)*1.15078)} mph)`);
}
