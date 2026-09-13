export const isCancelled=flight=>!!flight?.cancelled||/cancel/i.test(flight?.status||'');
export const isDiverted=flight=>!!flight?.diverted||/divert/i.test(flight?.status||'');
export const reportedStatus=flight=>isCancelled(flight)?'Cancelled':isDiverted(flight)?'Diverted':flight?.status||'Status not reported';
export function positionReadout(position){
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 const location=numeric(position?.latitude)&&Math.abs(position.latitude)<=90&&numeric(position?.longitude)&&Math.abs(position.longitude)<=180;
 return {position:location?`${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°`:'Position unavailable',altitude:numeric(position?.altitude)?`${Number(position.altitude*100).toLocaleString()} ft`:'Not reported',speed:numeric(position?.groundspeed)&&position.groundspeed>=0?`${position.groundspeed} kt`:'Not reported'};
}
