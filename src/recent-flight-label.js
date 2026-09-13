import {airlines} from './flight-search.js';
export function recentFlightLabel(item){
 const ident=(item.display_ident||item.ident||'').toUpperCase(),match=ident.match(/^([A-Z0-9]{2}|[A-Z]{3})(\d+[A-Z]?)$/);
 if(!match)return 'Previous flight';
 const familiar={PD:'Porter',AA:'American',UA:'United',DL:'Delta',B6:'JetBlue',BA:'British Airways',SQ:'Singapore Airlines',WN:'Southwest',AS:'Alaska Airlines',JL:'Japan Airlines'};
 const name=familiar[match[1]]||airlines.find(a=>a.code===match[1])?.name||(item.operator&&!/^[A-Z0-9]{2,3}$/.test(item.operator)?item.operator:'Flight');
 return `${name} ${match[2]}`;
}
