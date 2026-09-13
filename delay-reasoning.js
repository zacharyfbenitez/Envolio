import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const FAA_URL = 'https://nasstatus.faa.gov/api/airport-status-information';
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const stamp = value => typeof value === 'number' ? value * 1000 : Date.parse(value);
const minutes = (a, b) => (stamp(a) - stamp(b)) / 60000;
const airportCode = airport => airport?.code_iata || airport?.alternate_ident || airport?.code;
const fresh = (time, now, maxMinutes) => Number.isFinite(stamp(time)) && now - stamp(time) >= -300000 && now - stamp(time) <= maxMinutes * 60000;

export function parseFaaAdvisories(xml, now = Date.now()) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid FAA response');
  const root = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml).AIRPORT_STATUS_INFORMATION;
  if (!root?.Update_Time) throw new Error('FAA update time missing');
  const observed = new Date(root.Update_Time).toISOString();
  const events = [];
  for (const type of list(root.Delay_type)) {
    for (const [container, item] of [['Ground_Delay_List','Ground_Delay'], ['Ground_Stop_List','Ground_Stop'], ['Arrival_Departure_Delay_List','Delay'], ['Airport_Closure_List','Airport']]) {
      for (const event of list(type[container]?.[item])) {
        if (typeof event.ARPT !== 'string') continue;
        events.push({ airport: event.ARPT, type: type.Name, reason: String(event.Reason || 'Reason not specified'), average: event.Avg || null, scope: event.Arrival_Departure?.['@_Type'] || null, observed_at: observed });
      }
    }
  }
  return { status: fresh(observed, now, 30) ? 'available' : 'stale', observed_at: observed, retrieved_at: new Date(now).toISOString(), endpoint: FAA_URL, events };
}

let faaCache;
let faaPending;
export async function loadFaaAdvisories() {
  if (faaCache && Date.now() - faaCache.savedAt < 300000) return faaCache.value;
  if (faaPending) return faaPending;
  faaPending = (async () => {
    let value;
    try {
      const response = await fetch(FAA_URL, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/xml' } });
      if (!response.ok) throw new Error('FAA unavailable');
      value = parseFaaAdvisories(await response.text());
    } catch {
      value = { status: 'unavailable', endpoint: FAA_URL, retrieved_at: new Date().toISOString(), events: [] };
    }
    faaCache = { savedAt: Date.now(), value };
    return value;
  })();
  try { return await faaPending; } finally { faaPending = null; }
}

// Evidence scores describe rule strength, not calibrated probabilities of causation.
export function buildDelayReasoning(flight, context = {}, now = Date.now()) {
  const updated = new Date(now).toISOString();
  const reasons = [];
  const sources = [];
  const add = (id, classification, title, detail, score, source, endpoint, observed = null) => reasons.push({ id, classification, title, detail, confidence_score: score, source, endpoint, observed_at: observed, retrieved_at: updated });
  const result = (status, summary) => ({ version: 1, status, summary, updated_at: updated, primary_reason: reasons[0] || null, reasons, sources, confidence_method: 'Heuristic evidence strength (0–100), not a probability that the cause is correct. Scores are not empirically calibrated.', recommendation: flight.actual_out ? 'Follow the airline’s arrival updates.' : 'Keep checking the airline’s departure and boarding updates.' });
  const flightEndpoint = `/flights/${encodeURIComponent(flight.fa_flight_id || flight.ident || '')}`;
  sources.push({ name: 'FlightAware flight status', status: 'available', endpoint: flightEndpoint, retrieved_at: updated });
  const status = String(flight.status || '');
  const explicit = status.match(/(?:delay(?:ed)?|cancel(?:led|ed)|divert(?:ed)?)\b.*?\b(?:due to|because of)\s+(.+)/i);
  if (explicit) add('published', 'confirmed', 'Published flight reason', explicit[1], 95, 'FlightAware flight status', flightEndpoint);
  if (flight.schedule_only || minutes(flight.scheduled_out, updated) > 360) {
    return result('too_early', 'Delay reasons become useful closer to departure. Today’s weather and airport conditions do not explain this future flight.');
  }
  if (flight.actual_out || minutes(updated, flight.estimated_out || flight.scheduled_out) > 360) {
    return result(reasons.length ? 'confirmed' : 'unavailable', reasons.length ? reasons[0].detail : 'No confirmed flight-specific cause is available. Current conditions cannot establish why an earlier departure was delayed.');
  }
  const departureVariance = minutes(flight.estimated_out, flight.scheduled_out);
  const inbound = context.inbound;
  sources.push({ name: 'FlightAware inbound aircraft', status: inbound ? 'available' : 'unavailable', retrieved_at: updated });
  if (inbound && flight.inbound_fa_flight_id && inbound.fa_flight_id === flight.inbound_fa_flight_id && airportCode(inbound.destination) === airportCode(flight.origin)) {
    const arrival = inbound.actual_in || inbound.estimated_in;
    const remaining = minutes(flight.scheduled_out, arrival);
    const late = minutes(arrival, inbound.scheduled_in);
    if (Number.isFinite(remaining) && remaining < 45 && minutes(updated, arrival) < 360) {
      const over = remaining < 0;
      add('inbound', over ? 'likely' : 'possible', over ? 'Inbound aircraft arrives after scheduled departure' : 'Short aircraft turnaround', `${inbound.ident_iata || inbound.ident || 'Inbound flight'} ${inbound.actual_in ? 'arrived' : 'is expected'}${late >= 15 ? ` ${Math.round(late)} minutes late` : ''}. ${over ? `Arrival is ${Math.round(-remaining)} minutes after this flight’s scheduled departure.` : `Only ${Math.round(remaining)} minutes remain before scheduled departure. A 45-minute turnaround is a planning assumption; airline requirements vary.`}`, over ? 85 : 55, 'FlightAware aircraft rotation', `/flights/${inbound.fa_flight_id}`, null);
    }
  }
  for (const [side, airport, advisory, weather] of [['departure', flight.origin, context.originDelay, context.originWeather], ['arrival', flight.destination, context.arrivalDelay, context.arrivalWeather]]) {
    const code = airportCode(airport);
    sources.push({ name: `FlightAware ${side} airport`, status: advisory ? 'available' : 'unavailable', retrieved_at: updated });
    if (advisory && ['red', 'yellow'].includes(advisory.color)) {
      const detail = list(advisory.reasons).map(r => typeof r.reason === 'string' ? r.reason : '').filter(Boolean).join('; ');
      add(`airport-${side}`, 'possible', `Airport disruption at ${code}`, `${detail || 'Airport delay conditions reported.'} This airport-wide report does not confirm a cause for this flight.`, 50, 'FlightAware airport delays', `/airports/${airport?.code_icao || code}/delays`);
    }
    const report = weather?.observations?.[0];
    const observed = report?.time || report?.report_time;
    const usable = report && fresh(observed, now, 120);
    sources.push({ name: `${weather?.provider || 'Weather'} at ${code}`, status: !report ? 'unavailable' : usable ? 'available' : 'stale', observed_at: observed || null, retrieved_at: weather?.retrieved_at || updated });
    if (usable) {
      const conditions = String(report.conditions || report.raw_data || '');
      const gust = Number(report.wind_speed_gust || report.wind_speed);
      const hazards = [];
      if (/\b[+-]?(?:TS(?:RA|GR|GS)?|FZ(?:RA|DZ|FG)|SN|FG)\b|thunderstorm|freezing|snow|fog/i.test(conditions)) hazards.push(conditions);
      if (Number.isFinite(gust) && gust >= 30) hazards.push(`winds up to ${gust} kt`);
      if (hazards.length) add(`weather-${side}`, 'possible', `Weather may affect ${code}`, `${hazards.join(' · ')}. This is an observation at the airport, not a confirmed cause or a forecast.`, 40, weather.provider || 'FlightAware weather', weather.provider === 'Aviation Weather Center' ? 'https://aviationweather.gov/api/data/metar' : `/airports/${airport?.code_icao || code}/weather/observations`, observed);
    }
  }
  const faa = context.faa;
  sources.push({ name: 'FAA airport advisories', status: faa?.status || 'unavailable', endpoint: FAA_URL, observed_at: faa?.observed_at || null, retrieved_at: faa?.retrieved_at || updated });
  if (faa?.status === 'available' && fresh(faa.observed_at, now, 30)) {
    for (const event of faa.events || []) {
      if (![airportCode(flight.origin), airportCode(flight.destination)].includes(event.airport)) continue;
      // Restricted general-aviation closures must not be presented as airline groundings.
      if (/NON SKED|TRANSIENT|\bGA\b|PPR/.test(event.reason)) continue;
      add(`faa-${event.airport}-${event.type}`, 'possible', `${event.type} at ${event.airport}`, `${event.reason}${event.average ? ` · airport average delay ${event.average}` : ''}. Published for the airport; applicability to this flight is unconfirmed.`, 60, 'FAA NAS Status', FAA_URL, faa.observed_at);
    }
  }
  reasons.sort((a,b) => b.confidence_score - a.confidence_score);
  const summary = reasons.length ? `${reasons[0].title}. ${reasons[0].classification === 'confirmed' ? 'The cause is stated in the published flight status.' : 'No confirmed flight-specific cause has been published; these are supporting operational clues.'}` : departureVariance >= 15 ? `Departure is estimated ${Math.round(departureVariance)} minutes late. No supported explanation is available from the current sources.` : 'No supported delay reason is available right now. Missing advisories do not establish that the flight will be on time.';
  return result(reasons[0]?.classification || 'unavailable', summary);
}
