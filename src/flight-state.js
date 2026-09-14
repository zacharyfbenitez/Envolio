export const isCancelled=flight=>!!flight?.cancelled||/cancel/i.test(flight?.status||'');
export const isDiverted=flight=>!!flight?.diverted||/divert/i.test(flight?.status||'');
export const reportedStatus=flight=>isCancelled(flight)?'Cancelled':isDiverted(flight)?'Diverted':flight?.status||'Status not reported';
// Presentation only: a published estimate, not our probability model.
export function departureTimingLabel(flight,now=Date.now()){
 if(!flight||!Number.isFinite(now)||flight.schedule_only||isCancelled(flight)||isDiverted(flight)||flight.actual_out||flight.actual_off||flight.actual_in||/delay|cancel|divert|arriv|land|en route|airborne|board/i.test(flight.status||''))return null;
 const scheduled=Date.parse(flight.scheduled_out),estimated=Date.parse(flight.estimated_out),checked=Date.parse(flight.checked_at);
 if(!Number.isFinite(scheduled)||!Number.isFinite(estimated)||scheduled<=now||scheduled-now>48*3600000)return null;
 if(Number.isFinite(checked)&&(now-checked>20*60000||checked-now>5*60000))return null;
 const minutes=Math.round((estimated-scheduled)/60000);
 return minutes>0?{label:`${minutes} min delayed`,tone:'delayed',derived:true}:{label:'On time',tone:'on-time',derived:true};
}
export function positionReadout(position){
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 const location=numeric(position?.latitude)&&Math.abs(position.latitude)<=90&&numeric(position?.longitude)&&Math.abs(position.longitude)<=180;
 return {position:location?`${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°`:'Position unavailable',altitude:numeric(position?.altitude)?`${Number(position.altitude*100).toLocaleString()} ft`:'Not reported',speed:numeric(position?.groundspeed)&&position.groundspeed>=0?`${position.groundspeed} kt`:'Not reported'};
}
