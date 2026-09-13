export const RECENT_KEY='envolio.recent-flights';
export const SAVED_KEY='contrail.saved'; // Keep existing users' favorites.
export function validJourneys(value){
  return Array.isArray(value)?value.filter(item=>item&&typeof item.ident==='string'&&/^[A-Z0-9]{2,12}$/i.test(item.ident)&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&typeof item.key==='string').slice(0,20):[];
}
export function airportCode(airport){
 const value=airport?.code_iata||airport?.alternate_ident||airport?.code||airport?.code_icao||'';
 return /^K[A-Z]{3}$/.test(value)?value.slice(1):value;
}
export function journeyUrl(item,base){
 const query=new URLSearchParams({date:item.date});
 if(airportCode(item.origin))query.set('origin',airportCode(item.origin));
 if(airportCode(item.destination))query.set('destination',airportCode(item.destination));
 return `${base}flight/${encodeURIComponent(item.ident)}?${query}`;
}
export function addRecent(items,item){return [item,...validJourneys(items).filter(old=>old.key!==item.key)].slice(0,8);}
export function readJourneys(key){try{return validJourneys(JSON.parse(localStorage.getItem(key)||'[]'));}catch{return [];}}
export function rememberFlight(ident,date,flight){
 const item={ident,date,key:`${ident}|${date}|${airportCode(flight.origin)}|${airportCode(flight.destination)}`,origin:flight.origin,destination:flight.destination,operator:flight.operator,viewed_at:new Date().toISOString()};
 try{localStorage.setItem(RECENT_KEY,JSON.stringify(addRecent(readJourneys(RECENT_KEY),item)));}catch{/* Viewing a flight must still work without storage. */}
}
