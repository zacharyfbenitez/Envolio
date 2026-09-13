// Server-only adapter. Provider failures and stale data are explicit, never evidence of clear skies.
const BASE = 'https://data.skylinkapi.com/v3.1';
export const clean = v => typeof v === 'string' && !/^(?:--?|n\/a|unknown|null)$/i.test(v.trim()) ? v.trim() : null;
const code = v => clean(v)?.match(/^([A-Z0-9]{3,4})(?:\s|$)/)?.[1] || null;
const instant = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN;
const fresh = (v, now, minutes) => Number.isFinite(instant(v)) && now - instant(v) >= -300000 && now - instant(v) <= minutes * 60000;

export function createSkylinkClient({ key = process.env.SKYLINK_API_KEY, fetcher = fetch, now = Date.now, timeout = 6500, budget = 1200 } = {}) {
  const cache = new Map(), pending = new Map();
  let count = 0, day = '', blockedUntil = 0;
  return async function request(path, ttl = 300000) {
    const time = now(), today = new Date(time).toISOString().slice(0,10);
    if (today !== day) { day = today; count = 0; }
    const previous = cache.get(path);
    const unavailable = (status, http_status = null) => previous?.data
      ? { ...previous, status: 'stale', failure: status, cached: true, http_status }
      : { provider: 'Skylink', endpoint: path, status, http_status, data: null, retrieved_at: null };
    if (!key) return unavailable('not_configured');
    if (previous && time - previous.saved_at < (previous.data ? ttl : 30000)) return { ...previous, cached: true };
    if (pending.has(path)) return pending.get(path);
    if (time < blockedUntil) return unavailable('rate_limited');
    if (count >= budget) return unavailable('budget_limited');
    const task = (async () => {
      count++;
      let result;
      try {
        const r = await fetcher(BASE + path, { headers: { 'x-api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
        if (r.status === 429) blockedUntil = now() + 60000;
        const status = r.ok ? 'available' : ({401:'unauthorized',403:'plan_restricted',404:'not_found',429:'rate_limited'}[r.status] || 'unavailable');
        const data = r.ok ? await r.json() : null;
        if (data && typeof data === 'object') result = { provider: 'Skylink', endpoint: path, status, data, http_status: r.status, retrieved_at: new Date(now()).toISOString(), saved_at: now(), cached: false };
        else result = unavailable(r.ok ? 'invalid_response' : status, r.status);
      } catch { result = unavailable('timeout_or_network'); }
      if (result.status !== 'stale') {
        cache.set(path, { ...result, saved_at: now() });
        if (cache.size > 600) cache.delete(cache.keys().next().value);
      }
      return result;
    })();
    pending.set(path, task);
    try { return await task; } finally { pending.delete(path); }
  };
}
export const skylink = createSkylinkClient();
export const receipt = r => ({ provider: r.provider, endpoint: r.endpoint, status: r.status, retrieved_at: r.retrieved_at, cached: !!r.cached, failure: r.failure || null });

export function compareStatus(flight, result) {
  const d = result.data;
  const reject = reason => ({ status: result.status === 'available' ? 'unmatched' : result.status, reason, fields: {}, conflicts: [], receipt: receipt(result) });
  if (result.status !== 'available' || !d?.departure || !d?.arrival) return reject('A current secondary status could not be verified.');
  const aliases = [flight.ident, flight.ident_iata, flight.ident_icao, ...(flight.codeshares || []), ...(flight.codeshares_iata || [])].filter(Boolean).map(v => v.replace(/\s/g,''));
  if (!aliases.includes(String(d.flight_number).replace(/\s/g,''))) return reject('The flight identifier differs.');
  for (const side of ['origin', 'destination']) {
    const other = d[side === 'origin' ? 'departure' : 'arrival'];
    if (![flight[side]?.code, flight[side]?.code_iata, flight[side]?.code_icao].filter(Boolean).includes(code(other.airport))) return reject('The route differs; secondary data was not merged.');
  }
  const stamp = Date.parse(flight.scheduled_out);
  if (!Number.isFinite(stamp) || !flight.origin?.timezone) return reject('Origin-local departure time cannot be verified.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:flight.origin.timezone,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));
  const sourceDay=String(d.departure.scheduled_date).trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})$/);
  if (!sourceDay || +parts.day !== +sourceDay[1] || parts.month.slice(0,3).toLowerCase() !== sourceDay[2].slice(0,3).toLowerCase()
    || `${parts.hour}:${parts.minute}` !== d.departure.scheduled_time
    || Math.abs(stamp - Date.parse(result.retrieved_at)) > 48*3600000) return reject('The departure date or time differs; secondary data was not merged.');
  const fields = {}, conflicts = [];
  for (const [field, value] of Object.entries({gate_origin:d.departure.gate,terminal_origin:d.departure.terminal,gate_destination:d.arrival.gate,terminal_destination:d.arrival.terminal,baggage_claim:d.arrival.baggage})) {
    if (!clean(value)) continue;
    if (!clean(flight[field])) fields[field] = clean(value);
    else if (clean(flight[field]).toLowerCase() !== clean(value).toLowerCase()) conflicts.push({field,flightaware:flight[field],skylink:clean(value)});
  }
  return { status:'matched', reason:'Flight number, route, local departure date and scheduled time match. Actual/estimated times are not merged.', fields, conflicts, receipt:receipt(result), reported_status:clean(d.status) };
}

export function metarWeather(result, now = Date.now()) {
  const d = result.data, p = d?.parsed;
  if (result.status !== 'available' || !p || !fresh(p.time, now, 120)) return null;
  // AeroAPI consumers expect statute miles. Do not treat international METAR metres as miles.
  const repr=String(p.visibility?.repr || ''),raw=String(d.raw || '');
  const metres=repr.match(/^\d{4}$/)?.[0] || raw.match(/\b\d{3}(?:V\d{3})?\d{2}(?:G\d{2})?KT\s+(\d{4})\b/)?.[1];
  const visibility=/CAVOK/.test(raw)?10000/1609.344:metres?Number(metres)/1609.344:/^P6/.test(repr)?6.1:p.visibility?.value===0?0:/SM/.test(repr)||/\b\S+SM\b/.test(raw)?p.visibility?.value ?? null:null;
  return { provider:'Skylink',provider_detail:'Airport METAR via Skylink',station:d.icao,endpoint:result.endpoint,retrieved_at:result.retrieved_at,
    observations:[{time:p.time,wind_speed:p.wind?.speed ?? null,wind_speed_gust:p.wind?.gust ?? null,visibility,conditions:(p.wx_codes || []).map(v=>v.value || v.repr).join(', '),cloud_friendly:p.flight_rules,raw_data:d.raw}] };
}

export function forecastAt(result, target, now = Date.now()) {
  const d = result.data, p = d?.parsed, time = Date.parse(target);
  const base = { ...receipt(result), airport:d?.icao, target_at:target, raw:d?.raw || null };
  if (result.status !== 'available') return {...base, summary:'Forecast temporarily unavailable.'};
  if (!p || !fresh(result.retrieved_at, now, 30) || !(instant(p.start_time) <= time && time < instant(p.end_time)) || time < now - 3600000) return {...base,status:'outside_window',summary:'No published forecast covers this flight time yet.'};
  const rows = (p.forecast || []).filter(r => instant(r.start_time) <= time && time < instant(r.end_time));
  const baseline = rows.filter(r=>r.type === 'FROM' && !r.probability).at(-1);
  if (!baseline) return {...base,status:'incomplete',summary:'Forecast periods could not be matched reliably.'};
  const describe = r => {
    const weather = (r.wx_codes || []).map(w=>w.value || w.repr).filter(Boolean);
    if (Number.isFinite(r.wind?.gust ?? r.wind?.speed)) weather.push(`wind ${r.wind.gust ?? r.wind.speed} kt`);
    if (['IFR','LIFR'].includes(r.flight_rules)) weather.push('low cloud or visibility');
    return weather.join(' · ') || 'No significant weather listed in this period';
  };
  return {...base,status:'available',valid_from:p.start_time,valid_until:p.end_time,summary:describe(baseline),
    modifiers:rows.filter(r=>r !== baseline && (r.probability || r.type !== 'FROM')).map(r=>({summary:describe(r),type:r.type,weather_probability:r.probability?.value ?? null})),
    note:'Weather forecast, not a flight-delay probability or confirmed delay cause.'};
}

function noticeTime(value) {
  const m = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  return m ? Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]) : NaN;
}
export function relevantNotices(result, airport, target) {
  if (result.status !== 'available') return [];
  const t = Date.parse(target);
  return (result.data?.notams || []).filter(n => n.location === airport && n.type !== 'C'
    && noticeTime(n.effective) <= t && (noticeTime(n.expiration) > t || n.expiration === 'PERM')
    && !n.schedule && !/NON.?SKED|PPR|GENERAL AVIATION|EXC|EXCEPT|\bWHEN\b|\bIF\b|CRANE|\bDAILY\b/i.test(n.body || '')
    && /(?:^|\n)\s*(?:(?:RWY|RUNWAY)\s+\d{2}[LRC]?(?:\/\d{2}[LRC]?)?(?:\s+(?:ENTRY|ENRTY|EXIT)(?:\/EXIT)?\s+[A-Z0-9/]+)?|AD|AIRPORT|TERMINAL\s+[A-Z0-9]+)\s+(?:IS\s+)?(?:CLSD|CLOSED)\b/i.test(n.body || '')
  ).slice(0,3).map(n => ({id:n.notam_id,airport,category:/\bTERMINAL\b/i.test(n.body)?'terminal':'runway',title:/\bTERMINAL\b/i.test(n.body)?'Terminal closure notice':/\b(?:ENTRY|ENRTY|EXIT)\b/i.test(n.body)?'Runway access restriction':/\b(?:RWY|RUNWAY)\b/i.test(n.body)?'Runway closure notice':'Airport closure notice',
    detail:n.body, effective:n.effective,expiration:n.expiration,source:'Published NOTAM via Skylink',receipt:receipt(result),
    note:'Published for the airport; impact on this flight is not confirmed.'}));
}

export async function loadSkylinkContext(flight, request = skylink, now = Date.now(), context = {}) {
  const near = Math.abs(Date.parse(flight.scheduled_out) - now) < 48*3600000 && !flight.schedule_only;
  const inbound=context.inbound;
  const code=a=>a?.code_icao||a?.code||a?.code_iata;
  const assigned=inbound&&flight.inbound_fa_flight_id&&inbound.fa_flight_id===flight.inbound_fa_flight_id&&code(inbound.destination)===code(flight.origin)&&(!clean(flight.registration)||!clean(inbound.registration)||clean(flight.registration).toUpperCase()===clean(inbound.registration).toUpperCase());
  const tail=(assigned?inbound.registration:null) || flight.registration;
  const skip=endpoint=>({provider:'Skylink',status:'outside_window',endpoint,data:null});
  const [status, faa, aircraft, ...airports] = await Promise.all([
    near && !context.airport_only ? request(`/flight_status/${encodeURIComponent(flight.ident_iata || flight.ident)}`,120000) : Promise.resolve({provider:'Skylink',status:'outside_window',endpoint:'/flight_status/{flight}',data:null}),
    near&&[flight.origin,flight.destination].some(a=>/^K[A-Z]{3}$/.test(a?.code_icao||a?.code||'')||a?.country_code==='US')?request('/delays/faa',120000):skip('/delays/faa'),
    near&&tail?request(`/adsb/aircraft?${new URLSearchParams({registration:tail,limit:'5'})}`,30000):skip('/adsb/aircraft'),
    ...(context.airport_only?['origin']:['origin','destination']).map(async side => {
      const a = flight[side], icao = a?.code_icao || (/^[A-Z]{4}$/.test(a?.code || '') ? a.code : null);
      if (!icao) return {side,status:'unknown_airport',receipts:[]};
      const target = side === 'origin' ? flight.estimated_out || flight.scheduled_out : flight.estimated_in || flight.scheduled_in;
      const forecastUseful = Date.parse(target) > now - 3600000 && Date.parse(target) < now + 30*3600000;
      const skip = endpoint => ({provider:'Skylink',endpoint,status:'outside_window',data:null});
      const [taf,notams,metar] = await Promise.all([
        forecastUseful ? request(`/weather/taf/${icao}?parsed=true`,600000) : skip(`/weather/taf/${icao}`),
        Date.parse(target) >= now - 3600000 ? request(`/notams/${icao}?include_future=true&exclude_qcode=QK&exclude_scope=FIR`,300000) : skip(`/notams/${icao}`),
        near ? request(`/weather/metar/${icao}?parsed=true`,300000) : skip(`/weather/metar/${icao}`)
      ]);
      const windows=Array.from({length:25},(_,i)=>{const at=new Date(now+i*3*3600000).toISOString();return {at,forecast:forecastAt(taf,at,now),notices:relevantNotices(notams,icao,at)}});
      return {side,airport:a.code_iata || icao,windows,forecast:forecastAt(taf,target,now),weather:metarWeather(metar,now),notices:relevantNotices(notams,icao,target),receipts:[receipt(taf),receipt(notams),receipt(metar)]};
    })
  ]);
  const comparison = compareStatus(flight,status);
  return {provider:'Skylink',comparison,status_data:comparison.status==='matched'?status.data:null,faa,aircraft,airports,checked_at:new Date(now).toISOString(),
    policy:'FlightAware remains the flight identity and operational timeline source. Skylink fills verified missing gate/terminal fields; conflicts remain visible. Weather and notices are context, not independent votes or calibrated delay predictions.'};
}
