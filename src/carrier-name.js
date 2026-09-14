import {airlines} from './flight-search.js';
export function carrierName(flight){
 const operator=String(flight?.operator||'').trim();
 const iata=String(flight?.operator_iata||flight?.ident_iata?.match(/^[A-Z0-9]{2}/i)?.[0]||'').toUpperCase();
 if(iata==='PD'||operator.toUpperCase()==='POE')return 'Porter Airlines';
 // Preserve published names; translate codes only when we have a known match.
 if(operator&&!/^[A-Z0-9]{2,3}$/.test(operator))return operator;
 return airlines.find(a=>a.code===iata)?.name||operator||'Airline';
}
