import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, Clock3, MapPin, Plane, Search, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import './styles.css';
import './premium.css';
import './index.css';

const demoFlight = {
  ident: 'BA286', ident_iata: 'BA286', status: 'En Route / On Time',
  origin: { code_iata: 'SFO', code: 'KSFO', city: 'San Francisco', name: 'San Francisco Intl' },
  destination: { code_iata: 'LHR', code: 'EGLL', city: 'London', name: 'Heathrow' },
  scheduled_out: '2026-09-09T19:20:00Z', estimated_out: '2026-09-09T19:27:00Z',
  scheduled_in: '2026-09-10T05:25:00Z', estimated_in: '2026-09-10T05:18:00Z',
  progress_percent: 62, aircraft_type: 'Boeing 777-300ER', registration: 'G-STBI',
  altitude: 37000, groundspeed: 552, route_distance: 5367
};

const code = (airport) => airport?.code_iata || airport?.code || '—';
const city = (airport) => airport?.city || airport?.name?.split(' ')[0] || 'Unknown';
const clock = (value, zone) => value ? new Intl.DateTimeFormat('en', { hour:'numeric', minute:'2-digit', timeZone: zone }).format(new Date(value)) : '—';
const today = new Date().toISOString().slice(0, 10);

function CarrierLogo({ flight }) {
  const airlineCode = (flight.operator_iata || flight.ident_iata?.toUpperCase().match(/^[A-Z0-9]{2}/)?.[0] || '').toUpperCase();
  const carrierName = flight.operator || airlineCode;
  const [source, setSource] = useState('play');
  const imageUrl = source === 'play'
    ? `${import.meta.env.BASE_URL}api/airline-icon?name=${encodeURIComponent(carrierName)}`
    : `https://images.kiwi.com/airlines/64/${airlineCode}.png`;
  return <div className="carrier-logo" title={flight.operator || airlineCode || 'Airline'}>
    {airlineCode && source !== 'text'
      ? <img src={imageUrl} alt={`${flight.operator || airlineCode} app icon`} onError={() => setSource(source === 'play' ? 'airline' : 'text')} />
      : <span>{airlineCode || <Plane size={20}/>}</span>}
  </div>;
}

function RiskGauge({ value }) {
  const radius = 78;
  const circumference = Math.PI * radius;
  return <div className="risk-gauge">
    <svg viewBox="0 0 200 116" aria-label={`${value} out of 100 delay index`}>
      <defs><linearGradient id="riskGradient"><stop offset="0" stopColor="#20e29a"/><stop offset=".52" stopColor="#ffc857"/><stop offset="1" stopColor="#ff5978"/></linearGradient></defs>
      <path className="gauge-track" d="M22 100a78 78 0 0 1 156 0" pathLength="100"/>
      <path className="gauge-value" d="M22 100a78 78 0 0 1 156 0" pathLength="100" style={{strokeDasharray:`${value} 100`}}/>
    </svg>
    <div><strong>{value}</strong><span>DELAY INDEX</span></div>
  </div>;
}

function TrendChart({ points = [] }) {
  const values = points.length ? points.map(point => point.value) : [20, 26, 24, 31, 28, 34, 30];
  const coords = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${92 - value * .72}`);
  const line = coords.join(' ');
  const area = `0,100 ${line} 100,100`;
  return <div className="trend-chart">
    <div className="chart-title"><span>RECENT DELAY TREND</span><b>{points.length ? `${points.length} departures` : 'Baseline'}</b></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Recent departure delay trend">
      <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9e82ff" stopOpacity=".34"/><stop offset="1" stopColor="#9e82ff" stopOpacity="0"/></linearGradient></defs>
      <g className="grid-lines"><line x1="0" y1="28" x2="100" y2="28"/><line x1="0" y1="52" x2="100" y2="52"/><line x1="0" y1="76" x2="100" y2="76"/></g>
      <polygon points={area} fill="url(#areaGradient)"/><polyline points={line} className="trend-line"/>
      {coords.map((point, index) => { const [x,y] = point.split(','); return <circle key={index} cx={x} cy={y} r="1.5"/>; })}
    </svg>
    <div className="chart-axis"><span>OLDER</span><span>RECENT</span></div>
  </div>;
}

function App() {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(today);
  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [delayIndex, setDelayIndex] = useState(null);

  const progress = useMemo(() => Math.min(94, Math.max(8, flight?.progress_percent ?? 55)), [flight]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible'));
    }, { threshold: 0.16 });
    document.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  async function search(e) {
    e.preventDefault();
    const ident = query.trim().replace(/\s/g, '').toUpperCase();
    if (!ident) return setError('Pop in a flight number first.');
    setLoading(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/flights/${encodeURIComponent(ident)}?date=${encodeURIComponent(date)}`);
      const data = await response.json();
      if (!response.ok || !data.flights?.length) throw new Error(data.error || `No journeys found for ${ident}.`);
      setFlight(data.flights[0]);
      setDelayIndex(data.delay_index || null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const displayed = flight || demoFlight;
  const out = displayed.actual_out || displayed.estimated_out || displayed.scheduled_out;
  const incoming = displayed.actual_in || displayed.estimated_in || displayed.scheduled_in;
  const isDemo = !flight;
  const isDelayed = /delay|cancel|divert/i.test(displayed.status || '');

  return <main>
    <nav>
      <a className="brand" href="#" aria-label="Contrail home"><span className="brand-mark"><Plane size={18}/></span><span>CONTRAIL</span></a>
      <div className="nav-pill"><span className="live-dot" /> LIVE NETWORK</div>
      <button className="nav-link" onClick={() => document.querySelector('input')?.focus()}>Track a flight <ArrowRight size={16}/></button>
    </nav>

    <section className="hero" data-reveal>
      <div className="eyebrow"><span className="ai-pulse"/> Private flight intelligence</div>
      <h1>Know before<br/><em>everyone else.</em></h1>
      <p className="intro">Live operational intelligence for travelers who value certainty.</p>
      <form className="search-box" onSubmit={search}>
        <div className="input-wrap"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Enter flight number, e.g. BA286" aria-label="Flight number" autoComplete="off" /></div>
        <label className="date-wrap"><CalendarDays size={18}/><span>Travel date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} aria-label="Travel date" required /></label>
        <button className="primary" disabled={loading}>{loading ? <span className="spinner"/> : <>Track flight <ArrowRight size={18}/></>}</button>
      </form>
      <div className="hint">Try <button onClick={()=>setQuery('BA286')}>BA286</button>, <button onClick={()=>setQuery('UA1')}>UA1</button>, or <button onClick={()=>setQuery('QF12')}>QF12</button></div>
      {error && <div className="error"><span>{error}</span><button aria-label="Dismiss" onClick={()=>setError('')}><X size={17}/></button></div>}
    </section>

    <section className="results-wrap" data-reveal>
      <div className="section-label"><span>{isDemo ? 'Flight overview' : 'Flight identified'}</span><span>{isDemo ? 'Reference view' : 'Live intelligence'}</span></div>
      <article className="flight-card">
        <div className="card-top">
          <div className="carrier-identity"><CarrierLogo key={`${displayed.ident}-${displayed.operator_iata}`} flight={displayed}/><div><div className="flight-label">{displayed.operator || 'British Airways'} · {displayed.ident_iata || displayed.ident}</div><h2>{displayed.status || 'Scheduled'}</h2></div></div>
          <div className={`status ${isDelayed ? 'negative' : 'positive'}`}>{isDelayed ? <TrendingDown size={16}/> : <TrendingUp size={16}/>} {isDelayed ? 'DELAY RISK' : 'ON TIME'}</div>
        </div>
        <div className="route">
          <div className="airport"><strong>{code(displayed.origin)}</strong><span>{city(displayed.origin)}</span><time>{clock(out, displayed.origin?.timezone)}</time></div>
          <div className="journey-line"><div className="line"><div className="line-fill" style={{width:`${progress}%`}}/><span className="plane-bubble" style={{left:`${progress}%`}}><Plane size={19} fill="currentColor"/></span></div><span>{Math.round(displayed.route_distance || 5367).toLocaleString()} mi journey</span></div>
          <div className="airport right"><strong>{code(displayed.destination)}</strong><span>{city(displayed.destination)}</span><time>{clock(incoming, displayed.destination?.timezone)}</time></div>
        </div>
        <div className="details">
          <div><span className="detail-icon pink"><Clock3 size={18}/></span><p><small>Arrival</small><b>{clock(incoming, displayed.destination?.timezone)}</b></p></div>
          <div><span className="detail-icon blue"><Plane size={18}/></span><p><small>Aircraft</small><b>{displayed.aircraft_type || displayed.aircraft_type_friendly || 'To be assigned'}</b></p></div>
          <div><span className="detail-icon yellow"><MapPin size={18}/></span><p><small>Altitude</small><b>{displayed.altitude ? `${Number(displayed.altitude).toLocaleString()} ft` : 'Not airborne'}</b></p></div>
        </div>
      </article>
      {delayIndex && <article className={`delay-index ${delayIndex.level} is-visible`}>
        <div className="index-head"><div><span className="index-kicker">CONTRAIL DELAY INDEX</span><h3>Departure risk signal</h3></div><div className="index-quote"><span className="index-value">{delayIndex.score}</span><span className="index-denom">/ 100</span><span className={`index-move ${delayIndex.trend}`}>{delayIndex.trend === 'up' ? <TrendingUp size={15}/> : <TrendingDown size={15}/>} {delayIndex.level.toUpperCase()}</span></div></div>
        <div className="visual-grid"><RiskGauge value={delayIndex.score}/><TrendChart points={delayIndex.trend_points}/></div>
        <div className="index-scale"><span style={{width:`${delayIndex.score}%`}}/><i style={{left:`${delayIndex.score}%`}}/></div>
        <div className="factor-grid">{delayIndex.factors.map((factor) => <div key={factor.label}><span>{factor.label}</span><b>{factor.value}</b><div><i style={{width:`${factor.value}%`}}/></div><p>{factor.detail}</p></div>)}</div>
        <div className="index-foot"><span>Confidence: <b>{delayIndex.confidence}</b></span><p>{delayIndex.methodology} Not a guarantee.</p></div>
      </article>}
    </section>

    <section className="promise" data-reveal>
      <div className="promise-copy"><span className="section-index">01 / INTELLIGENCE</span><h3>Signal over noise.<br/>Every journey.</h3><p>Operational flight data, distilled into a decisive private view.</p></div>
      <div className="feature-grid"><div><Plane size={22}/><span>01</span><b>Live operations</b><p>Current flight status sourced directly from the network.</p></div><div><Clock3 size={22}/><span>02</span><b>Precise timing</b><p>Scheduled and estimated movements in local time.</p></div><div><MapPin size={22}/><span>03</span><b>Route clarity</b><p>The information that matters, without distraction.</p></div></div>
    </section>
    <footer><a className="brand small" href="#"><span className="brand-mark"><Plane size={14}/></span><span>CONTRAIL</span></a><p>Flight intelligence, clearly delivered.</p><span>Data by FlightAware</span></footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>);
