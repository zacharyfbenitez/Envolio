export function airportConditionWords(item){
 const text=String(item.evidence||''),category=text.trim().toUpperCase();
 if(item.kind==='weather'){
  const categories={MVFR:'Low clouds or reduced visibility. Aircraft may need more spacing.',IFR:'Low clouds or poor visibility may slow arrivals and departures.',LIFR:'Very low clouds or visibility may disrupt flights.',VFR:'Visibility and cloud conditions meet visual-flight thresholds. Other weather hazards may still matter.'};
  return {title:'Weather',detail:categories[category]||(/thunder|\bTS/i.test(text)?'Thunderstorms reported. Flights may wait for safer conditions.':text||'Weather details unavailable.')};
 }
 if(/runway/i.test(item.label||'')&&/CLSD|clos/i.test(text))return {title:'Runway closure reported',detail:`${text.match(/(?:RWY|runway)\s+([\dLRC/]+)/i)?.[1]?`Runway ${text.match(/(?:RWY|runway)\s+([\dLRC/]+)/i)[1]} is closed.`:'A runway closure is reported.'} This may reduce capacity; it does not mean the whole airport is closed.`};
 if(/No active program reported/i.test(text))return {title:'Airport delay programs',detail:'No active program was returned in this update. Individual flights can still be delayed.'};
 return {title:item.label||'Airport update',detail:text||'Details unavailable.'};
}
