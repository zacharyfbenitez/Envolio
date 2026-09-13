const majorCodes={AAL:'AA',DAL:'DL',UAL:'UA',ASA:'AS',JBU:'B6',SWA:'WN'};
const regionalCodes=new Set(['RPA','YX','SKW','OO','EDV','9E','JIA','OH','ENY','MQ','PDT','PT','QXE','QX','ASH','YV','GJS','G7','UCA','C5','AWI','ZW']);
const clean=value=>String(value||'').replace(/\s+/g,'').toUpperCase();
export function flightOptionIdentity(flight,preferred=''){
 const operating=flight.ident_iata||flight.ident||'';
 const operator=flight.operator_icao||flight.operator_iata||flight.operator||operating.match(/^([A-Z]{3}|[A-Z0-9]{2})(?=\d)/)?.[0];
 const codes=[...new Set([...(flight.codeshares_iata||[]),...(flight.codeshares||[])].filter(v=>typeof v==='string').map(clean).map(v=>v.replace(/^(AAL|DAL|UAL|ASA|JBU|SWA)(?=\d)/,code=>majorCodes[code])))];
 const majors=codes.filter(v=>/^(AA|DL|UA|AS|B6|WN)\d{1,4}[A-Z]?$/.test(v));
 const regional=regionalCodes.has(operator)||regionalCodes.has(flight.ident?.match(/^[A-Z]{3}/)?.[0])||regionalCodes.has(operating.match(/^([A-Z]{3}|[A-Z0-9]{2})(?=\d)/)?.[0]);
 // A regional operator is not enough to invent a marketing flight number.
 const preferredMatch=majors.find(v=>v.startsWith(preferred));
 const display=regional?(preferred&&preferredMatch?preferredMatch:majors[0]||operating):operating;
 return {display,operating,marketing:display!==operating,alternates:codes.filter(v=>v!==display),carrier:display.match(/^([A-Z0-9]{2})(?=\d)/)?.[1]||flight.operator_iata||flight.operator||''};
}
export function flightOptionStatus(flight){
 const status=flight.status||'';
 if(flight.cancelled||/cancel/i.test(status))return {tone:'cancelled',label:'Cancelled'};
 if(flight.diverted||/divert/i.test(status))return {tone:'delayed',label:'Diverted'};
 if(flight.actual_in||/arrived|landed/i.test(status))return {tone:'arrived',label:'Arrived'};
 if(flight.actual_off||/en route|airborne/i.test(status))return {tone:'airborne',label:'In flight'};
 const delay=(Date.parse(flight.estimated_out)-Date.parse(flight.scheduled_out))/60000;
 if(!flight.schedule_only&&(delay>=15||/delay/i.test(status)))return {tone:'delayed',label:Number.isFinite(delay)&&delay>=15?`${Math.round(delay)} min delayed`:'Delayed'};
 if(!flight.schedule_only&&/on[ -]?time/i.test(status))return {tone:'on-time',label:'On time'};
 if(!flight.schedule_only&&/board/i.test(status))return {tone:'airborne',label:'Boarding'};
 return {tone:'scheduled',label:flight.schedule_only?'Schedule only · open for updates':/scheduled/i.test(status)?'Scheduled':'Status unavailable'};
}
export function travelerFlightLabel(flight){
 const identity=flightOptionIdentity(flight);
 const prefix=identity.display.match(/^([A-Z]{3}|[A-Z0-9]{2})(?=\d)/)?.[0];
 return regionalCodes.has(prefix)?'Flight number not confirmed':identity.display||'Flight number not reported';
}
