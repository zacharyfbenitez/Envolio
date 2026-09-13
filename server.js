import 'dotenv/config';
import {apiGuard,publicFeedback} from './web-security.js';
import {validateRouteQuery,scheduleCandidates,originDayWindow} from './route-search.js';
import { buildDelayReasoning, loadFaaAdvisories } from './delay-reasoning.js';
import { loadSkylinkContext, skylink, receipt, metarWeather, compareStatus } from './skylink.js';
import { completedHistory, routeValidation } from './validation.js';
import { disruptionBrief, connectionCheck, suitableAlternatives } from './traveler-intelligence.js';
import { readProviderPermissions, licensedHistory } from './provider-permissions.js';
import { tripStrategy, connectionSurvival, rankBackups, airportPressure } from './trip-strategy.js';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const proxyHops=Number(process.env.TRUST_PROXY_HOPS||0);
if(Number.isInteger(proxyHops)&&proxyHops>0&&proxyHops<=3)app.set('trust proxy',proxyHops);
app.use(express.json({ limit: '32kb' }));
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'geolocation=(), camera=(), microphone=()','Cross-Origin-Opener-Policy':'same-origin'});next()});
const publicBase=(process.env.PUBLIC_BASE||'/p/bUpWZzvZpIOeEaBV-xsmW/5173').replace(/\/$/,'');
app.use((req,_res,next)=>{if(req.url===publicBase||req.url.startsWith(`${publicBase}/`))req.url=req.url.slice(publicBase.length)||'/';next()});
app.use('/api',apiGuard());
const port = process.env.PORT || 8787;
const root = path.dirname(fileURLToPath(import.meta.url));
const iconCache = new Map();
const historyCache = new Map();
const contextCache = new Map();
const lookupCache = new Map();
const flightContexts = new Map();
const flightContextKey=f=>`${f.fa_flight_id||f.ident}|${f.scheduled_out}|${f.origin?.code}|${f.destination?.code}`;
const telemetryCounts = new Map();
const telemetryFile = path.join(root, '.data', 'lookup-telemetry.jsonl');
const indexSnapshots = new Map();
const indexSnapshotFile = path.join(root, '.data', 'delay-index-snapshots.jsonl');
const alertSubscriptionFile = path.join(root, '.data', 'alert-subscriptions.jsonl');
const searchAccessFile = path.join(root, '.data', 'search-access.jsonl');
const awcMetarEnabled = /^(1|true|yes)$/i.test(process.env.ENABLE_AWC_METAR_FALLBACK || 'false');
const iataToIcao = {
  AA:'AAL', AS:'ASA', AC:'ACA', AF:'AFR', AM:'AMX', AV:'AVA', AY:'FIN', B6:'JBU', BA:'BAW',
  BR:'EVA', CX:'CPA', DL:'DAL', EK:'UAE', EY:'ETD', F9:'FFT', IB:'IBE', JL:'JAL', KE:'KAL',
  KL:'KLM', LA:'LAN', LH:'DLH', LX:'SWR', NH:'ANA', NK:'NKS', NZ:'ANZ', OS:'AUA', QF:'QFA',
  QR:'QTR', SK:'SAS', SQ:'SIA', SV:'SVA', TK:'THY', UA:'UAL', VS:'VIR', WN:'SWA', WS:'WJA',
  '6E':'IGO'
};

app.post('/api/search-access',async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  const ident=String(req.body?.ident||'').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,10);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({error:'Enter a valid email address.'});
  try{
    await fs.mkdir(path.dirname(searchAccessFile),{recursive:true});
    await fs.appendFile(searchAccessFile,`${JSON.stringify({email,ident:ident||null,created_at:new Date().toISOString(),consent:'flight_lookup_access'})}\n`);
    res.status(201).json({ok:true});
  }catch{res.status(503).json({error:'Email capture is temporarily unavailable.'})}
});

function alternateIdent(ident) {
  const code = ident.slice(0, 2);
  return iataToIcao[code] && /^\d{1,4}[A-Z]?$/.test(ident.slice(2)) ? `${iataToIcao[code]}${ident.slice(2)}` : null;
}

function scheduleQueryParts(ident) {
  const value=String(ident).toUpperCase();
  const iataMatch=value.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  const icaoMatch=value.match(/^([A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if(iataMatch)return{airline:iataMatch[1],flightNumber:iataMatch[2].replace(/[^0-9]/g,'')};
  if(icaoMatch)return{airline:icaoMatch[1],flightNumber:icaoMatch[2].replace(/[^0-9]/g,'')};
  return null;
}

function normalizeScheduledFlight(item) {
  const operating=item.actual_ident_icao||item.actual_ident||item.ident_icao||item.ident;
  const operatingIata=item.actual_ident_iata||item.ident_iata||null;
  return{
    ...item,
    ident:operating,
    ident_icao:operating,
    ident_iata:operatingIata,
    operator_icao:operating?.match(/^[A-Z]{3}/)?.[0]||null,
    operator_iata:operatingIata?.match(/^[A-Z0-9]{2}/)?.[0]||null,
    origin:{code:item.origin_icao||item.origin,code_icao:item.origin_icao||item.origin,code_iata:item.origin_iata||null,timezone:'UTC'},
    destination:{code:item.destination_icao||item.destination,code_icao:item.destination_icao||item.destination,code_iata:item.destination_iata||null,timezone:'UTC'},
    codeshares:[item.ident_icao,item.ident].filter(value=>value&&value!==operating),
    codeshares_iata:[item.ident_iata].filter(value=>value&&value!==operatingIata),
    status:'Scheduled',
    schedule_only:true
  };
}

function departureDate(flight) {
  const stamp = flight.scheduled_out || flight.estimated_out;
  if (!stamp) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: flight.origin?.timezone || 'UTC', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(stamp));
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch { return stamp.slice(0, 10); }
}

function lookupCacheKey(ident,date,origins) { return `${ident}|${date||'latest'}|${origins.join(',')}`; }
function cacheLookup(key,payload) { lookupCache.set(key,{payload,savedAt:Date.now()}); }
function cachedLookup(key) { const item=lookupCache.get(key); return item&&Date.now()-item.savedAt<6*60*60*1000?item:null; }
function identPattern(ident) { const value=String(ident).toUpperCase(),iata=iataToIcao[value.slice(0,2)]?value.slice(0,2):null,match=iata?value.slice(2).match(/^(\d{1,4})/):value.match(/^([A-Z]{3})(\d{1,4})/);return iata&&match?`${iata}#${match[1].length}`:match?`${match[1]}#${match[2].length}`:'invalid'; }
async function recordTelemetry(type,details={}) {
  const event={type,at:new Date().toISOString(),ident_pattern:identPattern(details.ident),reason:details.reason||null,date_offset:Number.isFinite(details.date_offset)?details.date_offset:null,route_hint:details.route_hint||null};
  const aggregate=`${event.type}|${event.ident_pattern}|${event.reason||'none'}`;
  telemetryCounts.set(aggregate,(telemetryCounts.get(aggregate)||0)+1);
  try { await fs.mkdir(path.dirname(telemetryFile),{recursive:true}); await fs.appendFile(telemetryFile,`${JSON.stringify(event)}\n`); } catch {}
}
async function hydrateTelemetry(){try{const lines=(await fs.readFile(telemetryFile,'utf8')).trim().split('\n').filter(Boolean);for(const line of lines){const event=JSON.parse(line),key=`${event.type}|${event.ident_pattern}|${event.reason||'none'}`;telemetryCounts.set(key,(telemetryCounts.get(key)||0)+1)}}catch{}}
hydrateTelemetry();
async function hydrateIndexSnapshots(){try{const lines=(await fs.readFile(indexSnapshotFile,'utf8')).trim().split('\n').filter(Boolean).slice(-2000);for(const line of lines){const item=JSON.parse(line),list=indexSnapshots.get(item.key)||[];list.push(item.point);indexSnapshots.set(item.key,list.slice(-48))}}catch{}}
hydrateIndexSnapshots();
async function recordIndexSnapshot(key,index){
  if(!index)return[];
  const list=indexSnapshots.get(key)||[],last=list.at(-1),factorValues=Object.fromEntries(index.factors.map(factor=>[factor.key,factor.value]));
  const point={at:new Date().toISOString(),delay:index.score,on_time:index.on_time_probability,factors:factorValues};
  const previousWithFactors=[...list].reverse().find(item=>item.factors);
  const delta=last?point.delay-last.delay:0;
  const drivers=previousWithFactors?index.factors.map(factor=>({key:factor.key,label:factor.label,from:previousWithFactors.factors[factor.key],to:factor.value,source:factor.source})).filter(item=>Number.isFinite(item.from)&&Number.isFinite(item.to)&&item.from!==item.to).map(item=>({...item,change:item.to-item.from})).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,3):[];
  index.movement={delta,compared_at:last?.at||null,direction:delta>0?'up':delta<0?'down':'flat',drivers,explanation:!last?'First live observation; refresh to establish movement.':delta===0?'The headline risk is unchanged since the previous observation.':`${Math.abs(delta)} point ${delta>0?'increase':'decrease'} since the previous observation${drivers.length?`, led by ${drivers[0].label.toLowerCase()}`:''}.`};
  if(!last||Date.now()-new Date(last.at).getTime()>=60000||last.delay!==point.delay||drivers.length){list.push(point);indexSnapshots.set(key,list.slice(-48));try{await fs.mkdir(path.dirname(indexSnapshotFile),{recursive:true});await fs.appendFile(indexSnapshotFile,`${JSON.stringify({key,point})}\n`)}catch{}}
  return indexSnapshots.get(key)||[point];
}

function upstreamFetch(url,options={}) { return fetch(url,{...options,signal:AbortSignal.timeout(12000)}); }

async function aero(pathname) {
  try {
    const response = await upstreamFetch(`https://aeroapi.flightaware.com/aeroapi${pathname}`, { headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY, Accept: 'application/json' } });
    return response.ok ? response.json() : null;
  } catch { return null; }
}
async function aeroCached(pathname,ttl=300000){const cached=contextCache.get(pathname);if(cached&&Date.now()-cached.savedAt<ttl)return cached.value;const raw=await aero(pathname);const value=raw?{...raw,retrieved_at:new Date().toISOString()}:null;if(value){contextCache.set(pathname,{value,savedAt:Date.now()});if(contextCache.size>1000)contextCache.delete(contextCache.keys().next().value)}return value}

async function aviationWeatherMetar(icao) {
  if (!awcMetarEnabled || !/^[A-Z0-9]{4}$/.test(icao || '')) return null;
  const cacheKey = `awc:metar:${icao}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) return cached.value;
  try {
    const params = new URLSearchParams({ ids: icao, format: 'json', hours: '2' });
    const response = await upstreamFetch(`https://aviationweather.gov/api/data/metar?${params}`, { headers: { Accept: 'application/json', 'User-Agent': 'Envolio-flight-tracker/1.0' } });
    if (response.status === 204 || !response.ok) return null;
    const reports = await response.json();
    const report = Array.isArray(reports) ? reports[0] : null;
    if (!report) return null;
    const visibility = Number.parseFloat(report.visib);
    const value = {
      observations: [{ wind_speed: Number(report.wspd) || 0, wind_speed_gust: Number(report.wgst) || null, visibility: Number.isFinite(visibility) ? visibility : 10, conditions: report.wxString || report.rawOb || '', cloud_friendly: report.fltCat ? `${report.fltCat} flight conditions` : null, raw_data: report.rawOb || null, time: report.reportTime || (Number.isFinite(report.obsTime) ? new Date(report.obsTime * 1000).toISOString() : null) }],
      provider: 'Aviation Weather Center', provider_detail: 'NOAA/NWS Aviation Weather Center Data API METAR', station: report.icaoId || icao, retrieved_at: new Date().toISOString()
    };
    contextCache.set(cacheKey, { value, savedAt: Date.now() });
    return value;
  } catch { return null; }
}

async function weatherWithFallback(airport) {
  if (!airport?.lookup) return null;
  const flightAware = await aeroCached(`/airports/${encodeURIComponent(airport.lookup)}/weather/observations?max_pages=1&return_nearby_weather=true`);
  const observation=flightAware?.observations?.[0],age=Date.now()-Date.parse(observation?.time||observation?.report_time);
  if (observation&&Number.isFinite(age)&&age>=-300000&&age<=7200000) return { ...flightAware, provider: 'FlightAware', provider_detail: 'FlightAware AeroAPI decoded airport weather observation', station: observation.airport_code || airport.icao || airport.lookup };
  const secondary=airport.icao?metarWeather(await skylink(`/weather/metar/${airport.icao}?parsed=true`)):null;
  return secondary || aviationWeatherMetar(airport.icao);
}

async function aeroResult(pathname) {
  try {
    const response = await upstreamFetch(`https://aeroapi.flightaware.com/aeroapi${pathname}`, { headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY, Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data, message: data.detail || data.title || null };
  } catch {
    return { ok: false, status: 0, data: {}, message: 'FlightAware could not be reached.' };
  }
}

async function loadComparableHistory(ident, flight) {
  const anchor = new Date(flight.scheduled_out || flight.estimated_out || Date.now());
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const anchorStart = new Date(anchor); anchorStart.setUTCHours(0, 0, 0, 0);
  const end = new Date(Math.min(anchorStart.getTime(), todayStart.getTime()));
  const cacheKey = `${ident}|${end.toISOString().slice(0,10)}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 600000) return cached.value;
  const windows = [];
  for (let offset = 0; offset < 28; offset += 7) {
    const windowEnd = new Date(end); windowEnd.setUTCDate(windowEnd.getUTCDate() - offset);
    const windowStart = new Date(windowEnd); windowStart.setUTCDate(windowStart.getUTCDate() - 7);
    const params = new URLSearchParams({ ident_type: 'designator', start: windowStart.toISOString().slice(0, 10), end: windowEnd.toISOString().slice(0, 10), max_pages: '2' });
    windows.push((async()=>{
      const first=await aeroResult(`/history/flights/${encodeURIComponent(ident)}?${params}`);
      if(!first.ok)return first;
      let next=first.data.links?.next, pages=1;
      while(next&&pages<3){
        const url=new URL(next,'https://aeroapi.flightaware.com');
        if(url.origin!=='https://aeroapi.flightaware.com'||!url.pathname.startsWith('/aeroapi/history/'))break;
        url.searchParams.set('max_pages','2');
        const more=await aeroResult(url.pathname.replace(/^\/aeroapi/,'')+url.search);
        pages++;
        if(!more.ok)break;
        first.data.flights=[...(first.data.flights||[]),...(more.data.flights||[])];next=more.data.links?.next;
      }
      first.truncated=!!next;
      return first;
    })());
  }
  const results = await Promise.all(windows);
  const available = results.filter(result => result.ok);
  let flights = available.flatMap(result => result.data.flights || []);
  let source = 'FlightAware AeroAPI historical flights';
  let limitation = available.length < results.length ? `${results.length - available.length} of ${results.length} historical windows were unavailable.` : null;
  if(available.some(result=>result.truncated))limitation=[limitation,'More history exists; pagination stopped at the per-lookup budget or a provider error.'].filter(Boolean).join(' ');
  if (!available.length) {
    const fallback = await aeroResult(`/flights/${encodeURIComponent(ident)}?ident_type=designator&max_pages=5`);
    flights = fallback.ok ? fallback.data.flights || [] : [];
    source = 'FlightAware AeroAPI recent flight collection';
    limitation = results[0]?.status === 401 || results[0]?.status === 403
      ? 'The historical-flights endpoint is not available on the connected AeroAPI plan. Recent flights are shown instead.'
      : `Historical lookup was unavailable${results[0]?.message ? `: ${results[0].message}` : ''}. Recent flights are shown instead.`;
  }
  const result = { flights, meta: { source, lookback_days: available.length ? 28 : 11, records_returned: flights.length, windows_loaded: available.length, windows_requested: results.length, limitation } };
  historyCache.set(cacheKey, { savedAt: Date.now(), value: result });
  return result;
}

function minutesLate(flight) {
  const scheduled = flight.scheduled_out || flight.scheduled_off;
  const actual = flight.actual_out || flight.estimated_out || flight.actual_off || flight.estimated_off;
  return scheduled && actual ? Math.max(0, (new Date(actual) - new Date(scheduled)) / 60000) : null;
}

function createDelayIndex(flight, history, airportDelay, weather) {
  const origin = code => code?.code || code?.code_icao || code?.code_iata;
  const historyRecords = (history?.flights || []).filter(item => item.fa_flight_id !== flight.fa_flight_id && origin(item.origin) === origin(flight.origin) && origin(item.destination) === origin(flight.destination)).map(item => ({
    date: item.scheduled_out || item.actual_out,
    minutes: minutesLate(item)
  })).filter(item => Number.isFinite(item.minutes)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const samples = historyRecords.map(item => item.minutes);
  const delayed = samples.filter(value => value >= 15).length;
  const historyRate = samples.length ? delayed / samples.length : null;
  const airportRisk = airportDelay ? ({ green: .15, yellow: .58, red: .9 }[airportDelay.color] ?? null) : null;
  const observation = weather?.observations?.[0];
  const gust = Number(observation?.wind_speed_gust || observation?.wind_speed || 0);
  const visibility = Number(observation?.visibility || 10);
  const severe = /TS|SN|FZ|GR|SQ|FG/i.test(observation?.conditions || '');
  const weatherRisk = observation ? Math.min(1, (gust >= 35 ? .55 : gust >= 22 ? .28 : .08) + (visibility > 0 && visibility < 3 ? .3 : 0) + (severe ? .38 : 0)) : null;
  const slipMinutes = minutesLate(flight);
  const currentSlip = Number.isFinite(slipMinutes) ? Math.min(1, slipMinutes / 60) : null;
  const inputs = [[historyRate,.45],[airportRisk,.25],[weatherRisk,.2],[currentSlip,.1]].filter(([number]) => Number.isFinite(number));
  if (!inputs.length) return null;
  const score = Math.round(100 * inputs.reduce((sum,[number,weight]) => sum + number * weight, 0) / inputs.reduce((sum,[,weight]) => sum + weight, 0));
  return { score, level: score >= 65 ? 'high' : score >= 35 ? 'elevated' : 'low', trend: score >= 50 ? 'up' : 'down', confidence: samples.length >= 5 && airportDelay && observation ? 'high' : samples.length >= 2 ? 'medium' : 'limited', factors: [
    { label: 'Recent flight history', value: Number.isFinite(historyRate) ? Math.round(historyRate * 100) : null, detail: samples.length ? `${delayed} of ${samples.length} delayed 15+ min` : 'Not included · no comparable history returned' },
    { label: 'Origin airport', value: Number.isFinite(airportRisk) ? Math.round(airportRisk * 100) : null, detail: airportDelay?.reasons?.[0]?.reason || 'Not included · no active delay report returned' },
    { label: 'Weather', value: Number.isFinite(weatherRisk) ? Math.round(weatherRisk * 100) : null, detail: observation ? `${observation.wind_friendly || `${gust} kt wind`} · ${observation.conditions || observation.cloud_friendly || 'clear'}` : 'Not included · weather observation unavailable' },
    { label: 'Current schedule', value: Number.isFinite(currentSlip) ? Math.round(currentSlip * 100) : null, detail: Number.isFinite(slipMinutes) ? `${Math.round(slipMinutes)} min current variance` : 'Not included · no live estimate returned' }
  ], trend_points: historyRecords.map(item => ({ date: item.date, value: Math.min(100, Math.round(item.minutes / 60 * 100)), minutes: Math.round(item.minutes) })), trend_meta: { ...history?.meta, comparable_records: historyRecords.length }, methodology: 'Heuristic estimate based on observed history, airport conditions, weather, and current schedule variance.' };
}

function createLiveDelayIndex(flight,history,context={}) {
  const airportCode=value=>value?.code||value?.code_icao||value?.code_iata;
  const retrievedAt=new Date().toISOString(),origin=airportCode(flight.origin),destination=airportCode(flight.destination),ident=flight.ident_iata||flight.ident;
  const historyRecords=completedHistory(flight,history?.flights||[]);
  const routeOutcomes=historyRecords.map(item=>item.minutes>=15?1:0),routeDelayed=routeOutcomes.reduce((sum,value)=>sum+value,0),routeRisk=routeOutcomes.length?routeDelayed/routeOutcomes.length:null;
  const airlineFlights=[...(context.airline?.arrivals||[]),...(context.airline?.enroute||[])],airlineSamples=airlineFlights.map(minutesLate).filter(Number.isFinite),airlineDelayed=airlineSamples.filter(value=>value>=15).length,airlineRisk=airlineSamples.length?airlineDelayed/airlineSamples.length:null;
  const tested=routeValidation(historyRecords);
  const selectedCalibration={strength:0,brier:tested.brier,samples:tested.backtest.length},priorStrength=0;
  const calibratedBaseline=routeRisk,naiveBrier=tested.brier;
  const interval=(successes,total)=>{if(!total)return null;const z=1.96,p=successes/total,denom=1+z*z/total,center=(p+z*z/(2*total))/denom,spread=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/denom;return{lower:Math.round(Math.max(0,center-spread)*100),upper:Math.round(Math.min(1,center+spread)*100)}};
  const backtest=tested.backtest;
  const correct=backtest.filter(item=>(item.predicted_delay_probability>=50)===item.actual_delayed).length;
  const airportRisk=data=>data?({green:.12,yellow:.55,red:.88}[data.color]??null):null;
  const weatherRisk=data=>{const observation=data?.observations?.[0],age=Date.now()-Date.parse(observation?.time||observation?.report_time);if(!observation||!Number.isFinite(age)||age< -300000||age>7200000)return null;const gust=Number(observation.wind_speed_gust??observation.wind_speed??0),visibility=Number(observation.visibility??10),severe=/TS|SN|FZ|GR|SQ|FG/i.test(observation.conditions||'');return Math.min(1,(gust>=35?.55:gust>=22?.28:.08)+(visibility>=0&&visibility<3?.3:0)+(severe?.38:0))};
  const weatherDetail=data=>{const observation=data?.observations?.[0];return observation?`${observation.wind_friendly||`${observation.wind_speed||0} kt wind`} · ${observation.conditions||observation.cloud_friendly||'no significant weather reported'}`:`No observation returned${awcMetarEnabled?' by FlightAware or Aviation Weather Center':' by FlightAware'}`};
  const weatherSource=data=>data?.provider_detail||'FlightAware AeroAPI decoded airport weather observation';
  const weatherReceipt=data=>{const observation=data?.observations?.[0];return {endpoint:data?.endpoint||(data?.provider==='Aviation Weather Center'?`aviationweather.gov/api/data/metar?ids=${data.station}`:`AeroAPI /airports/${data?.station||'airport'}/weather/observations`),observed_at:observation?.time||observation?.report_time||null,retrieved_at:data?.retrieved_at||null,raw_observation:observation?.raw_data||null}};
  const inbound=context.inbound;
  const arrival=inbound&&(inbound.actual_in||inbound.estimated_in||inbound.scheduled_in);
  const departure=flight.estimated_out||flight.scheduled_out;
  const turnMinutes=arrival&&departure?(new Date(departure)-new Date(arrival))/60000:null;
  const inboundVariance=inbound?minutesLate(inbound):null;
  const inboundRisk=!inbound?null:inbound.actual_in?Math.min(.25,Math.max(0,(inboundVariance||0)/120)):Number.isFinite(turnMinutes)?(turnMinutes<30?1:turnMinutes<60?0.75:turnMinutes<90?0.4:Math.min(.3,Math.max(0,(inboundVariance||0)/120))):Number.isFinite(inboundVariance)?Math.min(1,inboundVariance/90):null;
  const scheduleMinutes=minutesLate(flight),scheduleRisk=Number.isFinite(scheduleMinutes)?Math.min(1,scheduleMinutes/60):null;
  const receipt=(endpoint,extra={})=>({endpoint,retrieved_at:retrievedAt,...extra});
  const factors=[
    {key:'route',label:'Recent route history',value:calibratedBaseline,weight:.28,detail:historyRecords.length?`${routeDelayed} of ${historyRecords.length} verified actual departures delayed 15+ min; no future outcomes or current airline prior used in backtesting`:'No comparable actual departures returned',source:history?.meta?.source||'FlightAware AeroAPI historical flights',role:'empirical baseline',source_detail:receipt(`/history/flights/${ident}`,{route:`${origin}-${destination}`,lookback_days:history?.meta?.lookback_days,sample_size:historyRecords.length,delayed_count:routeDelayed,window_limitation:history?.meta?.limitation||null})},
    {key:'airline',label:'Airline operations',value:airlineRisk,weight:.14,detail:airlineSamples.length?`${airlineDelayed} of ${airlineSamples.length} returned operations delayed 15+ min`:'No usable airline operations sample',source:'FlightAware AeroAPI operator flights',role:'empirical prior',source_detail:receipt(`/operators/${flight.operator_icao||flight.operator||'operator'}/flights`,{sample_size:airlineSamples.length,delayed_count:airlineDelayed})},
    {key:'inbound',label:'Inbound aircraft',value:inboundRisk,weight:.20,detail:inbound?inbound.actual_in?'Aircraft has arrived at the origin':Number.isFinite(turnMinutes)?`${Math.round(turnMinutes)} min expected ground time before departure`:'Inbound timing is incomplete':'No inbound aircraft assigned',source:'FlightAware AeroAPI aircraft rotation',role:'bounded live adjustment',source_detail:receipt(inbound?.fa_flight_id?`/flights/${inbound.fa_flight_id}`:'/flights/{inbound flight}',{inbound_ident:inbound?.ident_iata||inbound?.ident||null,turn_minutes:Number.isFinite(turnMinutes)?Math.round(turnMinutes):null})},
    {key:'origin_airport',label:'Departure airport',value:airportRisk(context.originDelay),weight:.10,detail:context.originDelay?.reasons?.[0]?.reason||'No active airport delay program returned',source:'FlightAware AeroAPI airport delays',role:'bounded live adjustment',source_detail:receipt(`/airports/${origin}/delays`,{status:context.originDelay?.color||'none reported'})},
    {key:'arrival_airport',label:'Arrival airport',value:airportRisk(context.arrivalDelay),weight:.08,detail:context.arrivalDelay?.reasons?.[0]?.reason||'No active airport delay program returned',source:'FlightAware AeroAPI airport delays',role:'bounded live adjustment',source_detail:receipt(`/airports/${destination}/delays`,{status:context.arrivalDelay?.color||'none reported'})},
    {key:'origin_weather',label:'Departure weather',value:weatherRisk(context.originWeather),weight:.08,detail:weatherDetail(context.originWeather),source:weatherSource(context.originWeather),role:'bounded live adjustment',source_detail:weatherReceipt(context.originWeather)},
    {key:'arrival_weather',label:'Arrival weather',value:weatherRisk(context.arrivalWeather),weight:.05,detail:weatherDetail(context.arrivalWeather),source:weatherSource(context.arrivalWeather),role:'bounded live adjustment',source_detail:weatherReceipt(context.arrivalWeather)},
    {key:'schedule',label:'Current schedule',value:scheduleRisk,weight:.07,detail:Number.isFinite(scheduleMinutes)?`${Math.round(scheduleMinutes)} min current departure variance`:'No live departure estimate returned',source:'FlightAware AeroAPI schedule and estimates',role:'bounded live adjustment',source_detail:receipt(`/flights/${flight.fa_flight_id||ident}`,{scheduled_out:flight.scheduled_out||null,estimated_out:flight.estimated_out||null,actual_out:flight.actual_out||null,variance_minutes:Number.isFinite(scheduleMinutes)?Math.round(scheduleMinutes):null})}
  ];
  if(flight.schedule_only)for(const factor of factors)if(factor.key!=='route'){factor.value=null;factor.detail='Live conditions are not applied to a future schedule.';}
  const available=factors.filter(factor=>Number.isFinite(factor.value)),weight=available.reduce((sum,factor)=>sum+factor.weight,0);
  if(!available.length)return null;
  const score=Math.round(100*available.reduce((sum,factor)=>sum+factor.value*factor.weight,0)/weight),coverage=Math.round(weight*100),confidenceScore=Math.min(96,Math.round(coverage*.72+Math.min(historyRecords.length,12)*1.4+Math.min(airlineSamples.length,20)*.55));
  const modelBrier=Number.isFinite(selectedCalibration?.brier)?selectedCalibration.brier:null,baselineBrier=Number.isFinite(naiveBrier)?naiveBrier:null;
  const brierLift=Number.isFinite(modelBrier)&&Number.isFinite(baselineBrier)?baselineBrier-modelBrier:null;
  const beatsBaseline=selectedCalibration?.samples>=3&&Number.isFinite(brierLift)&&brierLift>.002;
  const brierSkillPercent=Number.isFinite(brierLift)&&baselineBrier>0?Math.round(brierLift/baselineBrier*100):null;
  // A tiny numerical win is not enough to claim useful day-level discrimination.
  const materialSignal=false;
  const signalLabel=selectedCalibration.samples<3?'Calibrating':flight.schedule_only?'Route baseline':'Limited signal';
  const signalSummary='Historical testing evaluates only the route baseline, using actual departures known before each prediction. The live index includes heuristic operational adjustments and has not been independently validated. Two providers do not mean two independent confirmations.';
  const calibration={method:'expanding-window walk-forward Brier score',status:signalLabel.toLowerCase(),signal_label:signalLabel,beats_baseline:beatsBaseline,material_signal:materialSignal,completed_flights:routeOutcomes.length,validation_predictions:selectedCalibration?.samples||0,selected_prior_strength:priorStrength,brier_score:Number.isFinite(modelBrier)?Number(modelBrier.toFixed(3)):null,baseline_brier_score:Number.isFinite(baselineBrier)?Number(baselineBrier.toFixed(3)):null,baseline_method:'Walk-forward historical route delay rate using only earlier departures',brier_lift:Number.isFinite(brierLift)?Number(brierLift.toFixed(3)):null,brier_skill_percent:brierSkillPercent,classification_accuracy:backtest.length?Math.round(correct/backtest.length*100):null,route:{label:`${origin}–${destination}`,delay_rate:routeOutcomes.length?Math.round(routeDelayed/routeOutcomes.length*100):null,confidence_band:interval(routeDelayed,routeOutcomes.length),sample_size:routeOutcomes.length},airline:{label:flight.operator||flight.operator_icao||'Operating airline',delay_rate:airlineSamples.length?Math.round(airlineDelayed/airlineSamples.length*100):null,confidence_band:interval(airlineDelayed,airlineSamples.length),sample_size:airlineSamples.length},backtest:backtest.slice(-12),note:signalSummary};
  return{score,on_time_probability:100-score,level:score>=65?'high':score>=35?'elevated':'low',confidence:materialSignal?'validated':'limited',confidence_score:confidenceScore,signal_label:signalLabel,signal_summary:signalSummary,coverage_percent:coverage,factors:factors.map(factor=>({...factor,value:Number.isFinite(factor.value)?Math.round(factor.value*100):null})),calibration,trend_points:historyRecords.map(item=>({date:item.date,minutes:Math.round(item.minutes)})),trend_meta:{...history?.meta,comparable_records:historyRecords.length},weather_strategy:{primary:'FlightAware AeroAPI decoded airport observations',fallback:'NOAA/NWS Aviation Weather Center METAR Data API',fallback_enabled:awcMetarEnabled,origin_provider:context.originWeather?.provider||null,arrival_provider:context.arrivalWeather?.provider||null,policy:'One provider per airport. Aviation Weather Center is queried only when FlightAware returns no usable observation; observations are never blended.'},methodology:'The headline is an estimate built from an empirically calibrated route baseline plus transparent bounded live adjustments. Only the historical component is walk-forward tested because equivalent archived point-in-time inbound, airport, weather, and schedule snapshots are not available. Missing inputs are excluded and weights are renormalized.'};
}

const requestWindows=new Map();
app.use(['/api/flights','/api/airports'], (req,res,next)=>{
  const key=req.ip,now=Date.now(),entry=requestWindows.get(key);
  if(!entry||now-entry.start>60000)requestWindows.set(key,{start:now,count:1});
  else if(++entry.count>40)return res.status(429).json({error:'Please wait a moment before refreshing again.'});
  if(requestWindows.size>5000)requestWindows.delete(requestWindows.keys().next().value);
  next();
});
const routeSearchCache=new Map();
app.get('/api/flight-search',async(req,res)=>{
 const query={origin:String(req.query.origin||'').toUpperCase(),destination:String(req.query.destination||'').toUpperCase(),date:String(req.query.date||''),airline:String(req.query.airline||'').toUpperCase()};
 const invalid=validateRouteQuery(query);if(invalid)return res.status(400).json({error:invalid});
 const key=JSON.stringify(query),cached=routeSearchCache.get(key);
 if(cached&&Date.now()-cached.at<300000)return res.json(cached.data);
 if(!process.env.FLIGHTAWARE_API_KEY)return res.status(503).json({error:'Schedule search isn’t configured. Try a flight number or check your airline’s booking confirmation.'});
 try{
  const airport=await aeroCached(`/airports/${query.origin}`,86400000);
  if(!airport?.timezone)return res.status(503).json({error:'We couldn’t confirm the departure airport’s time zone. Try again or use your flight number.'});
  if(query.date<departureDate({scheduled_out:new Date().toISOString(),origin:airport}))return res.status(400).json({error:'That date has passed at the departure airport. Use the flight number to look up a past flight.'});
  const {start,end}=originDayWindow(query.date,airport.timezone);
  const params=new URLSearchParams({origin:query.origin,destination:query.destination,max_pages:'3',...(query.airline?{airline:query.airline}:{})});
  const result=await aeroResult(`/schedules/${start}/${end}?${params}`);
  if(!result.ok)return res.status(result.status===429?429:503).json({error:result.status===429?'Schedule search is busy. Please try again shortly.':result.status===401||result.status===403?'The connected data plan doesn’t allow this schedule search. Use the flight number from your booking confirmation.':'The schedule provider couldn’t complete this search. Try your flight number instead.',source:'FlightAware schedules'});
  const flights=scheduleCandidates(result.data.scheduled||[],{...query,airport,normalize:normalizeScheduledFlight,localDate:departureDate});
  const data={flights,source:'FlightAware published schedules',retrieved_at:new Date().toISOString(),partial:!!result.data.links?.next,note:'Published schedules, not a complete list of every flight or a guarantee of operation. Check your booking confirmation before choosing.'};
  routeSearchCache.set(key,{at:Date.now(),data});if(routeSearchCache.size>100)routeSearchCache.delete(routeSearchCache.keys().next().value);
  res.json(data);
 }catch{res.status(503).json({error:'Schedule search is temporarily unavailable. Try a flight number or retry in a moment.'});}
});
app.get('/api/flights/:ident', async (req, res) => {
  const ident = req.params.ident.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const requestedDate = typeof req.query.date === 'string' ? req.query.date : '';
  const requestedDeparture=typeof req.query.departure==='string'?req.query.departure:'';
  if(requestedDeparture&&Number.isNaN(Date.parse(requestedDeparture)))return res.status(400).json({error:'Choose a valid departure time.'});
  const requestedOrigins = typeof req.query.origin === 'string' ? req.query.origin.toUpperCase().split(',').map(value=>value.replace(/[^A-Z0-9]/g,'')).filter(Boolean).slice(0,5) : [];
  const requestedDestination = typeof req.query.destination === 'string' ? req.query.destination.replace(/[^a-z0-9]/gi, '').toUpperCase() : '';
  const cacheKey = lookupCacheKey(ident,requestedDate,[...requestedOrigins,requestedDestination,...(requestedDeparture?[requestedDeparture]:[])]);
  const diagnostics = { requested_ident: ident, requested_date: requestedDate || null, requested_origin: requestedOrigins.join(', ') || null, requested_destination: requestedDestination || null, identifiers_tried: [], matched_routes: [], resolved_ident: null, match_type: null, reason: null };
  if (!ident) return res.status(400).json({ error: 'Enter a valid flight number.' });
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return res.status(400).json({ error: 'Enter a valid travel date.' });
  if (!process.env.FLIGHTAWARE_API_KEY) return res.status(503).json({ error: 'FlightAware API key is not configured.' });

  try {
    const params = new URLSearchParams({ max_pages: '1' });
    let futureSchedule = false;
    if (requestedDate) {
      const requested = new Date(`${requestedDate}T12:00:00.000Z`);
      const futureLimit = new Date(Date.now() + 47 * 60 * 60 * 1000);
      futureSchedule = requested > futureLimit;
      const scheduleLimit=new Date();scheduleLimit.setUTCFullYear(scheduleLimit.getUTCFullYear()+1);
      if(requested>scheduleLimit){diagnostics.reason='The date is beyond FlightAware’s published schedule horizon.';return res.status(422).json({error:`Schedules for ${requestedDate} are not published yet.`,error_code:'date_out_of_range',detail:'FlightAware publishes airline schedules up to approximately one year ahead. Choose a date within that window.',diagnostics});}
      const start = new Date(`${requestedDate}T00:00:00.000Z`);
      start.setUTCHours(start.getUTCHours() - 14);
      const end = new Date(`${requestedDate}T00:00:00.000Z`);
      end.setUTCHours(end.getUTCHours() + 38);
      if (!futureSchedule&&end > futureLimit) end.setTime(futureLimit.getTime());
      params.set('start', start.toISOString().replace(/\.\d{3}Z$/, 'Z'));
      params.set('end', end.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    }
    const lookup = async candidate => {
      if (!diagnostics.identifiers_tried.includes(candidate)) diagnostics.identifiers_tried.push(candidate);
      if(futureSchedule){
        const parts=scheduleQueryParts(candidate);
        if(!parts)return{response:{ok:false,status:400},data:{},candidate};
        const scheduleParams=new URLSearchParams({airline:parts.airline,flight_number:parts.flightNumber,max_pages:'3'});
        const firstDay=new Date(`${requestedDate}T00:00:00.000Z`);firstDay.setUTCDate(firstDay.getUTCDate()-1);
        const next=new Date(`${requestedDate}T00:00:00.000Z`);next.setUTCDate(next.getUTCDate()+2);
        const response=await upstreamFetch(`https://aeroapi.flightaware.com/aeroapi/schedules/${firstDay.toISOString().slice(0,10)}/${next.toISOString().slice(0,10)}?${scheduleParams}`,{headers:{'x-apikey':process.env.FLIGHTAWARE_API_KEY,Accept:'application/json'}});
        const scheduleData=await response.json().catch(()=>({}));
        const normalized=(scheduleData.scheduled||[]).map(normalizeScheduledFlight);
        const unique=[...new Map(normalized.map(flight=>[`${flight.ident}|${flight.origin.code}|${flight.destination.code}|${flight.scheduled_out}`,flight])).values()];
        const airportIds=[...new Set(unique.flatMap(flight=>[flight.origin.code_icao,flight.destination.code_icao]).filter(Boolean))];
        const operatorIds=[...new Set(unique.map(flight=>flight.operator_icao).filter(Boolean))];
        const [airportRows,operatorRows]=await Promise.all([
          Promise.all(airportIds.map(async id=>[id,await aeroCached(`/airports/${encodeURIComponent(id)}`,24*60*60*1000)])),
          Promise.all(operatorIds.map(async id=>[id,await aeroCached(`/operators/${encodeURIComponent(id)}`,24*60*60*1000)]))
        ]);
        const airports=Object.fromEntries(airportRows),operators=Object.fromEntries(operatorRows);
        const enriched=unique.map(flight=>({
          ...flight,
          operator:operators[flight.operator_icao]?.shortname||operators[flight.operator_icao]?.name||flight.operator_iata||flight.operator_icao||null,
          operator_iata:operators[flight.operator_icao]?.iata||flight.operator_iata,
          origin:{...flight.origin,...(airports[flight.origin.code_icao]||{})},
          destination:{...flight.destination,...(airports[flight.destination.code_icao]||{})}
        }));
        return{response,data:{...scheduleData,flights:enriched},candidate};
      }
      const response = await upstreamFetch(`https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(candidate)}?${params}`, { headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY, Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      return { response, data, candidate };
    };
    let result = await lookup(ident);
    const alternate = alternateIdent(ident);
    if (result.response.ok && !(result.data.flights || []).length && alternate) result = await lookup(alternate);
    if (result.response.ok && !(result.data.flights || []).length) {
      const canonical = await aeroResult(`/flights/${encodeURIComponent(ident)}/canonical`);
      const candidates = (canonical.data?.idents || []).map(item => item.ident).filter(candidate => candidate && !diagnostics.identifiers_tried.includes(candidate));
      for (const candidate of candidates) {
        const candidateResult = await lookup(candidate);
        result = candidateResult;
        if (!candidateResult.response.ok || (candidateResult.data.flights || []).length) break;
      }
    }
    const { response, data } = result;
    if (!response.ok) {
      const upstream = data.title || data.detail || '';
      const details = response.status === 429 ? 'The connected FlightAware account has reached its request limit. Wait briefly and retry.'
        : response.status === 401 || response.status === 403 ? 'The connected FlightAware account does not authorize this lookup.'
        : response.status === 400 ? 'FlightAware rejected this flight or date window. Try a date closer to today.'
        : response.status === 404 ? `FlightAware has no record for ${ident}. Check the airline code and flight number.`
        : 'FlightAware could not complete this lookup.';
      diagnostics.reason = details;
      recordTelemetry('lookup_failed',{ident,reason:`flightaware_${response.status}`,route_hint:[requestedOrigins.join(','),requestedDestination].filter(Boolean).join('-')});
      const cached=cachedLookup(cacheKey);
      if (cached&&(response.status===429||response.status>=500||response.status===0)) return res.json({...cached.payload,cache_fallback:{active:true,saved_at:new Date(cached.savedAt).toISOString(),reason:details},diagnostics:{...cached.payload.diagnostics,reason:'FlightAware refresh was unavailable; showing the last successful lookup.'}});
      return res.status(response.status).json({ error: details, error_code: `flightaware_${response.status}`, detail: upstream || null, diagnostics });
    }
    const now = Date.now();
    const datedFlights = requestedDate ? (data.flights || []).filter(flight => departureDate(flight) === requestedDate) : (data.flights || []);
    const routeOptions = datedFlights.map(flight => ({ fa_flight_id: flight.fa_flight_id, origin: flight.origin, destination: flight.destination, scheduled_out: flight.scheduled_out }));
    diagnostics.matched_routes = routeOptions.map(option => ({ origin: option.origin?.code_iata || option.origin?.code, destination: option.destination?.code_iata || option.destination?.code, scheduled_out: option.scheduled_out }));
    const originFlights = datedFlights.filter(flight => {
      const origins=[flight.origin?.code,flight.origin?.code_icao,flight.origin?.code_iata];
      const destinations=[flight.destination?.code,flight.destination?.code_icao,flight.destination?.code_iata];
      return (!requestedOrigins.length||requestedOrigins.some(origin=>origins.includes(origin)))&&(!requestedDestination||destinations.includes(requestedDestination))&&(!requestedDeparture||flight.scheduled_out===requestedDeparture);
    });
    const flights = originFlights.sort((a, b) => {
      const ta = new Date(a.scheduled_out || a.estimated_out || 0).getTime();
      const tb = new Date(b.scheduled_out || b.estimated_out || 0).getTime();
      return Math.abs(ta - now) - Math.abs(tb - now);
    });
    if (!flights.length) { diagnostics.reason=routeOptions.length?'Other legs matched, but not the requested route hint.':'No departure matched the selected date in the origin airport’s local time.';recordTelemetry('lookup_failed',{ident,reason:'no_service_on_date',date_offset:requestedDate?Math.round((new Date(`${requestedDate}T12:00:00Z`)-Date.now())/86400000):null,route_hint:[requestedOrigins.join(','),requestedDestination].filter(Boolean).join('-')});const cached=cachedLookup(cacheKey);if(cached)return res.json({...cached.payload,cache_fallback:{active:true,saved_at:new Date(cached.savedAt).toISOString(),reason:diagnostics.reason},diagnostics:{...cached.payload.diagnostics,reason:'Live refresh failed; showing the last successful lookup.'}}); return res.status(404).json({ error: requestedOrigins.length ? `No ${ident} departure from ${requestedOrigins.join(' or ')}${requestedDestination?` to ${requestedDestination}`:''} was found on ${requestedDate}.` : `No ${ident} departure was found on ${requestedDate}.`, error_code: 'no_service_on_date', detail: routeOptions.length ? 'This flight number has other route segments on that date.' : 'The service may not operate daily, may use a codeshare flight number, or may be outside FlightAware’s live schedule coverage.', route_options: routeOptions, diagnostics }); }
    const selected = flights[0];
    diagnostics.resolved_ident = selected.ident_iata || selected.ident_icao || selected.ident;
    const requestedAsCodeshare = [...(selected.codeshares_iata || []),...(selected.codeshares || [])].includes(ident) || diagnostics.identifiers_tried.some(candidate => [...(selected.codeshares || [])].includes(candidate));
    diagnostics.match_type = requestedAsCodeshare ? 'codeshare' : result.candidate === ident ? 'direct' : 'canonical fallback';
    diagnostics.operating_ident = selected.ident_iata || selected.ident;
    diagnostics.operator = selected.operator_iata || selected.operator_icao || selected.operator || null;
    diagnostics.alternate_marketing_idents = [...new Set([...(selected.codeshares_iata||[]),...(selected.codeshares||[])])].slice(0,12);
    const matchReasons=[departureDate(selected)===requestedDate?'Exact origin-local departure date':'Nearest available departure'];
    if(requestedOrigins.length)matchReasons.push('Origin hint matched');
    if(requestedDestination)matchReasons.push('Destination hint matched');
    if(diagnostics.match_type==='codeshare')matchReasons.push('Requested code appears in FlightAware codeshares');
    else if(diagnostics.match_type==='canonical fallback')matchReasons.push('Resolved through canonical airline designator');
    else matchReasons.push('Flight identifier matched directly');
    diagnostics.match_confidence={score:Math.max(70,Math.min(99,(diagnostics.match_type==='direct'?96:diagnostics.match_type==='codeshare'?86:84)+(requestedOrigins.length?3:0)+(requestedDestination?2:0))),reasons:matchReasons};
    let delayIndex = null;
    let inboundAircraft = null;
    let flightPosition = null;
    let inboundPosition = null;
    let delayReasoning = null;
    if (selected) {
      const airport = selected.origin?.code || selected.origin?.code_icao || selected.origin?.code_iata;
      const arrivalAirport = selected.destination?.code || selected.destination?.code_icao || selected.destination?.code_iata;
      const originWeatherAirport = { lookup: airport, icao: selected.origin?.code_icao || (/^[A-Z0-9]{4}$/.test(airport || '') ? airport : null) };
      const arrivalWeatherAirport = { lookup: arrivalAirport, icao: selected.destination?.code_icao || (/^[A-Z0-9]{4}$/.test(arrivalAirport || '') ? arrivalAirport : null) };
      const operator = selected.operator_icao || selected.operator || null;
      const [history, originDelay, originWeather, inbound, destinationDelay, destinationWeather, airline, faa] = await Promise.all([
        loadComparableHistory(selected.ident || ident, selected),
        !futureSchedule&&airport ? aeroCached(`/airports/${encodeURIComponent(airport)}/delays`) : null,
        !futureSchedule?weatherWithFallback(originWeatherAirport):null,
        !futureSchedule&&selected.inbound_fa_flight_id ? aeroCached(`/flights/${encodeURIComponent(selected.inbound_fa_flight_id)}?max_pages=1`,120000) : null,
        !futureSchedule&&arrivalAirport ? aeroCached(`/airports/${encodeURIComponent(arrivalAirport)}/delays`) : null,
        !futureSchedule?weatherWithFallback(arrivalWeatherAirport):null,
        operator ? aeroCached(`/operators/${encodeURIComponent(operator)}/flights?max_pages=1`,300000) : null,
        !futureSchedule && !selected.actual_out && Math.abs(Date.now()-new Date(selected.scheduled_out).getTime()) < 6*60*60*1000 ? loadFaaAdvisories() : null
      ]);
      inboundAircraft = inbound?.flights?.[0] || null;
      delayReasoning = buildDelayReasoning(selected, { originDelay, originWeather, arrivalDelay:destinationDelay, arrivalWeather:destinationWeather, inbound:inboundAircraft, faa });
      const previousContext=flightContexts.get(flightContextKey(selected));
      const assignmentChanges=previousContext?.assignment_changes||[];
      if(previousContext?.registration&&selected.registration&&previousContext.registration!==selected.registration)assignmentChanges.push({from:previousContext.registration,to:selected.registration,at:new Date().toISOString()});
      flightContexts.set(flightContextKey(selected),{registration:selected.registration,assignment_changes:assignmentChanges.slice(-5),originDelay,arrivalDelay:destinationDelay,inbound:inboundAircraft,reasoning:delayReasoning,history:history?.flights||[],retrieved_at:new Date().toISOString()});
      if(flightContexts.size>300)flightContexts.delete(flightContexts.keys().next().value);
      delayIndex = createLiveDelayIndex(selected,history,{originDelay,originWeather,arrivalDelay:destinationDelay,arrivalWeather:destinationWeather,airline,inbound:inboundAircraft});
      if(delayIndex){delayIndex.model_version='route-baseline-v2';delayIndex.methodology='Actual-departure-only route baseline plus unvalidated heuristic live adjustments. Backtesting uses only outcomes known before each historical departure; it does not validate the full live index. Skylink weather is used only as a labeled fallback, never an extra independent vote.';delayIndex.live_series=await recordIndexSnapshot(`v2|${selected.fa_flight_id||`${selected.ident}|${selected.scheduled_out}`}`,delayIndex);}
      const [selectedPosition, priorPosition] = await Promise.all([
        selected.actual_out && !selected.actual_in && selected.fa_flight_id ? aero(`/flights/${encodeURIComponent(selected.fa_flight_id)}/position`) : null,
        inboundAircraft?.actual_out && !inboundAircraft?.actual_in && inboundAircraft.fa_flight_id ? aero(`/flights/${encodeURIComponent(inboundAircraft.fa_flight_id)}/position`) : null
      ]);
      flightPosition = selectedPosition?.last_position || null;
      inboundPosition = priorPosition?.last_position || null;
    }
    const refreshedAt = new Date().toISOString();
    const latestUpdate = flightPosition?.timestamp || selected.actual_in || selected.actual_out || null;
    diagnostics.freshness = { retrieved_at: refreshedAt, latest_operational_timestamp: latestUpdate, source: 'FlightAware AeroAPI' };
    const payload={ flights: flights.slice(0, 6), requested_date: requestedDate || null, schedule_only:futureSchedule, schedule_notice:futureSchedule?'Published airline schedule. Live status, gate, inbound aircraft, airport conditions, and weather are added closer to departure.':null, resolved_ident: result.candidate, route_options: routeOptions, diagnostics, delay_index: delayIndex, inbound_aircraft: inboundAircraft, flight_position: flightPosition, inbound_position: inboundPosition, refreshed_at: refreshedAt };
    payload.delay_reasoning = delayReasoning;
    cacheLookup(cacheKey,payload);
    res.json(payload);
  } catch {
    diagnostics.reason = 'Envolio could not reach FlightAware or parse its response.';
    recordTelemetry('lookup_failed',{ident,reason:'network_or_parse',route_hint:[requestedOrigins.join(','),requestedDestination].filter(Boolean).join('-')});
    const cached=cachedLookup(cacheKey);
    if(cached)return res.json({...cached.payload,cache_fallback:{active:true,saved_at:new Date(cached.savedAt).toISOString(),reason:diagnostics.reason},diagnostics:{...cached.payload.diagnostics,reason:'Network refresh failed; showing the last successful lookup.'}});
    res.status(502).json({ error: 'Unable to reach FlightAware right now. Please try again.', diagnostics });
  }
});

// Secondary enrichment is lazy: a slow provider never blocks primary flight results.
const intelligencePending=new Map();
const intelligenceCache=new Map();
function enrichmentPayload(req){
  const ident=req.params.ident.replace(/[^a-z0-9]/gi,'').toUpperCase();
  const date=String(req.query.date||'');
  const origins=String(req.query.origin||'').toUpperCase().split(',').map(v=>v.replace(/[^A-Z0-9]/g,'')).filter(Boolean).slice(0,5);
  const destination=String(req.query.destination||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const departure=String(req.query.departure||'');
  const exact=cachedLookup(lookupCacheKey(ident,date,[...origins,destination,...(departure?[departure]:[])]))?.payload;
  if(exact)return exact;
  // A search handoff may add an exact route to a broader original lookup.
  // Reuse it only if its selected flight is the same departure and route.
  if(departure){for(const entry of lookupCache.values()){
    const payload=entry.payload,f=payload?.flights?.[0];
    if(Date.now()-entry.savedAt>300000||payload?.diagnostics?.requested_ident!==ident||f?.scheduled_out!==departure)continue;
    if(origins.length&&!origins.some(v=>[f.origin?.code,f.origin?.code_iata,f.origin?.code_icao].includes(v)))continue;
    if(destination&&![f.destination?.code,f.destination?.code_iata,f.destination?.code_icao].includes(destination))continue;
    return payload;
  }}
  return null;
}
function enrichmentFlight(req){return enrichmentPayload(req)?.flights?.[0];}
app.get('/api/flights/:ident/intelligence',async(req,res)=>{
  const payload=enrichmentPayload(req),flight=payload?.flights?.[0];
  if(!flight)return res.status(409).json({error:'Look up this flight before loading additional travel information.'});
  if(Date.now()-Date.parse(payload.refreshed_at)>15*60000)return res.status(409).json({error:'Refresh your flight before comparing it with current secondary sources.'});
  const key=`${flightContextKey(flight)}|${payload.refreshed_at}`;
  const saved=intelligenceCache.get(key);
  if(saved&&Date.now()-saved.at<120000)return res.json(saved.value);
  try{
    if(!intelligencePending.has(key))intelligencePending.set(key,(async()=>{
      const context=flightContexts.get(flightContextKey(flight))||{retrieved_at:payload.refreshed_at,inbound:payload.inbound_aircraft};
      const [secondary,permissions]=await Promise.all([loadSkylinkContext(flight,skylink,Date.now(),context),readProviderPermissions()]);
      const brief=disruptionBrief(flight,secondary,context,context.history||[]);
      const historical=await licensedHistory(flight,permissions);
      const {status_data,faa,aircraft,...publicSecondary}=secondary;
      return {...publicSecondary,brief,strategy:tripStrategy(flight,secondary,brief,context),permissions,historical,extra_receipts:[receipt(faa),receipt(aircraft)]};
    })());
    const value=await intelligencePending.get(key);
    intelligenceCache.set(key,{at:Date.now(),value});
    if(intelligenceCache.size>300)intelligenceCache.delete(intelligenceCache.keys().next().value);
    res.json(value);
  }catch{res.status(503).json({error:'Additional travel information is temporarily unavailable. Your flight result is unchanged.'})}
  finally{intelligencePending.delete(key)}
});
app.get('/api/flights/:ident/connection',async(req,res)=>{
  const first=enrichmentPayload(req),nextIdent=String(req.query.next_ident||'').toUpperCase();
  const airport=first?.flights?.[0]?.destination?.code_iata;
  if(!first||!airport||!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(nextIdent))return res.status(400).json({error:'Look up your flight and enter an onward flight number.'});
  const next=cachedLookup(lookupCacheKey(nextIdent,String(req.query.next_date||''),[airport,'']))?.payload;
  if(!next)return res.status(409).json({error:'Look up the onward flight at your arrival airport first.'});
  const check=connectionCheck(first.flights[0],next.flights?.[0],{buffer:Number(req.query.buffer||60),firstFetched:first.refreshed_at,nextFetched:next.refreshed_at});
  const target=next.flights?.[0]?.destination?.code_iata;
  // Alternate search is explicitly user-triggered and never claims protected rebooking or inventory.
  let alternatives=null;
  if(req.query.alternates==='true'&&['tight','at_risk'].includes(check.status)&&target){
    const result=await skylink(`/tickets/search?${new URLSearchParams({origin:airport,destination:target,date:departureDate(next.flights[0]),passengers:'1'})}`,300000);
    alternatives={...receipt(result),flights:result.status==='available'?suitableAlternatives(result.data?.flights||[],first.flights[0],next.flights[0],check):[],note:'Options are filtered to leave after your estimated arrival plus your chosen allowance. Other connections, seats, fare and eligibility remain unverified; confirm with the airline. No rebooking has been made.'};
  }
  const firstContext=flightContexts.get(flightContextKey(first.flights[0]))||{};
  const history=disruptionBrief(first.flights[0],{airports:[]},firstContext,firstContext.history||[]).history;
  res.json({...check,survival:connectionSurvival(check,first.flights[0],next.flights[0],history),onward:next.flights[0].ident_iata||nextIdent,destination:target,alternatives});
});
app.get('/api/flights/:ident/backups',async(req,res)=>{
  const payload=enrichmentPayload(req),flight=payload?.flights?.[0];
  if(!flight||Date.now()-Date.parse(payload.refreshed_at)>15*60000)return res.status(409).json({error:'Refresh your main flight before checking backup options.'});
  if(flight.actual_out)return res.status(409).json({error:'This flight has departed. Use the onward-connection check for alternatives from your arrival airport.'});
  const origin=flight.origin?.code_iata,destination=flight.destination?.code_iata;
  if(!origin||!destination)return res.status(422).json({error:'Verified airport codes are needed to find backup options.'});
  try{
    const date=departureDate(flight),next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
    const dates=[date,next.toISOString().slice(0,10)];
    const results=await Promise.all(dates.map(date=>skylink(`/tickets/search?${new URLSearchParams({origin,destination,date,passengers:'1'})}`,300000)));
    const prefs={priority:req.query.priority,avoidRedeye:req.query.avoidRedeye==='true',avoidAirportChanges:req.query.avoidAirportChanges!=='false',avoidRegional:req.query.avoidRegional==='true',minLayover:req.query.minLayover,readyMinutes:req.query.readyMinutes};
    const ranked=rankBackups(results.filter(r=>r.status==='available').flatMap(r=>r.data?.flights||[]),flight,prefs);
    // Bounded secondary-status verification: only the top three first legs, exact identity and local date.
    await Promise.all(ranked.flights.slice(0,3).map(async option=>{
      const leg=option.legs[0],f={ident_iata:leg.flight_number.replace(/\s/g,''),origin:flight.origin,destination:{code_iata:leg.arrival_airport},scheduled_out:option.departure_at};
      if(Math.abs(Date.parse(f.scheduled_out)-Date.now())>48*3600000)return;
      const status=await skylink(`/flight_status/${encodeURIComponent(f.ident_iata)}`,120000),match=compareStatus(f,status);
      option.status_check={status:match.status,reported_status:match.status==='matched'?match.reported_status:null,reason:match.reason,receipt:match.receipt};
      if(match.status==='matched'&&/cancel|divert/i.test(match.reported_status||''))option.unusable=true;
    }));
    res.json({...ranked,flights:ranked.flights.filter(f=>!f.unusable),receipts:results.map(receipt),status:results.some(r=>r.status==='available')?'available':'unavailable',checked_at:new Date().toISOString(),monitoring:'Refreshes while this page is open and visible. No background monitoring after you close it.'});
  }catch{res.status(503).json({error:'Backup options are temporarily unavailable. Your original flight is unchanged.'})}
});
app.get('/api/airports/:code/pressure',async(req,res)=>{
  const code=req.params.code.toUpperCase();if(!/^[A-Z]{3,4}$/.test(code))return res.status(400).json({error:'Enter a three-letter airport code, such as JFK.'});
  try{
    const lookup=await skylink(`/airports/search/text?${new URLSearchParams({q:code,limit:'5'})}`,86400000);
    const a=lookup.status==='available'?lookup.data?.airports?.find(a=>a.ident===code||a.iata_code===code):null;
    if(!a||!/^[A-Z]{4}$/.test(a.ident))return res.status(lookup.status==='available'?404:503).json({error:'An exact airport match is unavailable from the connected source. Try its three-letter code.',source:receipt(lookup)});
    const airport={code:a.ident,code_icao:a.ident,code_iata:a.iata_code,country_code:a.iso_country},now=Date.now(),f={origin:airport,destination:airport,scheduled_out:new Date(now).toISOString(),scheduled_in:new Date(now).toISOString()};
    const [secondary,delay]=await Promise.all([loadSkylinkContext(f,skylink,now,{airport_only:true}),aeroCached(`/airports/${a.ident}/delays`,120000)]);
    const brief=disruptionBrief(f,secondary,{originDelay:delay,retrieved_at:new Date(now).toISOString()});
    res.json({...airportPressure(a.iata_code||a.ident,brief.operations[0],secondary.airports[0]?.weather,delay,now),name:a.name,receipts:[receipt(lookup),...secondary.airports.flatMap(a=>a.receipts),receipt(secondary.faa)]});
  }catch{res.status(503).json({error:'Airport conditions could not be checked. No all-clear is implied.'})}
});
app.post('/api/flights/:ident/watch',async(req,res)=>{
  const permissions=await readProviderPermissions();
  if(!permissions.alerts.enabled)return res.status(403).json({error:permissions.alerts.reason,enabled:false});
  const flight=enrichmentFlight(req);
  if(!flight)return res.status(409).json({error:'Refresh the flight first.'});
  const worker=process.env.SKYLINK_ALERT_WORKER_URL,secret=process.env.SKYLINK_ALERT_WORKER_SECRET;
  if(!worker?.startsWith('https://')||!secret)return res.status(503).json({error:'The licensed background alert worker is not configured.'});
  const contact=String(req.body?.email||'').trim();
  if(contact.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))return res.status(400).json({error:'Enter an email address for these alerts.'});
  try{
    const response=await upstreamFetch(worker,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${secret}`},body:JSON.stringify({flight:flight.ident_iata||flight.ident,flight_instance:flightContextKey(flight),date:departureDate(flight),origin:flight.origin?.code_iata,destination:flight.destination?.code_iata,email:contact,events:['flight_delayed','gate_changed','flight_landed'],capacity:permissions.alerts.capacity})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body.active!==true||!body.subscription_id)return res.status(503).json({error:'The alert worker could not confirm an active subscription. No alerts have been promised.'});
    res.status(201).json({active:true,subscription_id:body.subscription_id});
  }catch{res.status(503).json({error:'Alert delivery could not be activated. Please try again later.'})}
});
app.get('/api/flights/:ident/explore',async(req,res)=>{
  const flight=enrichmentFlight(req);
  if(!flight)return res.status(409).json({error:'Look up this flight first.'});
  const from=flight.origin?.code_iata,to=flight.destination?.code_iata;
  const origin=flight.origin?.code_icao||flight.origin?.code;
  let endpoint;
  switch(req.query.product){
    case 'tickets':if(from&&to)endpoint=`/tickets/search?${new URLSearchParams({origin:from,destination:to,date:departureDate(flight),passengers:'1'})}`;break;
    case 'duration':if(from&&to)endpoint=`/ml/flight-time?${new URLSearchParams({from,to})}`;break;
    case 'airport':if(origin)endpoint=`/airports/search?icao=${encodeURIComponent(origin)}`;break;
    case 'routes':if(from)endpoint=`/routes/airport/${encodeURIComponent(from)}`;break;
    case 'aircraft':if(flight.registration)endpoint=`/adsb/aircraft?${new URLSearchParams({registration:flight.registration,limit:'5'})}`;break;
    default:return res.status(400).json({error:'Choose a supported travel product.'});
  }
  if(!endpoint)return res.status(422).json({error:'This flight does not have the identifiers needed for that information.'});
  const result=await skylink(endpoint,req.query.product==='aircraft'?30000:3600000);
  res.json({...receipt(result),data:result.status==='available'?result.data:null,note:req.query.product==='tickets'?'Indicative itinerary and price information, not guaranteed seats or a rebooking offer.':req.query.product==='duration'?'Typical route duration, not a forecast of this flight’s delay.':'Additional data via Skylink. FlightAware remains the operational flight source.'});
});

app.get('/api/airline-icon', async (req, res) => {
  const name = String(req.query.name || '').replace(/[^a-z0-9 .&'-]/gi, '').trim().slice(0, 80);
  if (!name) return res.status(400).end();
  if (iconCache.has(name)) return res.redirect(302, iconCache.get(name));
  try {
    const response = await upstreamFetch(`https://play.google.com/store/search?q=${encodeURIComponent(`${name} airline`)}&c=apps&hl=en&gl=us`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await response.text();
    const match = html.match(/https:\/\/play-lh\.googleusercontent\.com\/[^" ]+=s128/);
    if (!match) return res.status(404).end();
    iconCache.set(name, match[0]);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.redirect(302, match[0]);
  } catch {
    return res.status(404).end();
  }
});

app.post('/api/telemetry/lookup', (req,res)=>{
  const feedback=publicFeedback(req.body);
  recordTelemetry(feedback.type,feedback);
  res.status(202).json({ recorded:true, privacy:'Only an identifier pattern, reason, relative date, and route hint are retained.' });
});

app.post('/api/alerts/subscribe', async (req,res)=>{
  if(process.env.ENABLE_ALERT_SUBSCRIPTIONS!=='true')return res.status(503).json({configured:false,error:'Text and email alerts are not available yet. You can check updates here without sharing your contact details.'});
  const channel=req.body?.channel==='sms'?'sms':'email',contact=String(req.body?.contact||'').trim(),flight=String(req.body?.flight||'').replace(/[^a-z0-9]/gi,'').toUpperCase(),date=String(req.body?.date||''),events=Array.isArray(req.body?.events)?req.body.events.filter(value=>['inbound','gate','boarding','delay','probability','landing','baggage'].includes(value)).slice(0,7):[];
  const valid=channel==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact):/^\+[1-9]\d{7,14}$/.test(contact);
  if(!valid||!flight||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return res.status(400).json({error:channel==='sms'?'Enter a valid phone number in international format, such as +14155550123.':'Enter a valid email address.'});
  const configured=!!process.env.ALERT_DELIVERY_WEBHOOK&&(channel==='email'?!!(process.env.RESEND_API_KEY&&process.env.ALERT_FROM_EMAIL):!!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&(process.env.TWILIO_FROM_NUMBER||process.env.TWILIO_MESSAGING_SERVICE_SID)));
  if(!configured)return res.status(503).json({error:`${channel==='email'?'Email':'SMS'} delivery is not configured on this Envolio deployment. Browser alerts remain available.`,provider:channel==='email'?'Resend':'Twilio',configured:false});
  const record={id:crypto.randomUUID(),created_at:new Date().toISOString(),channel,contact,flight,date,events,active:true};
  try{const delivery=await upstreamFetch(process.env.ALERT_DELIVERY_WEBHOOK,{method:'POST',headers:{'content-type':'application/json',...(process.env.ALERT_WEBHOOK_SECRET?{authorization:`Bearer ${process.env.ALERT_WEBHOOK_SECRET}`}:{})},body:JSON.stringify(record)});if(!delivery.ok)return res.status(502).json({error:'The background alert worker did not accept this subscription.'});await fs.mkdir(path.dirname(alertSubscriptionFile),{recursive:true});await fs.appendFile(alertSubscriptionFile,`${JSON.stringify(record)}\n`);return res.status(201).json({subscribed:true,id:record.id,channel,events,provider:channel==='email'?'Resend':'Twilio',monitoring:'Background alert worker accepted the subscription.',privacy:'Your contact is stored only to deliver the selected flight alerts.'})}catch{return res.status(500).json({error:'Envolio could not activate background monitoring.'})}
});

app.get('/api/telemetry/summary', (req,res)=>{
  if(!process.env.TELEMETRY_ADMIN_TOKEN||req.get('authorization')!==`Bearer ${process.env.TELEMETRY_ADMIN_TOKEN}`)return res.status(404).json({error:'Not found'});
  return res.json({aggregates:[...telemetryCounts.entries()].map(([pattern,count])=>({pattern,count})).sort((a,b)=>b.count-a.count)});
});
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'envolio',uptime_seconds:Math.round(process.uptime())}));
app.use('/api',(_req,res)=>res.status(404).json({error:'This API endpoint is not available.'}));
app.use((error,_req,res,next)=>{if(!error)return next();res.status(error.status===413?413:400).json({error:error.status===413?'The request is too large.':'The request could not be read. Please try again.'});});

app.use(express.static(path.join(root, 'dist'),{maxAge:'1h',setHeaders:(res,file)=>{if(/(?:index\.html|sw\.js|manifest\.webmanifest)$/.test(file))res.setHeader('Cache-Control','no-cache')}}));
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
const server=app.listen(port, '0.0.0.0', () => console.log(`Envolio running on http://localhost:${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
