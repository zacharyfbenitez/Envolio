const carrierAliases = {
  'el al': 'LY', 'elal':'LY', 'ryanair':'FR', 'easyjet':'U2', 'wizz air':'W6', 'tap portugal':'TP', 'tap air portugal':'TP', 'air india':'AI', 'china airlines':'CI', 'china eastern':'MU', 'china southern':'CZ', 'air china':'CA', 'philippine airlines':'PR', 'cebu pacific':'5J', 'airasia':'AK', 'vietnam airlines':'VN', 'ethiopian airlines':'ET', 'egyptair':'MS', 'royal air maroc':'AT', 'saudi arabian airlines':'SV', 'jet blue airways':'B6', 'british':'BA',
  "american airlines": "AA",
  "american airline": "AA",
  american: "AA",
  "united airlines": "UA",
  united: "UA",
  "delta air lines": "DL",
  "delta airlines": "DL",
  delta: "DL",
  "southwest airlines": "WN",
  southwest: "WN",
  "jetblue airways": "B6",
  "jet blue": "B6",
  jetblue: "B6",
  "alaska airlines": "AS",
  alaska: "AS",
  "british airways": "BA",
  "british airway": "BA",
  "air canada": "AC",
  "air france": "AF",
  "air new zealand": "NZ",
  "all nippon airways": "NH",
  ana: "NH",
  "japan airlines": "JL",
  jal: "JL",
  "singapore airlines": "SQ",
  "singpore airlines": "SQ",
  singapore: "SQ",
  "qatar airways": "QR",
  "qutar airways": "QR",
  qatar: "QR",
  "turkish airlines": "TK",
  turkish: "TK",
  "virgin atlantic": "VS",
  "virgin australia": "VA",
  "cathay pacific": "CX",
  cathay: "CX",
  "etihad airways": "EY",
  etihad: "EY",
  "emirates airline": "EK",
  emirates: "EK",
  emirites: "EK",
  qantas: "QF",
  quantas: "QF",
  lufthansa: "LH",
  lufhansa: "LH",
  klm: "KL",
  "swiss international": "LX",
  swiss: "LX",
  "iberia airlines": "IB",
  iberia: "IB",
  "aer lingus": "EI",
  aeromexico: "AM",
  "latam airlines": "LA",
  latam: "LA",
  "korean air": "KE",
  "eva air": "BR",
  "saudia airlines": "SV",
  saudia: "SV",
  "spirit airlines": "NK",
  spirit: "NK",
  "frontier airlines": "F9",
  frontier: "F9",
  "westjet airlines": "WS",
  westjet: "WS",
  "scandinavian airlines": "SK",
  sas: "SK",
  "austrian airlines": "OS",
  austrian: "OS",
  "avianca airlines": "AV",
  avianca: "AV",
  finnair: "AY",
  "indigo airlines": "6E",
  indigo: "6E",
};
const airportAliases = {
  'tel aviv':['TLV'], 'ben gurion':['TLV'], 'toronto':['YYZ','YTZ'], 'vancouver':['YVR'], 'lisbon':['LIS'], 'istanbul':['IST','SAW'], 'zurich':['ZRH'], 'vienna':['VIE'], 'dublin':['DUB'], 'orlando':['MCO'], 'fort lauderdale':['FLL'], 'san diego':['SAN'], 'honolulu':['HNL'], 'denver':['DEN'], 'phoenix':['PHX'], 'detroit':['DTW'], 'minneapolis':['MSP'], 'salt lake city':['SLC'], 'charlotte':['CLT'], 'beijing':['PEK','PKX'], 'seoul':['ICN','GMP'], 'taipei':['TPE','TSA'], 'manila':['MNL'], 'auckland':['AKL'], 'cape town':['CPT'], 'johannesburg':['JNB'],
  "new york": ["JFK", "LGA", "EWR"],
  nyc: ["JFK", "LGA", "EWR"],
  london: ["LHR", "LGW", "LCY"],
  tokyo: ["NRT", "HND"],
  "san francisco": ["SFO"],
  sf: ["SFO"],
  "los angeles": ["LAX"],
  la: ["LAX"],
  chicago: ["ORD", "MDW"],
  paris: ["CDG", "ORY"],
  dubai: ["DXB"],
  singapore: ["SIN"],
  frankfurt: ["FRA"],
  doha: ["DOH"],
  "washington dc": ["DCA", "IAD", "BWI"],
  washington: ["DCA", "IAD", "BWI"],
  "jfk airport": ["JFK"], "kennedy airport": ["JFK"], "john f kennedy": ["JFK"],
  newark: ["EWR"], laguardia: ["LGA"], heathrow: ["LHR"], gatwick: ["LGW"],
  narita: ["NRT"], haneda: ["HND"], "los angeles airport": ["LAX"],
  "san francisco airport": ["SFO"], dallas: ["DFW", "DAL"], houston: ["IAH", "HOU"],
  "las vegas": ["LAS"], vegas: ["LAS"], boston: ["BOS"], miami: ["MIA"],
  seattle: ["SEA"], atlanta: ["ATL"], amsterdam: ["AMS"], madrid: ["MAD"],
  rome: ["FCO"], sydney: ["SYD"], melbourne: ["MEL"], delhi: ["DEL"],
  mumbai: ["BOM"], bangkok: ["BKK"], "hong kong": ["HKG"], hongkong: ["HKG"],
};
function localISO(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function legacyParse(input, fallbackDate) {
  const text = input.trim().toLowerCase();
  let match = text
      .toUpperCase()
      .match(/\b([A-Z]{2,3}|[A-Z]\d|\d[A-Z])\s*(?:FLIGHT\s*)?#?\s*-?\s*(\d{1,4}[A-Z]?)\b/),
    ident = match ? `${match[1]}${match[2]}` : "";
  if (/^(ON|IN|AT|TO|BY|FOR|THE|NEXT)\d/.test(ident)) ident = "";
  if (!ident) {
    for (const [name, code] of Object.entries(carrierAliases).sort(
      ([a], [b]) => b.length - a.length,
    )) {
      match = text.match(
        new RegExp(`\\b${name}\\s+(?:flight\\s*)?(\\d{1,4}[a-z]?)\\b`),
      );
      if (match) {
        ident = `${code}${match[1]}`;
        break;
      }
    }
  }
  let date = fallbackDate,
    parsed = null;
  if (/\bday after tomorrow\b/.test(text)) {
    parsed=new Date();parsed.setDate(parsed.getDate()+2);
  } else if (/\btomorrow\b/.test(text)) {
    parsed = new Date();
    parsed.setDate(parsed.getDate() + 1);
  } else if (/\btoday\b/.test(text)) parsed = new Date();
  else {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (iso) date = iso;
    else {
      const numeric=text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/),relative=text.match(/\bin\s+(\d{1,2})\s+(day|week|month)s?\b/),weekdayNames=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"],weekday=weekdayNames.findIndex(name=>new RegExp(`\\b(?:this|next)\\s+${name}\\b`).test(text));
      if(numeric)parsed=new Date(Number(numeric[3]),Number(numeric[1])-1,Number(numeric[2]),12);
      else if(relative){parsed=new Date();const amount=Number(relative[1]);if(relative[2]==="day")parsed.setDate(parsed.getDate()+amount);if(relative[2]==="week")parsed.setDate(parsed.getDate()+amount*7);if(relative[2]==="month")parsed.setMonth(parsed.getMonth()+amount);}
      else if(/\bnext month\b/.test(text)){parsed=new Date();parsed.setMonth(parsed.getMonth()+1)}
      else if(/\bnext week\b/.test(text)){parsed=new Date();parsed.setDate(parsed.getDate()+7)}
      else if(weekday>=0){parsed=new Date();let add=(weekday-parsed.getDay()+7)%7;if(add===0)add=7;parsed.setDate(parsed.getDate()+add)}
      const human = text.match(
        /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+20\d{2})?)/i,
      )?.[1];
      if (!parsed&&human)
        parsed = new Date(
          `${human}${/20\d{2}/.test(human) ? "" : ` ${new Date().getFullYear()}`} 12:00`,
        );
      if (
        parsed &&
        !/20\d{2}/.test(human || "") &&
        parsed.getTime() < Date.now() - 86400000
      )
        parsed.setFullYear(parsed.getFullYear() + 1);
    }
  }
  if (parsed && !Number.isNaN(parsed.getTime())) date = localISO(parsed);
  const route = text
      .toUpperCase()
      .match(/\b([A-Z]{3,4})\s*[-–—]\s*([A-Z]{3,4})\b/),
    from = text.match(
      /\b(?:from|departing|leaving|out of)\s+([a-z .'-]+?)(?=\s+(?:to|for|on|today|tomorrow|next|in\s+\d)|$)/,
    ),
    to = text.match(/\b(?:to|for|into|arriving at)\s+([a-z .'-]+?)(?=\s+(?:on|today|tomorrow|next|in\s+\d)|$)/),
    resolve = (value) => {
      if (!value) return "";
      const clean = value.trim().toLowerCase().replace(/\s+(?:international\s+)?airport$/,"");
      return (
        airportAliases[clean] ||
        [/^[a-z]{3,4}$/.test(clean) ? clean.toUpperCase() : null].filter(
          Boolean,
        )
      ).join(",");
    };
  return {
    ident: ident.toUpperCase(),
    date,
    origin: route ? route[1] : resolve(from?.[1]),
    destination: route ? route[2] : resolve(to?.[1]),
  };
}

export const airlines=Object.entries(carrierAliases).filter(([name],i,list)=>list.findIndex(([,code])=>code===list[i][1])===i).map(([name,code])=>({name:name.replace(/\b\w/g,c=>c.toUpperCase()),code}));
const commonAirlines=['AA','UA','DL','BA','B6','SQ','EK','LH'];
airlines.sort((a,b)=>{const rank=code=>{const i=commonAirlines.indexOf(code);return i<0?999:i;};return rank(a.code)-rank(b.code)||a.name.localeCompare(b.name);});
export const airportSuggestions=Object.entries(airportAliases).map(([name,codes])=>({name:name.replace(/\b\w/g,c=>c.toUpperCase()),codes}));
export function resolveAirport(value){
 const clean=String(value||'').trim().toLowerCase().replace(/\s+(?:international\s+)?airport$/,'');
 if(airportAliases[clean])return airportAliases[clean];
 if(/^[a-z]{3,4}$/.test(clean))return [clean.toUpperCase().replace(/^K(?=[A-Z]{3}$)/,'')];
 return [];
}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function parseSearch(input,fallbackDate){
 const text=String(input||'').normalize('NFKC').replace(/[→–—]/g,'-').replace(/\s+/g,' ').trim();
 const lower=text.toLowerCase(),named=Object.entries(carrierAliases).sort(([a],[b])=>b.length-a.length).find(([name])=>new RegExp(`\\b${name}\\b`).test(lower));
 const dateText=text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi,'$1').replace(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi,'$2 $1');
 const dateSource=legacyParse(dateText,fallbackDate);
 const skip=new Set(['ON','IN','AT','TO','BY','FOR','THE','NEXT','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']);
 let identifiers=[...text.toUpperCase().matchAll(/\b([A-Z]{2,3}|[A-Z]\d|\d[A-Z])\s*(?:FLIGHT\s*)?#?\s*-?\s*(\d{1,4}[A-Z]?)\b/g)].filter(m=>!skip.has(m[1])).map(m=>m[1]+m[2]);
 let number='';
 if(named){
  const escaped=named[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  number=lower.match(new RegExp(`\\b${escaped}\\s*(?:flight\\s*)?[#:-]?\\s*(\\d{1,4}[a-z]?)\\b`))?.[1]||lower.match(new RegExp(`\\b(\\d{1,4}[a-z]?)\\s+(?:on|with)?\\s*${escaped}\\b`))?.[1]||lower.match(/\bflight\s*(?:number\s*)?#?\s*(\d{1,4}[a-z]?)\b/)?.[1]||'';
  if(number)identifiers=[named[1]+number.toUpperCase(),...identifiers.filter(id=>!id.endsWith(number.toUpperCase()))];
 }
 if(!number)number=lower.match(/^(?:flight\s*)?#?\s*(\d{1,4}[a-z]?)(?:\s+(?:today|tomorrow|from|to|on)\b|$)/)?.[1]||'';
 identifiers=[...new Set(identifiers)];
 let origin=dateSource.origin,destination=dateSource.destination;
 const pair=text.match(/\b([A-Z]{3,4})\s*(?:-|to|\/|\s)\s*([A-Z]{3,4})\b/);
 if(pair&&!skip.has(pair[1])&&!skip.has(pair[2])){origin=resolveAirport(pair[1]).join(',');destination=resolveAirport(pair[2]).join(',');}
 const cities=lower.match(/^(?:.*?\bfrom\s+)?(.+?)\s+to\s+(.+?)(?=\s+(?:today|tomorrow|on|next|this|in\s+\d)\b|$)/);
 if(cities){const from=resolveAirport(cities[1]),to=resolveAirport(cities[2]);if(from.length)origin=from.join(',');if(to.length)destination=to.join(',');}
 origin=origin?.split(',').flatMap(resolveAirport).join(',')||'';destination=destination?.split(',').flatMap(resolveAirport).join(',')||'';
 let date=dateSource.date,dateError='';
 const human=dateText.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i);
 if(human){const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(human[1].slice(0,3).toLowerCase())+1;if(Number(date.slice(5,7))!==month||Number(date.slice(8,10))!==Number(human[2]))dateError='That calendar date doesn’t exist. Choose the departure date below.';}
 if(new Set([...text.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)].map(m=>m[0])).size>1)dateError='Your text includes more than one date. Choose the departure date below.';
 if(/\bnext (?:summer|winter|spring|autumn|fall|year)\b/i.test(text))dateError='What day do you leave? Choose the departure date below.';
 const slash=lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
 if(slash){const a=+slash[1],b=+slash[2];if(a<=12&&b<=12&&a!==b)dateError='That date could mean two different days. Choose the departure date below.';else{const month=a>12?b:a,day=a>12?a:b;date=`${slash[3]||new Date().getFullYear()}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}}
 if(!validDate(date))dateError='That date doesn’t exist. Choose the departure date below.';
 const max=new Date();max.setFullYear(max.getFullYear()+1);
 if(validDate(date)&&date>localISO(max))dateError='Choose a date within the next year. Later schedules aren’t available here yet.';
 return {ident:identifiers.length===1?identifiers[0]:'',identifiers,number,airline:named?.[1]||'',date,dateError,origin,destination};
}

const handoffs=new Map();
export function searchKey(ident,date,origin='',destination='',departure=''){return [ident,date,origin,destination,departure].join('|');}
export function putSearchResult(key,data){handoffs.clear();handoffs.set(key,{data,at:Date.now()});}
export function takeSearchResult(key){const item=handoffs.get(key);handoffs.delete(key);return item&&Date.now()-item.at<60000?item.data:null;}
