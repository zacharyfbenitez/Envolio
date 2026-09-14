import {airlines} from './flight-search.js';
export function carrierName(flight){
 const operator=String(flight?.operator||'').trim();
 const iata=String(flight?.operator_iata||flight?.ident_iata?.match(/^[A-Z0-9]{2}/i)?.[0]||'').toUpperCase();
 if(iata==='PD'||operator.toUpperCase()==='POE')return 'Porter Airlines';
 // Preserve published names; translate codes only when we have a known match.
 if(operator&&!/^[A-Z0-9]{2,3}$/.test(operator))return operator;
 const icao=String(flight?.operator_icao||flight?.ident_icao?.match(/^[A-Z]{3}/)?.[0]||'').toUpperCase();
 const africanOperators={ETH:'Ethiopian Airlines',KQA:'Kenya Airways',SAA:'South African Airways',LNK:'Airlink',SFR:'FlySafair',APK:'Air Peace',RWD:'RwandAir',SKK:'ASKY Airlines',DTA:'TAAG Angola Airlines',ATC:'Air Tanzania',UGD:'Uganda Airlines',PRF:'Precision Air',DAH:'Air Algérie',TAR:'Tunisair',RAM:'Royal Air Maroc',MSR:'EgyptAir',MAU:'Air Mauritius',SEY:'Air Seychelles',REU:'Air Austral',LAM:'LAM Mozambique Airlines',BOT:'Air Botswana'};
 return airlines.find(a=>a.code===iata)?.name||africanOperators[icao]||operator||'Airline';
}
