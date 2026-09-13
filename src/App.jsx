import React, { useEffect, useState, useRef } from "react";
import WebShell from './WebShell.jsx';
import FlightSearch from './FlightSearch.jsx';
import {searchKey,takeSearchResult} from './flight-search.js';
import {rememberFlight,readJourneys,SAVED_KEY,journeyUrl} from './journeys.js';
import { travelAdvice } from './travel-advice.js';
import TravelIntelligence from './TravelIntelligence.jsx';
import {travelerChance} from './traveler-presentation.js';
import InboundSummary from './InboundSummary.jsx';
import RiskContext from './RiskContext.jsx';
import TakeoffSlot from './TakeoffSlot.jsx';
import {AirportExplorer} from './TripStrategy.jsx';
import {
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  Cloud,
  Database,
  Download,
  Plane,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

const today = localISO(new Date()),
  base = import.meta.env.BASE_URL;
const code = (a) => {
    const value=a?.code_iata||a?.alternate_ident||a?.code||a?.airport_code||a?.code_icao;
    if(!value)return "—";
    if(/^K[A-Z]{3}$/.test(value))return value.slice(1);
    return value;
  },
  city = (a) => a?.city || a?.name || "Not reported",
  shown = (v, s = "") =>
    v !== null && v !== undefined && v !== "" ? `${v}${s}` : "Not reported";
const airportCountries = {
  JFK: "US",
  LGA: "US",
  EWR: "US",
  LAX: "US",
  SFO: "US",
  ORD: "US",
  MDW: "US",
  DFW: "US",
  ATL: "US",
  MIA: "US",
  FLL: "US",
  BOS: "US",
  SEA: "US",
  DEN: "US",
  PHX: "US",
  IAD: "US",
  DCA: "US",
  BWI: "US",
  LAS: "US",
  IAH: "US",
  HNL: "US",
  LHR: "GB",
  LGW: "GB",
  LCY: "GB",
  STN: "GB",
  MAN: "GB",
  EDI: "GB",
  CDG: "FR",
  ORY: "FR",
  NCE: "FR",
  FRA: "DE",
  MUC: "DE",
  BER: "DE",
  AMS: "NL",
  MAD: "ES",
  BCN: "ES",
  FCO: "IT",
  MXP: "IT",
  ZRH: "CH",
  VIE: "AT",
  DUB: "IE",
  LIS: "PT",
  CPH: "DK",
  ARN: "SE",
  OSL: "NO",
  HEL: "FI",
  NRT: "JP",
  HND: "JP",
  KIX: "JP",
  SIN: "SG",
  HKG: "HK",
  ICN: "KR",
  PEK: "CN",
  PKX: "CN",
  PVG: "CN",
  TPE: "TW",
  BKK: "TH",
  DEL: "IN",
  BOM: "IN",
  DXB: "AE",
  AUH: "AE",
  DOH: "QA",
  IST: "TR",
  SYD: "AU",
  MEL: "AU",
  BNE: "AU",
  AKL: "NZ",
  YYZ: "CA",
  YVR: "CA",
  YUL: "CA",
  MEX: "MX",
  GRU: "BR",
  EZE: "AR",
  JNB: "ZA",
  CPT: "ZA",
};
const timezoneCountries = {
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Amsterdam": "NL",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Dublin": "IE",
  "Europe/Lisbon": "PT",
  "Europe/Copenhagen": "DK",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Helsinki": "FI",
  "Asia/Tokyo": "JP",
  "Asia/Singapore": "SG",
  "Asia/Hong_Kong": "HK",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Taipei": "TW",
  "Asia/Bangkok": "TH",
  "Asia/Kolkata": "IN",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Europe/Istanbul": "TR",
  "Pacific/Auckland": "NZ",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Montreal": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "Africa/Johannesburg": "ZA",
};
const usTimezones = new Set([
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
]);
function countryForAirport(airport) {
  if (!airport) return null;
  const explicit = (
    airport.country_code ||
    airport.country_code_iso ||
    ""
  ).toUpperCase();
  let iso = /^[A-Z]{2}$/.test(explicit)
    ? explicit
    : airportCountries[code(airport).toUpperCase()] ||
      timezoneCountries[airport.timezone] ||
      (/^Australia\//.test(airport.timezone || "")
        ? "AU"
        : usTimezones.has(airport.timezone)
          ? "US"
          : null);
  if (!iso) return null;
  try {
    return {
      iso,
      name: new Intl.DisplayNames(["en"], { type: "region" }).of(iso),
    };
  } catch {
    return null;
  }
}
function CountryMarker({ airport }) {
  const country = countryForAirport(airport);
  if (!country) return null;
  return (
    <span
      className="airport-country"
      title={country.name}
      aria-label={country.name}
    >
      <img
        src={`https://flagcdn.com/${country.iso.toLowerCase()}.svg`}
        alt=""
        loading="lazy"
      />
    </span>
  );
}
const dateLabel = (d) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${d}T12:00:00Z`));
const clock = (stamp, zone) => {
  if (!stamp) return "Not reported";
  try {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone || undefined,
    }).format(new Date(stamp));
  } catch {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(stamp));
  }
};
const flightPhase = (f) =>
  f.actual_in || /arrived|landed/i.test(f.status || "")
    ? "landed"
    : f.actual_out || /en route|airborne/i.test(f.status || "")
      ? "inflight"
      : "upcoming";
function AnimatedNumber({ value, suffix = "", duration = 900 }) {
  const ref = React.useRef(null),
    [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    const node = ref.current,
      target = node?.closest(".probability-index,.validation-panel") || node,
      reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame,
      observer,
      started = false;
    const run = () => {
      if (started) return;
      started = true;
      removeEventListener("scroll", check);
      const from = 0,
        start = performance.now(),
        tick = (now) => {
          const progress = Math.min(1, (now - start) / duration),
            eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(from + (value - from) * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
      frame = requestAnimationFrame(tick);
    };
    const check = () => {
      const rect = target?.getBoundingClientRect();
      if (rect && rect.top < innerHeight && rect.bottom > 0) run();
    };
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "60px 0px" },
    );
    if (target) observer.observe(target);
    addEventListener("scroll", check, { passive: true });
    check();
    return () => {
      observer?.disconnect();
      removeEventListener("scroll", check);
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);
  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

function localISO(date) { return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10); }

function useRoute() {
  const read = () => {
    const path = location.pathname.startsWith(base)
        ? location.pathname.slice(base.length - 1)
        : location.pathname,
      flight = path.match(/^\/flight\/([^/]+)/),
      route = path.match(/^\/routes\/([A-Z]{3})-([A-Z]{3})/i),
      airport = path.match(/^\/airports\/([A-Z]{3,4})\/delays/i),
      query = new URLSearchParams(location.search);
    if (flight)
      return {
        page: "flight",
        ident: decodeURIComponent(flight[1]),
        date: query.get("date") || today,
        origin: query.get("origin") || "",
        destination: query.get("destination") || "",
        departure: query.get("departure") || "",
      };
    if (route)
      return {
        page: "route-landing",
        origin: route[1].toUpperCase(),
        destination: route[2].toUpperCase(),
      };
    if (airport)
      return { page: "airport-landing", airport: airport[1].toUpperCase() };
    if (path.startsWith("/dashboard")) return { page: "dashboard" };
    if (path.startsWith("/premium")) return { page: "premium" };
    if (path.startsWith("/developers")) return { page: "developers" };
    return { page: "home" };
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => setR(read());
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  return [
    r,
    (url) => {
      history.pushState({}, "", url);
      setR(read());
      scrollTo({ top: 0, behavior: "smooth" });
    },
  ];
}
function useSaved() {
  const [saved, setSaved] = useState(() => {
    try {
      return readJourneys(SAVED_KEY);
    } catch {
      return [];
    }
  });
  const update = (n) => {
    setSaved(n);
    try{localStorage.setItem("contrail.saved", JSON.stringify(n));setStorageError(false);}catch{setStorageError(true);}
  };
  const [storageError,setStorageError]=useState(false);
  useEffect(()=>{const sync=e=>{if(e.key===SAVED_KEY)setSaved(readJourneys(SAVED_KEY));};addEventListener('storage',sync);return()=>removeEventListener('storage',sync);},[]);
  return {
    saved,
    storageError,
    toggle: (item) => {
      const key = `${item.ident}|${item.date}|${code(item.origin)}`;
      update(
        saved.some(
          (x) => x.key === key || x.key === `${item.ident}|${item.date}`,
        )
          ? saved.filter(
              (x) => x.key !== key && x.key !== `${item.ident}|${item.date}`,
            )
          : [{ ...item, key, favorite: true }, ...saved].slice(0, 20),
      );
    },
    remove: (key) => update(saved.filter((x) => x.key !== key)),
  };
}
function Header({ go }) {
  return (
    <nav className="site-nav">
      <button className="brand brand-button" onClick={() => go(base)}>
        <span className="brand-mark">
          <img src={`${base}envolio-passport.svg`} alt="" />
        </span>
        <span>ENVOLIO</span>
      </button>
      <button className="nav-link" onClick={() => go(base)}>
        New search <ArrowRight size={16} />
      </button>
    </nav>
  );
}
function Footer({ go }) {
  return (
    <footer>
      <button className="brand brand-button small" onClick={() => go(base)}>
        <span className="brand-mark">
          <img src={`${base}envolio-passport.svg`} alt="" />
        </span>
        <span>ENVOLIO</span>
      </button>
      <p>Flight intelligence, clearly delivered.</p>
      <span className="legal-attribution">
        Contains AeroAPI data © FlightAware LLC 2026.
      </span>
    </footer>
  );
}
function CarrierLogo({ flight }) {
  const iata = (
      flight.operator_iata ||
      flight.ident_iata?.toUpperCase().match(/^[A-Z0-9]{2}/)?.[0] ||
      ""
    ).toUpperCase(),
    name = flight.operator || iata;
  const [src, setSrc] = useState("play"),
    url =
      src === "play"
        ? `${base}api/airline-icon?name=${encodeURIComponent(name)}`
        : `https://images.kiwi.com/airlines/64/${iata}.png`;
  return (
    <div className="carrier-logo">
      {iata && src !== "text" ? (
        <img
          src={url}
          alt={`${name} app icon`}
          onError={() => setSrc(src === "play" ? "airline" : "text")}
        />
      ) : (
        <span>{iata || <Plane size={20} />}</span>
      )}
    </div>
  );
}
function SearchForm({go}) { return <FlightSearch go={go}/>; }
function ExampleFlights({ go }) {
  const tomorrow = localISO(new Date(Date.now() + 86400000)),
    examples = [
      {
        ident: "AA100",
        operator: "American Airlines",
        route: "JFK → LHR",
        origin: "JFK",
        date: today,
        note: "New York to London",
      },
      {
        ident: "SQ12",
        operator: "Singapore Airlines",
        route: "NRT → LAX",
        origin: "NRT",
        date: tomorrow,
        note: "Tokyo to Los Angeles",
      },
      {
        ident: "B61",
        operator: "JetBlue",
        route: "JFK → FLL",
        origin: "JFK",
        date: tomorrow,
        note: "New York to Fort Lauderdale",
      },
      {
        ident: "JL1",
        operator: "Japan Airlines",
        route: "SFO → HND",
        origin: "SFO",
        date: tomorrow,
        note: "San Francisco to Tokyo",
      },
    ];
  return (
    <section className="examples-section">
      <div className="section-heading">
        <div>
          <span>EXPLORE ENVOLIO</span>
          <h2>Try a live flight</h2>
        </div>
        <p>No flight number handy? Pick an example to see how it works.</p>
      </div>
      <div className="example-grid">
        {examples.map((item, index) => (
          <button
            className="example-flight"
            style={{ "--delay": `${index * 0.07}s` }}
            onClick={() => {
              go(
                `${base}flight/${item.ident}?date=${item.date}&origin=${item.origin}`,
              );
            }}
            key={item.ident}
          >
            <div className="example-flight-head">
              <CarrierLogo
                flight={{ operator: item.operator, ident_iata: item.ident }}
              />
              <span>{item.operator}</span>
              <strong>{item.ident}</strong>
            </div>
            <div className="example-route">
              <b>{item.route}</b>
              <small>{dateLabel(item.date)}</small>
            </div>
            <div className="example-foot">
              <span>{item.note}</span>
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
function ProductShowcase() {
  return (
    <section className="home-showcase" aria-label="Envolio product preview">
      <div className="showcase-heading">
        <span>EXAMPLE SCREEN · NOT LIVE FLIGHT DATA</span>
        <h2>Less guessing. A clearer next step.</h2>
        <p>
          Find your plane, check your times, and know what to watch before you fly.
        </p>
      </div>
      <div className="showcase-stage">
        <div className="showcase-route">
          <div className="showcase-top">
            <span>
              <i /> PLANE HAS ARRIVED
            </span>
            <small>Example: your plane is at the airport</small>
          </div>
          <div className="showcase-cities">
            <div>
              <b>JFK</b>
              <span>New York</span>
            </div>
            <div className="showcase-flightline">
              <i />
              <Plane size={18} />
              <small>AA100 · plane has arrived</small>
            </div>
            <div>
              <b>LHR</b>
              <span>London</span>
            </div>
          </div>
          <div className="showcase-events">
            <span>
              <Check size={12} /> Aircraft at gate
            </span>
            <span>
              <Bell size={12} /> Watch changes
            </span>
            <span>
              <Plane size={12} /> Plan your next step
            </span>
          </div>
        </div>
        <aside className="showcase-index">
          <div className="showcase-index-head">
            <span>POSSIBLE WAIT</span>
            <b>
              <TrendingDown size={14} /> EXAMPLE
            </b>
          </div>
          <div className="showcase-score">
            <strong>20</strong>
            <span>min</span>
            <small>Example only · check the airline’s latest time</small>
          </div>
          <svg
            viewBox="0 0 300 92"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="homeChart" x1="0" x2="1">
                <stop stopColor="#6f94de" />
                <stop offset="1" stopColor="#42dda9" />
              </linearGradient>
            </defs>
            <path d="M2 70 C42 66,55 43,91 50 S145 35,180 46 S231 30,298 24" />
            <path
              className="showcase-fill"
              d="M2 70 C42 66,55 43,91 50 S145 35,180 46 S231 30,298 24 L298 92 L2 92 Z"
            />
          </svg>
          <div className="showcase-factors">
            <span>
              <i style={{ width: "31%" }} />
              Past flights
            </span>
            <span>
              <i style={{ width: "18%" }} />
              Your plane’s previous flight
            </span>
            <span>
              <i style={{ width: "22%" }} />
              Airport + weather
            </span>
          </div>
          <p>
            <ShieldCheck size={13} /> Example only. Your own result will use available flight updates.
          </p>
        </aside>
      </div>
    </section>
  );
}
function ProductPaths({ go }) {
  return (
    <section className="product-paths">
      <button onClick={() => go(`${base}dashboard`)}>
        <Star />
        <span>
          Frequent-flyer dashboard<em>Available now</em>
          <b>Keep favorite flights and upcoming trips together.</b>
        </span>
        <ArrowRight />
      </button>
      <button onClick={() => go(`${base}premium`)}>
        <ShieldCheck />
        <span>
          Confidence reports<em>Preview</em>
          <b>Explore deeper validation before premium plans launch.</b>
        </span>
        <ArrowRight />
      </button>
      <button onClick={() => go(`${base}developers`)}>
        <Database />
        <span>
          Envolio API<em>In development</em>
          <b>Preview the data principles shaping future access.</b>
        </span>
        <ArrowRight />
      </button>
      <div className="seo-links">
        <span>Popular intelligence pages</span>
        <button onClick={() => go(`${base}routes/JFK-LHR`)}>JFK → LHR</button>
        <button onClick={() => go(`${base}routes/SFO-HND`)}>SFO → HND</button>
        <button onClick={() => go(`${base}airports/JFK/delays`)}>
          JFK delays
        </button>
        <button onClick={() => go(`${base}airports/LHR/delays`)}>
          LHR delays
        </button>
      </div>
    </section>
  );
}
function Home({ go, saved, remove }) {
  return (
    <>
      <Header go={go} />
      <main className="home-page">
        <section className="hero is-visible">
          <img
            className="hero-brand-art"
            src={`${base}envolio-passport.svg`}
            alt=""
            aria-hidden="true"
          />
          <p className="home-kicker">
            <span className="home-kicker-dot" aria-hidden="true" />
            <span>FLIGHT UPDATES, MADE SIMPLE</span>
          </p>
          <h1>
            We know if you’re delayed{" "}
            <br />
            <em>before the airline does.</em>
          </h1>
          <p className="intro">
            Your flight. What’s changed. What to do next.
          </p>
          <SearchForm go={go} />
        </section>
        <ExampleFlights go={go} />
        <section className="first-trip-guide" aria-labelledby="first-trip-title"><div><span className="traveler-kicker">New here?</span><h2 id="first-trip-title">Start with one flight.</h2><p>No travel experience needed. We’ll help you understand what’s happening.</p></div><ol><li><b>1. Find your flight</b><p>Enter its number and departure date, or try an example above.</p></li><li><b>2. Check what changed</b><p>See the latest departure time, gate and any reported problems.</p></li><li><b>3. Know your next step</b><p>Get practical advice. If plans change, you can look at other flights.</p></li></ol><p className="first-trip-note">Always follow your airline’s check-in and boarding times. A delay estimate is not a reason to arrive at the airport later.</p></section>
        <ProductShowcase />
        <AirportExplorer />
        <section className="saved-section">
          <div className="section-heading">
            <div>
              <span>YOUR JOURNEYS</span>
              <h2>Favorite flights</h2>
            </div>
            <p>Saved privately in this browser.</p>
          </div>
          {saved.length ? (
            <div className="saved-grid">
              {saved.map((i) => (
                <article className="saved-card" key={i.key}>
                  <button
                    className="saved-main"
                    onClick={() =>
                      go(
                        `${base}flight/${i.ident}?date=${i.date}${code(i.origin) !== "—" ? `&origin=${code(i.origin)}` : ""}`,
                      )
                    }
                  >
                    <span className="saved-ident">
                      <Star size={13} fill="currentColor" /> {i.ident}
                    </span>
                    <span>
                      {code(i.origin)} <ArrowRight size={13} />{" "}
                      {code(i.destination)}
                    </span>
                    <time>{dateLabel(i.date)}</time>
                  </button>
                  <button
                    className="remove-save"
                    onClick={() => remove(i.key)}
                    aria-label={`Remove ${i.ident}`}
                  >
                    <X size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-saved">
              <Star size={21} />
              <div>
                <b>Your watchlist starts here</b>
                <p>
                  Open any example flight and select “Favorite” to keep it one
                  click away.
                </p>
              </div>
            </div>
          )}
        </section>
        <ProductPaths go={go} />
        <section className="product-notes">
          <div>
            <Database />
            <b>Your flight, in one place</b>
            <p>
              See your flight’s latest times and airport details, when they are available.
            </p>
          </div>
          <div>
            <Cloud />
            <b>Why it might be late</b>
            <p>
              We check weather, airport problems and whether your plane is running late from its previous flight.
            </p>
          </div>
          <div>
            <ShieldCheck />
            <b>We tell you what we know</b>
            <p>
              See where an update came from. If information is missing or sources disagree, we’ll say so.
            </p>
          </div>
        </section>
      </main>
      <Footer go={go} />
    </>
  );
}
function ExplorePage({ route, go, saved, remove }) {
  const isRoute = route.page === "route-landing",
    title = isRoute
      ? `${route.origin} to ${route.destination} flight tracker`
      : `${route.airport} airport delay forecast`,
    subtitle = isRoute
      ? "Search a specific flight to see live status, inbound aircraft, weather, and historically validated disruption risk."
      : "Check a departing flight for live airport conditions, delay programs, weather, and its route-specific Delay Index.";
  if (route.page === "dashboard")
    return (
      <>
        <Header go={go} />
        <main className="explore-page saved-page saved-section">
          <h1>Saved flights</h1>
          <p>
            {saved.length
              ? `${saved.length} favorite flight${saved.length === 1 ? "" : "s"} saved in this browser.`
              : "No saved flights yet. Find a flight and tap Favorite to keep it here."}
          </p>
          <div className="saved-grid">{saved.map(item=><article className="saved-card" key={item.key}>
            <button className="saved-main" onClick={()=>go(journeyUrl(item,base))}>
              <span className="saved-ident">{item.ident}</span>
              <span>{code(item.origin)} → {code(item.destination)}</span><time>{dateLabel(item.date)}</time>
            </button>
            <button className="remove-save" aria-label={`Remove ${item.ident}`} onClick={()=>remove(item.key)}><X size={18}/></button>
          </article>)}</div>
          <button className="primary" onClick={()=>go(base)}>Find a flight</button>
          <p>Saved on this device. Open a flight to check for the latest updates.</p>
        </main>
        <Footer go={go} />
      </>
    );
  if (route.page === "premium" || route.page === "developers")
    return (
      <>
        <Header go={go} />
        <main className="explore-page">
          <span>
            {route.page === "premium"
              ? "CONFIDENCE REPORTS · PREVIEW"
              : "ENVOLIO API · IN DEVELOPMENT"}
          </span>
          <h1>
            {route.page === "premium"
              ? "More evidence for important journeys."
              : "Flight intelligence built for careful integration."}
          </h1>
          <p>
            {route.page === "premium"
              ? "Preview the confidence bands, validation history, and source receipts already included in every live result. Plans and payment are not available yet."
              : "Public API access is not open yet. We are hardening freshness, provenance, rate limits, and stable schemas before inviting integrations."}
          </p>
          <button className="primary" onClick={() => go(base)}>
            {route.page === "premium"
              ? "View a live report"
              : "Explore the live product"}{" "}
            <ArrowRight />
          </button>
        </main>
        <Footer go={go} />
      </>
    );
  return (
    <>
      <Header go={go} />
      <main className="explore-page">
        <span>{isRoute ? "ROUTE INTELLIGENCE" : "AIRPORT INTELLIGENCE"}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <SearchForm go={go} />
        <section className="landing-trust">
          <b>Real operational data</b>
          <span>
            No generic forecast is fabricated. Enter a flight number to
            calculate an outlook from currently available sources.
          </span>
        </section>
      </main>
      <Footer go={go} />
    </>
  );
}
function Loading({ ident, date }) {
  return (
    <main
      className="detail-shell loading-state"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-label">
        <span className="spinner" />
        <span>
          <b>Loading {ident || "flight details"}</b>
          <small>
            {date ? `${dateLabel(date)} · ` : ""}Checking status, aircraft,
            airports, and weather. This can take a few seconds.
          </small>
        </span>
      </div>
      <div className="skeleton hero-skeleton" aria-hidden="true" />
      <div className="skeleton grid-skeleton" aria-hidden="true" />
    </main>
  );
}
function Failure({ message, retry, go, diagnostics }) {
  const current=new URLSearchParams(location.search),ident=location.pathname.split('/flight/')[1]?.split('/')[0]||'';
  const editQuery=new URLSearchParams({q:decodeURIComponent(ident),date:current.get('date')||today,origin:current.get('origin')||'',destination:current.get('destination')||''});
  return (
    <main className="detail-shell">
      <div className="error-panel" role="alert">
        <span>FLIGHT DETAILS UNAVAILABLE</span>
        <h1>We couldn’t load this flight.</h1>
        <p>{message}</p>
        <aside>
          We haven’t guessed your flight status. Try again, or check the flight number,
          departure airport and date shown on your booking.
        </aside>
        <div>
          <button className="primary" onClick={retry}>
            <RefreshCw size={16} /> Try again
          </button>
          <button className="secondary" onClick={() => go(`${base}?${editQuery}`)}>
            Edit search
          </button>
        </div>
      </div>
      <LookupDiagnostics data={diagnostics} go={go} />
    </main>
  );
}
function Gauge({ score }) {
  return (
    <div className="risk-gauge">
      <svg viewBox="0 0 200 116">
        <defs>
          <linearGradient id="riskGradient">
            <stop offset="0" stopColor="#20e29a" />
            <stop offset=".52" stopColor="#ffc857" />
            <stop offset="1" stopColor="#ff5978" />
          </linearGradient>
        </defs>
        <path
          className="gauge-track"
          d="M22 100a78 78 0 0 1 156 0"
          pathLength="100"
        />
        <path
          className="gauge-value"
          d="M22 100a78 78 0 0 1 156 0"
          pathLength="100"
          style={{ strokeDasharray: `${score} 100` }}
        />
      </svg>
      <div>
        <strong>{score}</strong>
        <span>RISK SCORE</span>
      </div>
    </div>
  );
}
function Trend({ points = [], meta = {} }) {
  const source = `${meta.source || "FlightAware AeroAPI"} · ${meta.lookback_days || "available"}-day lookback`;
  if (points.length < 2) {
    let note = meta.limitation || "";
    if (!note)
      note =
        points.length === 1
          ? "FlightAware returned one completed departure matching this flight number and exact route. Two are required to compare performance."
          : `FlightAware returned ${meta.records_returned || 0} historical records, but none had completed departure timing for this exact origin–destination service.`;
    return (
      <div className="trend-chart chart-empty">
        <div className="chart-title">
          <span>Recent departure delays</span>
          <b>{source}</b>
        </div>
        <p>{note}</p>
      </div>
    );
  }
  const rawMax =
      Math.ceil(Math.max(60, ...points.map((p) => p.minutes)) / 60) * 60,
    max = Math.min(360, rawMax),
    axis = (m) =>
      m >= 60
        ? (m / 60) % 1
          ? `${(m / 60).toFixed(1)}h`
          : `${m / 60}h`
        : `${m}m`,
    delayText = (m) =>
      m === 0
        ? "On time"
        : m >= 60
          ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m ` : ""}late`
          : `${m} min late`;
  return (
    <div className="trend-chart bar-trend">
      <div className="chart-title">
        <span>Recent departure delays</span>
        <b>{points.length} comparable flights</b>
      </div>
      <div className="bar-legend">
        <span>
          <i className="good" /> Under 15 min
        </span>
        <span>
          <i className="late" /> 15+ min late
        </span>
      </div>
      <div className="departure-chart">
        <div className="y-labels">
          <span>{axis(max)}</span>
          <span>{axis(max / 2)}</span>
          <span>0h</span>
        </div>
        <div className="bar-plot">
          <div className="threshold" style={{ bottom: `${(15 / max) * 100}%` }}>
            <span>15 min threshold</span>
          </div>
          {points.map((p, i) => {
            const capped = p.minutes > max,
              height = Math.max(3, Math.min(100, (p.minutes / max) * 100));
            return (
              <div className="bar-column" key={`${p.date}-${i}`}>
                <span
                  className={`delay-bar ${p.minutes >= 15 ? "late" : "good"}${capped ? " capped" : ""}`}
                  style={{ height: `${height}%` }}
                />
                {capped && <em className="bar-overflow">{axis(p.minutes)}</em>}
                <span
                  className="bar-tooltip"
                  style={{ bottom: `calc(${Math.min(92, height)}% + 10px)` }}
                >
                  <b>
                    {new Date(p.date).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </b>
                  <small>{delayText(p.minutes)}</small>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chart-source">
        {source}
        {rawMax > max ? " · chart capped at 6h for readability" : ""}
      </div>
      {meta.limitation && <p className="chart-notice">{meta.limitation}</p>}
    </div>
  );
}
function DelayPanel({ index }) {
  if (!index)
    return (
      <section className="data-panel unavailable">
        <span>Delay outlook</span>
        <h3>There isn’t enough current data to calculate an outlook.</h3>
        <p>
          FlightAware did not return the supporting history or operational
          conditions needed for this flight.
        </p>
      </section>
    );
  const label =
    index.level === "high"
      ? "High disruption risk"
      : index.level === "elevated"
        ? "Some disruption risk"
        : "Low disruption risk";
  const summary =
    index.level === "high"
      ? "Build extra time into your plans and check with the airline before leaving."
      : index.level === "elevated"
        ? "This flight has a few signals worth watching before departure."
        : "Current signals suggest this flight is likely to operate close to schedule.";
  return (
    <section className={`delay-index simple-index ${index.level}`}>
      <div className="simple-head">
        <div>
          <span className="index-kicker">Envolio delay outlook</span>
          <h3>{label}</h3>
          <p>{summary}</p>
        </div>
        <div className="simple-score">
          <strong>{index.score}</strong>
          <span>out of 100</span>
        </div>
      </div>
      <div className="confidence-line">
        <span>
          Validation: <b>{index.signal_label || "Calibrating"}</b>
        </span>
        <p>This is an estimate. Higher scores mean more signs of potential delay.</p>
      </div>
      <div className="simple-body">
        <section className="simple-factors">
          <h4>What’s influencing this outlook</h4>
          {index.factors.map((f) => (
            <div className="factor-row" key={f.label}>
              <div className="factor-copy">
                <b>{f.label}</b>
                <p>{f.detail}</p>
              </div>
              <div className="factor-reading">
                <strong>{f.value ?? "—"}</strong>
                {f.value !== null && <span>/100</span>}
              </div>
              <div className="factor-bar">
                <i style={{ width: `${f.value ?? 0}%` }} />
              </div>
            </div>
          ))}
        </section>
        <section className="simple-history">
          <h4>How this flight has performed recently</h4>
          <Trend points={index.trend_points} meta={index.trend_meta} />
        </section>
      </div>
      <p className="simple-disclaimer">
        This is a Envolio estimate based on FlightAware history, airport
        conditions, weather observations, and current schedule information. It
        is not a guarantee.
      </p>
    </section>
  );
}
function InboundAircraft({ flight, current }) {
  if (flight === undefined)
    return (
      <section className="inbound-panel unavailable">
        <div>
          <span>Inbound aircraft</span>
          <h3>No inbound aircraft has been assigned yet.</h3>
          <p>
            FlightAware has not published an aircraft rotation for this
            departure. Check again closer to departure.
          </p>
        </div>
      </section>
    );
  if (!flight)
    return (
      <section className="inbound-panel unavailable">
        <div>
          <span>Inbound aircraft</span>
          <h3>Inbound details are temporarily unavailable.</h3>
          <p>
            An inbound flight was identified, but FlightAware did not return its
            current operating details.
          </p>
        </div>
      </section>
    );
  const phase = flightPhase(flight),
    arrival = flight.actual_in || flight.estimated_in || flight.scheduled_in,
    scheduled = flight.scheduled_in,
    variance =
      arrival && scheduled
        ? Math.round((new Date(arrival) - new Date(scheduled)) / 60000)
        : null,
    atOrigin = code(flight.destination) === code(current.origin),
    headline =
      phase === "landed"
        ? atOrigin
          ? `Aircraft arrived at ${code(current.origin)}`
          : "Previous flight has arrived"
        : phase === "inflight"
          ? `Inbound aircraft is en route to ${code(current.origin)}`
          : "Inbound flight is scheduled",
    tone =
      phase === "landed" && variance <= 15
        ? "positive"
        : variance > 15
          ? "negative"
          : "neutral";
  return (
    <section className={`inbound-panel ${tone}`}>
      <div className="inbound-head">
        <div>
          <span>Inbound aircraft</span>
          <h3>{headline}</h3>
          <p>
            {flight.ident_iata || flight.ident} · {code(flight.origin)} to{" "}
            {code(flight.destination)}
          </p>
        </div>
        <div className="inbound-state">
          {phase === "landed"
            ? "ARRIVED"
            : phase === "inflight"
              ? `${flight.progress_percent || 0}% COMPLETE`
              : "SCHEDULED"}
        </div>
      </div>
      <div className="inbound-times">
        <div>
          <span>Expected at {code(flight.destination)}</span>
          <b>{clock(arrival, flight.destination?.timezone)}</b>
          <small>
            {variance === null
              ? "Schedule variance unavailable"
              : variance > 0
                ? `${variance} min after schedule`
                : variance < 0
                  ? `${Math.abs(variance)} min ahead of schedule`
                  : "On schedule"}
          </small>
        </div>
        <div>
          <span>Aircraft</span>
          <b>{flight.registration || current.registration || "Not assigned"}</b>
          <small>
            {flight.aircraft_type ||
              current.aircraft_type ||
              "Type not reported"}
          </small>
        </div>
        <div>
          <span>Inbound status</span>
          <b>{flight.status || "Not reported"}</b>
          <small>Live operational data from FlightAware</small>
        </div>
      </div>
    </section>
  );
}
function ChangeAwareValue({ label, value, flightKey }) {
  const storageKey = `contrail.assignment.${flightKey}.${label}`,
    [previous] = useState(() => localStorage.getItem(storageKey));
  useEffect(() => {
    if (value) localStorage.setItem(storageKey, String(value));
  }, [storageKey, value]);
  const changed = previous && value && previous !== String(value);
  return (
    <div className={changed ? "assignment-changed" : ""}>
      <span>
        {label}
        {changed && <em>Changed</em>}
      </span>
      <b>{shown(value)}</b>
      {changed && <small>Previously {previous}</small>}
    </div>
  );
}
function inboundSignal(f, current) {
  if (!f) return { label: "Scheduled", tone: "neutral" };
  const phase = flightPhase(f),
    arrival = new Date(
      f.actual_in || f.estimated_in || f.scheduled_in || 0,
    ).getTime(),
    scheduled = new Date(f.scheduled_in || 0).getTime(),
    depart = new Date(
      current.estimated_out || current.scheduled_out || 0,
    ).getTime(),
    now = Date.now();
  if (phase === "landed")
    return depart - now <= 60 * 60e3 && depart > now
      ? { label: "Boarding soon", tone: "positive" }
      : { label: "Aircraft arrived", tone: "positive" };
  if (arrival - scheduled > 15 * 60e3 || arrival > depart - 45 * 60e3)
    return { label: "Inbound late", tone: "negative" };
  return { label: "Plane inbound", tone: "neutral" };
}
function PlaneNow({ flight, position, current, refreshed }) {
  if (!flight) return null;
  const phase = flightPhase(flight),
    progress =
      phase === "landed"
        ? 100
        : Math.max(6, Math.min(94, flight.progress_percent || 0)),
    arrival = flight.actual_in || flight.estimated_in || flight.scheduled_in,
    variance =
      arrival && flight.scheduled_in
        ? Math.round(
            (new Date(arrival) - new Date(flight.scheduled_in)) / 60000,
          )
        : null,
    risk =
      flight.actual_in
        ? "Aircraft at the gate"
        : variance > 15
          ? "Incoming aircraft running late"
          : variance !== null
            ? "On track"
            : "Monitoring";
  return (
    <section className="plane-now">
      <div className="plane-now-copy">
        <span>Where is my plane now?</span>
        <h3>
          {phase === "landed"
            ? `At ${code(current.origin)}`
            : phase === "inflight"
              ? `Flying from ${code(flight.origin)}`
              : `Preparing at ${code(flight.origin)}`}
        </h3>
        <p>
          Your assigned plane’s previous flight is {flight.ident_iata || flight.ident}. An aircraft swap is still possible.
        </p>
        <div
          className={`connection-risk ${variance > 15 ? "negative" : "positive"}`}
        >
          {risk}
        </div>
      </div>
      <div className="mini-map">
        <div className="map-grid" />
        <div className="map-particles" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--particle": i }} />
          ))}
        </div>
        <div className="airport-pulse origin" />
        <div className="airport-pulse destination" />
        <div className="map-route">
          <i style={{ width: `${progress}%` }} />
          <Plane size={17} style={{ left: `${progress}%` }} />
        </div>
        <div className="map-codes">
          <b>{code(flight.origin)}</b>
          <b>{code(flight.destination)}</b>
        </div>
        {position && (
          <small>
            {position.latitude.toFixed(2)}°, {position.longitude.toFixed(2)}° ·{" "}
            {Number(position.altitude * 100).toLocaleString()} ft
          </small>
        )}
      </div>
      <div className="now-meta">
        <span>
          {phase === "landed"
            ? "Arrived"
            : `Expected ${clock(arrival, flight.destination?.timezone)}`}
        </span>
        <span>Updated {clock(position?.timestamp || refreshed)}</span>
      </div>
    </section>
  );
}
function TurnTimeline({ flight, inbound }) {
  const depart = flight.estimated_out || flight.scheduled_out,
    boarding = depart
      ? new Date(new Date(depart).getTime() - 45 * 60e3).toISOString()
      : null,
    arrival =
      inbound &&
      (inbound.actual_in || inbound.estimated_in || inbound.scheduled_in),
    arrived = !!inbound?.actual_in,
    now = Date.now(),
    start = arrival ? new Date(arrival).getTime() : now - 60 * 60e3,
    end = depart ? new Date(depart).getTime() : now + 60 * 60e3,
    timelineProgress = Math.max(
      3,
      Math.min(97, ((now - start) / Math.max(1, end - start)) * 100),
    );
  const steps = [
    [
      "Inbound arrival",
      arrival,
      arrived
        ? "Complete"
        : arrival && new Date(arrival) < now
          ? "Due"
          : "Expected",
    ],
    [
      "Cleaning & turnaround",
      arrival,
      arrived ? "Preparation time—not live-tracked" : "After gate arrival",
    ],
    [
      "Boarding",
      boarding,
      /boarding/i.test(flight.status || '') ? "Boarding reported" : "Planning estimate—check airline",
    ],
    ["Departure", depart, flight.actual_out ? "Departed" : "Scheduled"],
  ];
  return (
    <section className="turn-timeline">
      <div className="timeline-title">
        <span>Departure sequence</span>
        <small>
          Boarding is shown as a planning estimate, 45 minutes before departure.
        </small>
      </div>
      <div className="timeline-flight-track" aria-hidden="true">
        <i style={{ width: `${timelineProgress}%` }} />
        <Plane size={15} style={{ left: `${timelineProgress}%` }} />
      </div>
      <div className="timeline-steps">
        {steps.map(([label, time, state], i) => (
          <div className={i === 0 && arrived ? "done" : ""} key={label}>
            <i />
            <span>{label}</span>
            <b>{clock(time, flight.origin?.timezone)}</b>
            <small>{state}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
function LiveOperations({ flight, position, refreshed }) {
  const phase = flightPhase(flight),
    arrival = flight.actual_in || flight.estimated_in || flight.scheduled_in;
  return (
    <section className="live-ops">
      <div className="live-ops-head">
        <div>
          <span>
            {phase === "landed" ? "Arrival details" : "Live operations"}
          </span>
          <h3>
            {phase === "landed"
              ? `Arrived at ${code(flight.destination)}`
              : `En route to ${code(flight.destination)}`}
          </h3>
        </div>
        <small>Updated {clock(position?.timestamp || refreshed)}</small>
      </div>
      <div className="live-ops-grid">
        {phase === "inflight" && (
          <>
            <div>
              <span>Position</span>
              <b>
                {position
                  ? `${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°`
                  : "Position unavailable"}
              </b>
            </div>
            <div>
              <span>Altitude</span>
              <b>
                {position
                  ? `${Number(position.altitude * 100).toLocaleString()} ft`
                  : "Not reported"}
              </b>
            </div>
            <div>
              <span>Ground speed</span>
              <b>{position ? `${position.groundspeed} kt` : "Not reported"}</b>
            </div>
          </>
        )}
        <div>
          <span>{phase === "landed" ? "Arrived" : "Estimated arrival"}</span>
          <b>{clock(arrival, flight.destination?.timezone)}</b>
        </div>
        {phase === "landed" && (
          <>
            <div>
              <span>Arrival gate</span>
              <b>{shown(flight.gate_destination)}</b>
            </div>
            <div>
              <span>Baggage claim</span>
              <b>{shown(flight.baggage_claim)}</b>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
const alertOptions = [
  [
    "inbound",
    "Inbound aircraft arrival",
    "Know when the operating aircraft reaches your airport.",
  ],
  [
    "gate",
    "Gate or terminal changes",
    "Highlight assignment changes as soon as refreshed.",
  ],
  [
    "boarding",
    "Boarding reminders",
    "Get a reminder near the estimated boarding window.",
  ],
  [
    "delay",
    "Delay updates",
    "Watch departure and arrival estimates for disruption.",
  ],
  [
    "probability",
    "Material risk changes",
    "Alert when the Delay Index moves by 5 or more points, with the strongest reason.",
  ],
  ["landing", "Landing", "Know when the flight arrives."],
  ["baggage", "Baggage claim", "Alert when FlightAware publishes a carousel."],
];
function assignmentChanges(f, ident, date) {
  return [
    ["Departure terminal", f.terminal_origin],
    ["Departure gate", f.gate_origin],
    ["Arrival terminal", f.terminal_destination],
    ["Arrival gate", f.gate_destination],
  ].flatMap(([label, value]) => {
    const previous = localStorage.getItem(
      `contrail.assignment.${ident}.${date}.${label}`,
    );
    return previous && value && previous !== String(value)
      ? [{ label, previous, current: String(value) }]
      : [];
  });
}
function DisruptionAdvice({ flight, inbound, changes }) {
  const depart = new Date(
      flight.estimated_out || flight.scheduled_out || 0,
    ).getTime(),
    arrival = inbound
      ? new Date(
          inbound.actual_in ||
            inbound.estimated_in ||
            inbound.scheduled_in ||
            0,
        ).getTime()
      : 0,
    scheduled = inbound ? new Date(inbound.scheduled_in || 0).getTime() : 0,
    inboundDelayed =
      inbound &&
      (/delay/i.test(inbound.status || "") || arrival - scheduled > 15 * 60e3),
    tight = inboundDelayed && arrival > depart - 60 * 60e3;
  let title = "",
    copy = "",
    action = "",
    tone = "warning";
  if (changes.length) {
    title = "Gate or terminal changed";
    copy = changes
      .map((item) => `${item.label}: ${item.previous} → ${item.current}`)
      .join(" · ");
    action = "Check airport screens and stay near the new gate.";
  } else if (tight) {
    title = "Connection risk";
    copy =
      "The inbound aircraft is expected close to this flight’s departure window.";
    action = "Stay near the gate and prepare for boarding to move.";
    tone = "danger";
  } else if (inboundDelayed) {
    title = "Boarding likely delayed";
    copy = "The operating aircraft is running behind its inbound schedule.";
    action =
      "Stay near the gate; the airline may adjust boarding at short notice.";
  }
  if (!title) return null;
  return (
    <section className={`disruption-advice ${tone}`}>
      <div>
        <span>Recommended action</span>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      <strong>{action}</strong>
    </section>
  );
}
function DeliverySignup({ flightKey, prefs }) {
  const [channel, setChannel] = useState("email"),
    [contact, setContact] = useState(""),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(false),
    [flight, date] = flightKey.split(".");
  const submit = async () => {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`${base}api/alerts/subscribe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channel,
            contact,
            flight,
            date,
            events: Object.keys(prefs).filter((key) => prefs[key]),
          }),
        }),
        data = await response.json();
      setMessage(
        response.ok
          ? `${channel === "email" ? "Email" : "SMS"} alerts activated through ${data.provider}.`
          : data.error || "Delivery is not available yet.",
      );
    } catch {
      setMessage("Delivery is not available yet.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="delivery-signup">
      <div>
        <b>
          Email or SMS <em>Provider preview</em>
        </b>
        <p>
          Background delivery activates only when a delivery provider is
          configured. On-device alerts above are available now.
        </p>
      </div>
      <div className="delivery-controls">
        <select
          value={channel}
          onChange={(event) => {
            setChannel(event.target.value);
            setMessage("");
          }}
        >
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder={channel === "email" ? "you@example.com" : "+14155550123"}
          aria-label={channel === "email" ? "Email address" : "Mobile number"}
        />
        <button onClick={submit} disabled={working || !contact}>
          {working ? "Checking" : "Check availability"}
        </button>
      </div>
      {message && <small>{message}</small>}
    </section>
  );
}
function AlertSettings({ open, onClose, flightKey, flightLabel }) {
  const sheet=useRef(null),closeAction=useRef(onClose);
  closeAction.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusables=()=>[...sheet.current.querySelectorAll('button,input,a[href],[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length);
    focusables()[0]?.focus();
    const keyboard=e=>{
      if(e.key==='Escape'){e.preventDefault();closeAction.current();}
      if(e.key==='Tab'){const items=focusables(),first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!sheet.current.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!sheet.current.contains(document.activeElement))){e.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.removeEventListener('keydown',keyboard);document.body.style.overflow=overflow;previous?.focus();};
  },[open]);
  const key = `contrail.alerts.${flightKey}`,
    [prefs, setPrefs] = useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem(key)) || {
            inbound: true,
            gate: true,
            boarding: true,
            delay: true,
            probability: true,
            landing: false,
            baggage: false,
          }
        );
      } catch {
        return {
          inbound: true,
          gate: true,
          boarding: true,
          delay: true,
          probability: true,
          landing: false,
          baggage: false,
        };
      }
    }),
    [permission, setPermission] = useState(
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    );
  useEffect(() => {
    try{localStorage.setItem(key, JSON.stringify(prefs));}catch{/* Preferences remain usable for this visit. */}
  }, [key, prefs]);
  if (!open) return null;
  const request = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };
  return (
    <div
      className="alert-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={sheet}
        className="alert-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-title"
      >
        <div className="alert-sheet-head">
          <div>
            <span>Flight watch settings</span>
            <h2 id="alerts-title">Watch {flightLabel}</h2>
            <p>
              Choose which changes matter. Preferences and on-device alerts work
              now; background delivery is clearly labeled below.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close notification settings">
            <X size={19} />
          </button>
        </div>
        <div className="alert-options">
          {alertOptions.map(([id, label, description]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={!!prefs[id]}
                onChange={() =>
                  setPrefs((current) => ({ ...current, [id]: !current[id] }))
                }
              />
              <i>{prefs[id] && <Check size={13} />}</i>
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="browser-alerts">
          <div>
            <b>On-device alerts</b>
            <p>
              {permission === "granted"
                ? "Enabled on this device."
                : permission === "denied"
                  ? "Blocked in browser settings."
                  : "Allow Envolio to display selected updates while this app is open."}
            </p>
          </div>
          {permission === "default" && (
            <button onClick={request}>Enable</button>
          )}
        </div>
        <DeliverySignup flightKey={flightKey} prefs={prefs} />
        <div className="alert-sheet-foot">
          <p>Your watch settings are saved privately in this browser.</p>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
function AlertEmitter({ flight, inbound, index, flightKey }) {
  useEffect(() => {
    const prefsKey = `contrail.alerts.${flightKey}`,
      stateKey = `contrail.alertstate.${flightKey}`;
    let prefs, previous;
    try {
      prefs = JSON.parse(localStorage.getItem(prefsKey) || "null") || {
        inbound: true,
        gate: true,
        boarding: true,
        delay: true,
        probability: true,
        landing: false,
        baggage: false,
      };
      previous = JSON.parse(localStorage.getItem(stateKey) || "null");
    } catch {
      prefs = {};
      previous = null;
    }
    const depart = flight.estimated_out || flight.scheduled_out,
      snapshot = {
        gate_origin: flight.gate_origin || null,
        terminal_origin: flight.terminal_origin || null,
        estimated_out: flight.estimated_out || null,
        phase: flightPhase(flight),
        baggage: flight.baggage_claim || null,
        inboundPhase: inbound ? flightPhase(inbound) : null,
        boarding: depart
          ? Date.now() >= new Date(depart).getTime() - 45 * 60e3
          : false,
        probability: index?.score ?? null,
        probabilityReason: index?.movement?.drivers?.[0]?.label || null,
      };
    localStorage.setItem(stateKey, JSON.stringify(snapshot));
    if (
      !previous ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const events = [];
    if (
      prefs.gate &&
      (previous.gate_origin !== snapshot.gate_origin ||
        previous.terminal_origin !== snapshot.terminal_origin)
    )
      events.push([
        "Gate assignment changed",
        `Now ${snapshot.terminal_origin ? `Terminal ${snapshot.terminal_origin}, ` : ""}${snapshot.gate_origin ? `Gate ${snapshot.gate_origin}` : "check airport screens"}.`,
      ]);
    if (
      prefs.inbound &&
      previous.inboundPhase !== "landed" &&
      snapshot.inboundPhase === "landed"
    )
      events.push([
        "Aircraft arrived",
        "The inbound aircraft has reached the departure airport.",
      ]);
    if (prefs.boarding && !previous.boarding && snapshot.boarding)
      events.push([
        "Boarding soon",
        "Stay near the gate and watch the airline display.",
      ]);
    if (
      prefs.delay &&
      previous.estimated_out &&
      snapshot.estimated_out &&
      Math.abs(
        new Date(snapshot.estimated_out) - new Date(previous.estimated_out),
      ) >=
        5 * 60e3
    )
      events.push([
        "Departure time updated",
        `The latest estimate is ${clock(snapshot.estimated_out, flight.origin?.timezone)}.`,
      ]);
    if (
      prefs.probability &&
      Number.isFinite(previous.probability) &&
      Number.isFinite(snapshot.probability) &&
      Math.abs(snapshot.probability - previous.probability) >= 5
    ) {
      const change = snapshot.probability - previous.probability,
        reason = snapshot.probabilityReason
          ? ` Main reason: ${snapshot.probabilityReason}.`
          : "";
      events.push([
        `Delay risk ${change > 0 ? "increased" : "decreased"} to ${snapshot.probability}%`,
        `${Math.abs(change)} point change since your last refresh.${reason}`,
      ]);
    }
    if (
      prefs.landing &&
      previous.phase !== "landed" &&
      snapshot.phase === "landed"
    )
      events.push([
        "Flight landed",
        `${flight.ident_iata || flight.ident} has arrived at ${code(flight.destination)}.`,
      ]);
    if (prefs.baggage && !previous.baggage && snapshot.baggage)
      events.push([
        "Baggage claim assigned",
        `Collect bags at ${snapshot.baggage}.`,
      ]);
    events
      .slice(0, 2)
      .forEach(
        ([title, body]) =>
          new Notification(title, {
            body,
            tag: `contrail-${flightKey}-${title}`,
          }),
      );
  }, [flight, inbound, index, flightKey]);
  return null;
}
function RouteChoices({ options, current, ident, date, go }) {
  const unique = options.filter(
    (option, index, list) =>
      list.findIndex(
        (item) =>
          code(item.origin) === code(option.origin) &&
          code(item.destination) === code(option.destination),
      ) === index,
  );
  if (unique.length < 2) return null;
  return (
    <section className="route-choices">
      <span>This flight number has multiple legs</span>
      <div>
        {unique.map((option) => (
          <button
            className={
              code(option.origin) === code(current.origin) ? "active" : ""
            }
            onClick={() =>
              go(
                `${base}flight/${ident}?date=${date}&origin=${code(option.origin)}`,
              )
            }
            key={`${code(option.origin)}-${code(option.destination)}`}
          >
            <b>
              {code(option.origin)} → {code(option.destination)}
            </b>
            <small>
              {clock(option.scheduled_out, option.origin?.timezone)}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
function LookupDiagnostics({ data, go }) {
  const [reported, setReported] = useState(false);
  if (!data) return null;
  const routes = data.matched_routes || [],
    fresh = data.freshness,
    confidence = data.match_confidence,
    identifierNote =
      data.resolved_ident && data.resolved_ident !== data.requested_ident
        ? `Resolved to ${data.resolved_ident}`
        : data.identifiers_tried?.length > 1
          ? "Alternate identifiers exhausted"
          : "No alternate identifier needed",
    choose = (alternate) =>
      go?.(
        `${base}flight/${alternate}?date=${data.requested_date}${data.requested_origin ? `&origin=${data.requested_origin.split(",")[0].trim()}` : ""}`,
      ),
    report = async () => {
      await fetch(`${base}api/telemetry/lookup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "wrong_match",
          ident: data.requested_ident,
          reason: data.match_type || "unknown",
          route_hint: data.requested_origin || "",
        }),
      }).catch(() => {});
      setReported(true);
    };
  return (
    <details className="lookup-diagnostics">
      <summary>
        <span>Lookup diagnostics</span>
        <b>
          {confidence
            ? `${confidence.score}% match · ${data.match_type}`
            : data.match_type
              ? `${data.match_type} match`
              : "Why wasn’t this flight found?"}
        </b>
      </summary>
      {confidence && (
        <div className="match-confidence">
          <strong>{confidence.score}</strong>
          <div>
            <span>Why this match?</span>
            {confidence.reasons.map((reason) => (
              <small key={reason}>
                <Check size={11} />
                {reason}
              </small>
            ))}
          </div>
        </div>
      )}
      <div className="diagnostic-grid">
        <div>
          <span>Requested</span>
          <b>{data.requested_ident || "Not reported"}</b>
          <small>
            {data.requested_date || "No date"}
            {data.requested_origin ? ` · from ${data.requested_origin}` : ""}
            {data.requested_destination
              ? ` to ${data.requested_destination}`
              : ""}
          </small>
        </div>
        <div>
          <span>Identifiers tried</span>
          <b>
            {data.identifiers_tried?.join(" → ") ||
              "No API identifier attempted"}
          </b>
          <small>{identifierNote}</small>
        </div>
        <div>
          <span>Operating flight</span>
          <b>{data.operating_ident || "No match"}</b>
          <small>
            {data.operator
              ? `Operated by ${data.operator}`
              : data.reason || "Operator unavailable"}
          </small>
        </div>
        <div>
          <span>Data freshness</span>
          <b>
            {fresh?.retrieved_at ? clock(fresh.retrieved_at) : "Unavailable"}
          </b>
          <small>
            {fresh?.latest_operational_timestamp
              ? `Latest actual update ${clock(fresh.latest_operational_timestamp)}`
              : fresh?.source || "No live record returned"}
          </small>
        </div>
      </div>
      {routes.length > 0 && (
        <div className="diagnostic-routes">
          <span>Matched legs</span>
          {routes.map((route, index) => (
            <b key={`${route.origin}-${route.destination}-${index}`}>
              {route.origin || "—"} → {route.destination || "—"}{" "}
              <small>
                {route.scheduled_out
                  ? new Date(route.scheduled_out).toLocaleString("en", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : ""}
              </small>
            </b>
          ))}
        </div>
      )}
      {data.alternate_marketing_idents?.length > 0 && (
        <div className="alternate-identifiers">
          <span>View a marketed or partner identifier</span>
          <div>
            {data.alternate_marketing_idents.map((alternate) => (
              <button onClick={() => choose(alternate)} key={alternate}>
                {alternate}
              </button>
            ))}
          </div>
        </div>
      )}
      {data.reason && <p>{data.reason}</p>}
      <div className="diagnostic-foot">
        <span>FlightAware AeroAPI · diagnostics reflect this lookup only</span>
        <button onClick={report} disabled={reported}>
          {reported ? (
            <>
              <Check size={11} /> Reported
            </>
          ) : (
            <>Report wrong flight</>
          )}
        </button>
      </div>
    </details>
  );
}
function FreshnessBadge({
  actual,
  estimated,
  scheduled,
  latest,
  active = false,
}) {
  const meaningfulEstimate =
    estimated &&
    (!scheduled ||
      new Date(estimated).getTime() !== new Date(scheduled).getTime());
  let label = actual
      ? "Actual"
      : meaningfulEstimate
        ? "Estimated"
        : scheduled
          ? "Scheduled"
          : "Unavailable",
    tone = label.toLowerCase();
  if (active && latest && Date.now() - new Date(latest).getTime() > 20 * 60e3) {
    label = "Stale";
    tone = "stale";
  }
  return <span className={`freshness-badge ${tone}`}>{label}</span>;
}
const shortSource = (source) =>
  source?.includes("Aviation Weather")
    ? "AWC METAR"
    : source?.includes("weather")
      ? "FlightAware METAR"
      : source?.replace("FlightAware AeroAPI ", "") || "Unavailable";
function MovementAudit({ movement }) {
  if (!movement) return null;
  return (
    <section className={`movement-audit ${movement.direction}`}>
      <div>
        <span>Why this moved</span>
        <strong>
          {movement.direction === "flat"
            ? "No change"
            : `${movement.delta > 0 ? "+" : ""}${movement.delta} points`}
        </strong>
      </div>
      <p>{movement.explanation}</p>
      {movement.drivers?.length > 0 && (
        <ul>
          {movement.drivers.map((driver) => (
            <li key={driver.key}>
              <b>{driver.label}</b>
              <span>
                {driver.from} → {driver.to}
              </span>
              <small>
                {driver.change > 0 ? "Raised" : "Lowered"} risk ·{" "}
                {shortSource(driver.source)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function SourceReceipts({ factors, calibration }) {
  return (
    <details className="source-receipts">
      <summary>
        <span>Data receipts</span>
        <b>{factors.filter((f) => f.value !== null).length} inputs used</b>
      </summary>
      {calibration && (
        <div className="calibration-receipt">
          <span>Walk-forward validation</span>
          <b>{calibration.signal_label || calibration.status}</b>
          <p>
            {calibration.completed_flights} completed flights ·{" "}
            {calibration.validation_predictions} predictions · model Brier{" "}
            {calibration.brier_score ?? "not available"} · route baseline{" "}
            {calibration.baseline_brier_score ?? "not available"}
          </p>
          <small>{calibration.note}</small>
        </div>
      )}
      <div className="receipt-list">
        {factors.map((factor) => (
          <article
            className={factor.value === null ? "missing" : ""}
            key={factor.key}
          >
            <div>
              <span>{factor.label}</span>
              <b>
                {factor.value === null
                  ? "Excluded"
                  : `${factor.value}/100 · ${factor.role}`}
              </b>
            </div>
            <p>{factor.detail}</p>
            <code>{factor.source_detail?.endpoint || factor.source}</code>
            <small>
              {factor.source_detail?.sample_size !== undefined
                ? `${factor.source_detail.sample_size} records · `
                : ""}
              {factor.source_detail?.observed_at
                ? `Observed ${new Date(factor.source_detail.observed_at).toLocaleString()} · `
                : ""}
              Retrieved{" "}
              {factor.source_detail?.retrieved_at
                ? new Date(factor.source_detail.retrieved_at).toLocaleString()
                : "with this lookup"}
            </small>
          </article>
        ))}
      </div>
    </details>
  );
}
function ValidationPanel({ data }) {
  if (!data) return null;
  const rows = data.backtest || [],
    modelBrier = data.brier_score,
    baselineBrier = data.baseline_brier_score ?? data.naive_route_brier,
    friendlyError = (value) =>
      Number.isFinite(value) ? Math.round(value * 1000) / 10 : null,
    skill = data.brier_skill_percent,
    verdict = data.signal_label || (data.beats_baseline ? "Validated lift" : "Route baseline"),
    verdictDetail =
      modelBrier === null || modelBrier === undefined || baselineBrier === null || baselineBrier === undefined
        ? "More completed departures are needed for a baseline comparison."
        : data.beats_baseline
          ? `${Math.max(0, skill || 0)}% lower error than the simple route average${data.material_signal ? "." : ", but not enough to reliably tell one day from another."}`
          : modelBrier > baselineBrier
            ? `${Math.abs(skill || 0)}% more forecast error than the route-rate baseline.`
            : "No measurable improvement over the route-rate baseline yet.",
    rateCard = (item) => (
      <div>
        <span>{item.label}</span>
        <strong>
          {item.delay_rate === null ? (
            "—"
          ) : (
            <AnimatedNumber value={100 - item.delay_rate} suffix="%" />
          )}
        </strong>
        <b>observed on time</b>
        <small>
          {item.sample_size} completed flights
          {item.confidence_band
            ? ` · 95% range ${100 - item.confidence_band.upper}–${100 - item.confidence_band.lower}%`
            : ""}
        </small>
      </div>
    );
  return (
    <section className="validation-panel">
      <div className="validation-head">
        <div>
          <span>Historical validation</span>
          <h4>Is this more useful than the route’s usual pattern?</h4>
          <p>
            We replayed earlier departures using only information that would
            have been available at the time.
          </p>
        </div>
        <div className={`validation-verdict ${data.material_signal ? "positive" : "limited"}`}>
          <strong>{verdict}</strong>
          <span>{verdictDetail}</span>
        </div>
      </div>
      <div className="brier-explainer">
        <b>Forecast error</b>
        <span>
          How far each predicted chance was from what actually happened. Zero
          is perfect; lower is better.
        </span>
      </div>
      <div className="brier-comparison" aria-label="Forecast error comparison">
        <div>
          <span>Historical baseline replay</span>
          <strong>
            {friendlyError(modelBrier) ?? "—"}
            {Number.isFinite(modelBrier) && <em>/100</em>}
          </strong>
          <small>Brier {modelBrier ?? "—"} · tested on earlier flights</small>
        </div>
        <div>
          <span>Simple route average</span>
          <strong>
            {friendlyError(baselineBrier) ?? "—"}
            {Number.isFinite(baselineBrier) && <em>/100</em>}
          </strong>
          <small>Brier {baselineBrier ?? "—"} · same flights</small>
        </div>
      </div>
      <div className="accuracy-cards">
        {rateCard(data.route)}
        {rateCard(data.airline)}
      </div>
      <div className="backtest-head">
        <div>
          <b>What Envolio expected vs what happened</b>
          <span>Latest {rows.length} validated departures</span>
        </div>
        <div>
          <i /> Estimated chance <em /> Actual delay
        </div>
      </div>
      {rows.length ? (
        <div className="backtest-view">
          {rows.map((row, index) => (
            <div
              className="backtest-row"
              style={{ "--row-delay": `${index * 0.045}s` }}
              key={`${row.date}-${index}`}
              title={`${new Date(row.date).toLocaleDateString()} · predicted ${row.predicted_delay_probability}% · actual ${row.actual_delay_minutes} min`}
            >
              <time>
                {new Date(row.date).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}
              </time>
              <div className="predicted-track">
                <i style={{ width: `${row.predicted_delay_probability}%` }} />
              </div>
              <b>{row.predicted_delay_probability}%</b>
              <div className="actual-track">
                <em
                  className={
                    row.actual_delay_minutes >= 15 ? "late" : "on-time"
                  }
                  style={{
                    width: `${Math.min(100, Math.max(3, (row.actual_delay_minutes / 90) * 100))}%`,
                  }}
                />
              </div>
              <strong>{row.actual_delay_minutes}m</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="backtest-empty">
          Not enough completed comparable flights for a responsible backtest.
        </p>
      )}
      <footer>
        The simple comparison assumes the route will behave like its own recent
        average. Envolio must beat that to claim useful day-by-day signal.
        {data.classification_accuracy === null
          ? " Its yes/no accuracy is not available yet."
          : ` Its yes/no result was right ${data.classification_accuracy}% of the time, but that figure can look good simply when a route is usually on time.`}{" "}
        The forecast-error comparison above is the more useful check.
      </footer>
    </section>
  );
}
function DelayReasoning({ data, cached }) {
  if (!data) return null;
  const labels = { confirmed: 'Confirmed reason', likely: 'Likely contributor', possible: 'Possible factor' };
  return <section className="delay-reasoning" aria-labelledby="delay-reasoning-title">
    <div className="reason-heading"><div><span>Behind the delay</span><h3 id="delay-reasoning-title">What could be holding things up?</h3></div><small>{cached ? 'Saved explanation' : 'Checked'} {clock(data.updated_at)}</small></div>
    <p>{data.summary}</p>
    <div className="reason-cards">{data.reasons.map(reason => <article key={reason.id}>
      <span className={`reason-label ${reason.classification}`}>{labels[reason.classification]}</span>
      <h4>{reason.title}</h4><p>{reason.detail}</p>
      <div className="reason-source">{reason.source}{reason.observed_at ? ` · observed ${clock(reason.observed_at)}` : ' · source observation time not supplied'}</div>
      <details><summary>Evidence strength: {reason.confidence_score}/100</summary><p>{data.confidence_method}</p><code>{reason.endpoint}</code><p>Retrieved {new Date(reason.retrieved_at).toLocaleString()}</p></details>
    </article>)}</div>
    {data.reasons.length > 0 && <p className="reason-action">{data.recommendation}</p>}
    <details className="reason-coverage"><summary>Sources checked &amp; availability</summary><ul>{data.sources.map((source,i)=><li key={i}><span>{source.name}</span><b>{source.status}</b></li>)}</ul><p>{data.confidence_method}</p></details>
  </section>;
}
function TravelerOutlook({ data, future }) {
  const chance=travelerChance(data.delay_index,future,data.cache_fallback?.active,data.refreshed_at);
  return <section className="everyday-outlook projected-delay" aria-label="Your delay outlook">
    <article className={`everyday-chance ${chance.tone}`}>
      <h3>{chance.label}: <strong>{chance.percent!==null?`${chance.percent}%`:'Unavailable'}</strong></h3>
      {chance.percent!==null&&<div className="chance-meter" aria-hidden="true"><i style={{width:`${chance.percent}%`}}/></div>}
      <dl className="chance-explainer"><div><dt>Why</dt><dd>{chance.why}</dd></div><div><dt>Reliability</dt><dd>{chance.reliability}</dd></div><div><dt>Updated</dt><dd>{chance.updated?<time dateTime={chance.updated}>{new Date(chance.updated).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</time>:'Update time unavailable'}</dd></div></dl>
    </article>
  </section>;
}
function NextStepCard({ flight, data, changes }) {
  const [title, detail] = travelAdvice(flight, { future: data.schedule_only, cached: data.cache_fallback?.active, changes, inbound: data.inbound_aircraft });
  return <section className="next-step-card" aria-labelledby="next-step-title"><span className="next-step-icon"><ArrowRight size={22}/></span><div><span className="traveler-kicker">What should I do?</span><h2 id="next-step-title">{title}</h2><p>{detail}</p></div></section>;
}
function ProbabilityIndex({ index, phase }) {
  if (!index)
    return (
      <section className="probability-index unavailable">
        <div>
          <span>Live delay index</span>
          <h3>Probability unavailable</h3>
          <p>
            Available operational sources did not return enough evidence to
            calculate a responsible estimate. Envolio will retry when the
            flight is refreshed.
          </p>
        </div>
        <b>No synthetic fallback</b>
      </section>
    );
  const series = index.live_series || [],
    width = 640,
    height = 170,
    points = series
      .map(
        (point, i) =>
          `${series.length === 1 ? width / 2 : 18 + (i * (width - 36)) / (series.length - 1)},${height - 16 - (point.delay * (height - 32)) / 100}`,
      )
      .join(" "),
    latest = series.at(-1),
    tone = index.score >= 50 ? "negative" : "positive",
    phaseLabel =
      phase === "upcoming"
        ? "Live delay probability"
        : phase === "inflight"
          ? "Departure disruption index"
          : "Recorded delay index",
    weather = index.weather_strategy,
    signalLabel = index.signal_label || index.calibration?.signal_label || "Calibrating",
    signalSummary = index.signal_summary || index.calibration?.note || "Validation is still building.";
  return (
    <section className={`probability-index ${tone}`}>
      <div className="probability-head">
        <div>
          <span>{phaseLabel}</span>
          <h3>
            Estimated <AnimatedNumber value={index.score} suffix="%" /> delay <i />{" "}
            <AnimatedNumber value={index.on_time_probability} suffix="%" /> on
            time
          </h3>
          <p>{signalSummary}</p>
        </div>
        <div className={`probability-confidence ${index.calibration?.material_signal ? "validated" : "limited"}`}>
          <strong>{signalLabel}</strong>
          <span>validation status</span>
          <small>
            <AnimatedNumber value={index.coverage_percent} suffix="%" /> evidence coverage
          </small>
        </div>
      </div>
      <div className="probability-split">
        <i style={{ width: `${index.on_time_probability}%` }} />
        <b style={{ width: `${index.score}%` }} />
      </div>
      <div className="stock-chart">
        <div className="stock-axis">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Live delay index, currently ${index.score} out of 100`}
        >
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} />
          {series.length > 1 && <polyline points={points} />}{" "}
          {series.map((point, i) => {
            const x =
                series.length === 1
                  ? width / 2
                  : 18 + (i * (width - 36)) / (series.length - 1),
              y = height - 16 - (point.delay * (height - 32)) / 100;
            return (
              <circle cx={x} cy={y} r="5" key={point.at}>
                <title>
                  {new Date(point.at).toLocaleString()} · {point.delay}% delay
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="stock-meta">
          <span>
            {series.length > 1
              ? `${series.length} real refresh snapshots`
              : "First live calculation"}
          </span>
          <span>
            {latest ? `Updated ${clock(latest.at)}` : "Awaiting refresh"}
          </span>
        </div>
        {series.length < 2 && (
          <p>
            Refreshes build this timeline over time. Envolio does not fabricate
            earlier index values.
          </p>
        )}
      </div>
      <MovementAudit movement={index.movement} />
      <ValidationPanel data={index.calibration} />
      <div className="probability-factors">
        {index.factors.map((factor) => (
          <div
            className={factor.value === null ? "missing" : ""}
            key={factor.key}
            title={`${factor.detail} · ${factor.source}`}
          >
            <span>{factor.label}</span>
            <b>
              {factor.value === null ? (
                "Unavailable"
              ) : (
                <>
                  <AnimatedNumber value={factor.value} />
                  <small>/100</small>
                </>
              )}
            </b>
            <i>
              <em style={{ width: `${factor.value || 0}%` }} />
            </i>
            <small>{shortSource(factor.source)}</small>
          </div>
        ))}
      </div>
      {weather && (
        <div className="weather-provenance">
          <Cloud size={14} />
          <span>
            Weather used: {weather.origin_provider || "none"} at departure ·{" "}
            {weather.arrival_provider || "none"} at arrival
          </span>
          <button type="button" title={weather.policy}>
            Source policy
          </button>
        </div>
      )}
      <SourceReceipts factors={index.factors} calibration={index.calibration} />
      <details className="probability-method">
        <summary>Method and limitations</summary>
        <p>{index.methodology}</p>
        <p>
          Delay means a departure variance of at least 15 minutes. This is a
          transparent Envolio estimate, not FlightAware Foresight and not a
          guarantee.
        </p>
      </details>
    </section>
  );
}
function ShareResultCard({ flight, index, date, onClose }) {
  const [working, setWorking] = useState(false),
    ident = flight.ident_iata || flight.ident,
    origin = code(flight.origin),
    destination = code(flight.destination),
    status = flight.status || "Status unavailable",
    risk = index?.score;
  const makeBlob = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d"),
      gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#28232f");
    gradient.addColorStop(0.55, "#1b1b20");
    gradient.addColorStop(1, "#111113");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, 1116, 546);
    const logo = new Image();
    logo.src = `${base}envolio-passport.svg`;
    await logo.decode().catch(() => {});
    ctx.drawImage(logo, 72, 67, 54, 54);
    ctx.fillStyle = "#f8faff";
    ctx.font = "700 22px Manrope, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText("ENVOLIO", 145, 103);
    ctx.fillStyle = "#91a3bf";
    ctx.font = "600 17px Manrope, sans-serif";
    ctx.fillText(
      `${dateLabel(date).toUpperCase()} · LIVE FLIGHT INTELLIGENCE`,
      72,
      176,
    );
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px Manrope, sans-serif";
    ctx.fillText(ident, 72, 250);
    ctx.font = "700 108px Manrope, sans-serif";
    ctx.fillText(origin, 72, 390);
    ctx.fillStyle = "#7188af";
    ctx.font = "500 65px Manrope, sans-serif";
    ctx.fillText("→", 420, 382);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 108px Manrope, sans-serif";
    ctx.fillText(destination, 540, 390);
    ctx.fillStyle = "#aebbd0";
    ctx.font = "600 22px Manrope, sans-serif";
    ctx.fillText(status, 74, 450);
    ctx.fillStyle = risk >= 50 ? "#fb6b7e" : "#41dda9";
    ctx.font = "700 64px Manrope, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(Number.isFinite(risk) ? `${risk}%` : "—", 1118, 260);
    ctx.fillStyle = "#aab5c7";
    ctx.font = "700 17px Manrope, sans-serif";
    ctx.fillText("ESTIMATED DELAY PROBABILITY", 1118, 296);
    ctx.fillStyle = "#74839a";
    ctx.font = "500 16px Manrope, sans-serif";
    ctx.fillText(
      index
        ? `${index.signal_label || "Calibrating"} · ${index.coverage_percent}% evidence coverage`
        : "Probability unavailable",
      1118,
      330,
    );
    ctx.fillStyle = "#75849b";
    ctx.font = "500 16px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      "Live operational data by FlightAware · Envolio",
      72,
      548,
    );
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };
  const download = async () => {
    setWorking(true);
    try {
      const blob = await makeBlob(),
        url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `contrail-${ident}-${date}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setWorking(false);
    }
  };
  const post = async () => {
    setWorking(true);
    try {
      const blob = await makeBlob(),
        file = new File([blob], `contrail-${ident}-${date}.png`, {
          type: "image/png",
        });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          title: `${ident} · ${origin} to ${destination}`,
          text: "Flight intelligence from Envolio",
          files: [file],
        });
      else await download();
    } catch {
    } finally {
      setWorking(false);
    }
  };
  return (
    <div
      className="share-card-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="share-card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-card-title"
      >
        <button
          className="share-card-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="share-card-preview">
          <div className="share-card-brand">
            <span className="brand-mark">
              <img src={`${base}envolio-passport.svg`} alt="" />
            </span>{" "}
            ENVOLIO
          </div>
          <span>{dateLabel(date)} · Flight intelligence</span>
          <h2 id="share-card-title">{ident}</h2>
          <div className="share-card-route">
            <strong>{origin}</strong>
            <Plane size={26} />
            <strong>{destination}</strong>
          </div>
          <p>{status}</p>
          <aside className={risk >= 50 ? "negative" : "positive"}>
            <b>{Number.isFinite(risk) ? `${risk}%` : "—"}</b>
            <span>estimated delay probability</span>
            <small>
              {index
                ? `${index.signal_label || "Calibrating"} · ${index.coverage_percent}% evidence coverage`
                : "Index unavailable"}
            </small>
          </aside>
        </div>
        <div className="share-card-actions">
          <button onClick={download} disabled={working}>
            <Download size={16} /> Download PNG
          </button>
          <button className="primary" onClick={post} disabled={working}>
            <Share2 size={16} /> {working ? "Preparing" : "Post or share"}
          </button>
        </div>
        <small>
          The exported card includes the current score and data timestamp. It
          does not imply a guarantee.
        </small>
      </section>
    </div>
  );
}
function FlightDetail({ ident, date, go, saved, toggle }) {
  const [state, setState] = useState({ loading: true, error: "", data: null }),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState({ loading: true, error: "", data: null });
    fetch(`${base}api/flights/${encodeURIComponent(ident)}?date=${date}`, {
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.flights?.length)
          throw new Error(
            d.error || `No ${ident} service was found on ${dateLabel(date)}.`,
          );
        setState({ loading: false, error: "", data: d });
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setState({
            loading: false,
            error: e.message || "The request failed. Please try again.",
            data: null,
          });
      });
    return () => c.abort();
  }, [ident, date, attempt]);
  if (state.loading)
    return (
      <>
        <Header go={go} />
        <Loading />
        <Footer go={go} />
      </>
    );
  if (state.error)
    return (
      <>
        <Header go={go} />
        <Failure
          message={state.error}
          retry={() => setAttempt((x) => x + 1)}
          go={go}
        />
        <Footer go={go} />
      </>
    );
  const f = state.data.flights[0],
    phase = flightPhase(f),
    out = f.actual_out || f.estimated_out || f.scheduled_out,
    arrival = f.actual_in || f.estimated_in || f.scheduled_in,
    delay =
      f.scheduled_out && out
        ? Math.round((new Date(out) - new Date(f.scheduled_out)) / 60000)
        : null,
    disrupted =
      /cancel|divert/i.test(f.status || "") || (delay !== null && delay >= 15),
    progress = Number.isFinite(f.progress_percent)
      ? f.progress_percent
      : phase === "landed"
        ? 100
        : 0,
    isSaved = saved.some((x) => x.key === `${ident}|${date}`),
    upcomingDetails = [
      ["Departure terminal", f.terminal_origin],
      ["Departure gate", f.gate_origin],
      ["Arrival terminal", f.terminal_destination],
      ["Arrival gate", f.gate_destination],
      ["Aircraft", f.aircraft_type_friendly || f.aircraft_type],
      ["Registration", f.registration],
    ],
    liveDetails = [
      ["Departure gate", f.gate_origin],
      ["Arrival gate", f.gate_destination],
      ["Aircraft", f.aircraft_type_friendly || f.aircraft_type],
      ["Registration", f.registration],
      [
        "Altitude",
        f.altitude ? `${Number(f.altitude).toLocaleString()} ft` : null,
      ],
      ["Ground speed", f.groundspeed ? `${f.groundspeed} kt` : null],
      ...(phase === "landed" ? [["Baggage claim", f.baggage_claim]] : []),
    ],
    details = phase === "upcoming" ? upcomingDetails : liveDetails;
  return (
    <>
      <Header go={go} />
      <main className="detail-shell">
        <button className="back-link" onClick={() => go(base)}>
          <ChevronLeft size={15} /> All flights
        </button>
        <section className="flight-title">
          <div className="carrier-identity">
            <CarrierLogo flight={f} />
            <div>
              <span>{f.operator || "Carrier not reported"}</span>
              <h1>{f.ident_iata || f.ident}</h1>
            </div>
          </div>
          <div className="title-actions">
            <div
              className={`operational-status ${disrupted ? "negative" : "positive"}`}
            >
              {disrupted ? (
                <TrendingDown size={15} />
              ) : (
                <TrendingUp size={15} />
              )}{" "}
              {f.status || "Status not reported"}
            </div>
            <button
              className={`save-button ${isSaved ? "saved" : ""}`}
              onClick={() =>
                toggle({
                  ident,
                  date,
                  origin: f.origin,
                  destination: f.destination,
                  operator: f.operator,
                })
              }
            >
              <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />{" "}
              {isSaved ? "Saved" : "Save flight"}
            </button>
          </div>
        </section>
        <section className="route-panel">
          <div className="route-date">
            {dateLabel(date)} ·{" "}
            {f.aircraft_type_friendly || f.aircraft_type || "Aircraft pending"}
          </div>
          <div className="route-main">
            <div>
              <strong>{code(f.origin)}</strong>
              <span>{city(f.origin)}</span>
              <time>{clock(out, f.origin?.timezone)}</time>
              <small>
                {delay > 0
                  ? `${delay} min after schedule`
                  : `Scheduled ${clock(f.scheduled_out, f.origin?.timezone)}`}
              </small>
            </div>
            <div className="route-track">
              <div>
                <i
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <span>
                {progress > 0 && progress < 100
                  ? `${progress}% complete`
                  : f.status || "Scheduled"}
              </span>
            </div>
            <div className="destination">
              <strong>{code(f.destination)}</strong>
              <span>{city(f.destination)}</span>
              <time>{clock(arrival, f.destination?.timezone)}</time>
              <small>
                Scheduled {clock(f.scheduled_in, f.destination?.timezone)}
              </small>
            </div>
          </div>
        </section>
        <section className={`detail-grid phase-${phase}`}>
          {details.map(([l, v]) => (
            <div key={l}>
              <span>{l}</span>
              <b>{shown(v)}</b>
            </div>
          ))}
        </section>
        {phase === "upcoming" && (
          <InboundAircraft
            flight={
              f.inbound_fa_flight_id ? state.data.inbound_aircraft : undefined
            }
            current={f}
          />
        )}
        <DelayPanel index={state.data.delay_index} />
        <section className="sources-panel">
          <div>
            <Database size={18} />
            <span>
              <b>Flight and airport operations</b>FlightAware AeroAPI ·
              refreshed for this lookup
            </span>
          </div>
          <div>
            <Cloud size={18} />
            <span>
              <b>Weather conditions</b>FlightAware decoded airport observation ·
              latest available
            </span>
          </div>
          <p>
            The Delay Index is calculated by Envolio from the displayed inputs.
            It is not FlightAware Foresight.
          </p>
        </section>
      </main>
      <Footer go={go} />
    </>
  );
}
function FlightDetailV2({
  ident,
  date,
  origin = "",
  destination = "",
  departure = "",
  go,
  saved,
  toggle,
}) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
    diagnostics: null,
  });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const browserCacheKey = `contrail.lookup.${ident}.${date}.${origin}.${destination}${departure?`.${departure}`:''}`;
  useEffect(() => {
    if (!state.data) return;
    let observer, timer;
    const nodes = [
        ...document.querySelectorAll(
          ".detail-shell > section,.detail-shell > details,.detail-shell > .detail-grid",
        ),
      ],
      reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
      revealVisible = () =>
        nodes.forEach((node) => {
          const rect = node.getBoundingClientRect();
          if (rect.top < innerHeight * 0.94 && rect.bottom > 0)
            node.classList.add("scroll-shown");
        });
    nodes.forEach((node, index) => {
      node.classList.add("scroll-reveal");
      node.style.setProperty("--reveal-order", index % 4);
    });
    if (reduced) {
      nodes.forEach((node) => node.classList.add("scroll-shown"));
      return;
    }
    observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-shown");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.01, rootMargin: "80px 0px 80px" },
    );
    nodes.forEach((node) => observer.observe(node));
    addEventListener("scroll", revealVisible, { passive: true });
    requestAnimationFrame(revealVisible);
    timer = setTimeout(revealVisible, 250);
    return () => {
      observer.disconnect();
      removeEventListener("scroll", revealVisible);
      clearTimeout(timer);
    };
  }, [state.data]);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) =>
      current.data
        ? { ...current, error: "" }
        : { loading: true, error: "", data: null, diagnostics: null },
    );
    const handedOff=takeSearchResult(searchKey(ident,date,origin,destination,departure));
    (handedOff?Promise.resolve({ok:true,json:async()=>handedOff}):fetch(
      `${base}api/flights/${encodeURIComponent(ident)}?date=${date}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}${destination ? `&destination=${encodeURIComponent(destination)}` : ""}${departure?`&departure=${encodeURIComponent(departure)}`:''}`,
      { signal: controller.signal },
    ))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.flights?.length) {
          let cached = null;
          try {
            cached = JSON.parse(
              localStorage.getItem(browserCacheKey) || "null",
            );
          } catch {}
          setState((current) =>
            cached
              ? {
                  loading: false,
                  error: "",
                  data: {
                    ...cached,
                    cache_fallback: {
                      active: true,
                      saved_at: cached.refreshed_at,
                      reason: data.error || "Live lookup unavailable",
                    },
                  },
                  diagnostics: cached.diagnostics,
                }
              : {
                  loading: false,
                  error:
                    [data.error, data.detail].filter(Boolean).join(" ") ||
                    `No ${ident} service was found on ${dateLabel(date)}.`,
                  data: current.data,
                  diagnostics: data.diagnostics || current.diagnostics || null,
                },
          );
          return;
        }
        try {
          localStorage.setItem(browserCacheKey, JSON.stringify(data));
        } catch {}
        rememberFlight(ident,date,data.flights[0]);
        setState({
          loading: false,
          error: "",
          data,
          diagnostics: data.diagnostics || null,
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          let cached = null;
          try {
            cached = JSON.parse(
              localStorage.getItem(browserCacheKey) || "null",
            );
          } catch {}
          setState((current) =>
            cached
              ? {
                  loading: false,
                  error: "",
                  data: {
                    ...cached,
                    cache_fallback: {
                      active: true,
                      saved_at: cached.refreshed_at,
                      reason: "Envolio is offline",
                    },
                  },
                  diagnostics: cached.diagnostics,
                }
              : {
                  loading: false,
                  error:
                    !navigator.onLine
                      ? "You’re offline and this flight hasn’t been saved on this device. Connect to the internet to look it up."
                      : error.message || "The request failed. Please try again.",
                  data: current.data,
                  diagnostics: current.diagnostics,
                },
          );
        }
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [ident, date, origin, destination, departure, attempt, browserCacheKey]);
  const refresh = () => {
    setRefreshing(true);
    setAttempt((value) => value + 1);
  };
  const share = async () => {
    const url = location.href,
      title = `${ident} · ${dateLabel(date)}`;
    try {
      if (navigator.share)
        await navigator.share({ title: `Envolio — ${title}`, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {}
  };
  if (state.loading)
    return (
      <>
        <Header go={go} />
        <Loading ident={ident} date={date} />
        <Footer go={go} />
      </>
    );
  if (state.error && !state.data)
    return (
      <>
        <Header go={go} />
        <Failure
          message={state.error}
          retry={refresh}
          go={go}
          diagnostics={state.diagnostics}
        />
        <Footer go={go} />
      </>
    );
  const f = state.data.flights[0],
    phase = flightPhase(f),
    inbound = state.data.inbound_aircraft;
  const out = f.actual_out || f.estimated_out || f.scheduled_out,
    arrival = f.actual_in || f.estimated_in || f.scheduled_in;
  const delay =
    f.scheduled_out && out
      ? Math.round((new Date(out) - new Date(f.scheduled_out)) / 60000)
      : null;
  const progress = Number.isFinite(f.progress_percent)
      ? f.progress_percent
      : phase === "landed"
        ? 100
        : 0,
    favoriteKey = `${ident}|${date}|${code(f.origin)}`,
    isSaved = saved.some(
      (item) => item.key === favoriteKey || item.key === `${ident}|${date}`,
    );
  const signal =
    phase === "upcoming"
      ? inboundSignal(inbound, f)
      : {
          label: f.status || "Status not reported",
          tone: /delay|cancel|divert/i.test(f.status || "")
            ? "negative"
            : "positive",
        };
  const changes = assignmentChanges(f, ident, date);
  const upcomingDetails = [
    ["Departure terminal", f.terminal_origin],
    ["Departure gate", f.gate_origin],
    ["Arrival terminal", f.terminal_destination],
    ["Arrival gate", f.gate_destination],
    ["Aircraft", f.aircraft_type_friendly || f.aircraft_type],
    ["Registration", f.registration],
  ];
  return (
    <>
      <Header go={go} />
      <main className="detail-shell">
        <div className="detail-toolbar">
          <button className="back-link" onClick={() => go(base)}>
            <ChevronLeft size={15} /> All flights
          </button>
          <button
            className="refresh-flight"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "spinning" : ""} />{" "}
            {refreshing ? "Refreshing" : "Refresh"}
            <small>Updated {clock(state.data.refreshed_at)}</small>
          </button>
        </div>
        {state.error && (
          <div className="inline-refresh-error">
            Couldn’t refresh. Showing the latest available details.
          </div>
        )}
        {state.data.cache_fallback?.active && (
          <div className="cache-fallback">
            <b>Saved flight data</b>
            <span>
              Live data is temporarily unavailable. Showing the last successful
              lookup from {clock(state.data.cache_fallback.saved_at)}.
            </span>
            <button onClick={refresh}>Try live refresh</button>
          </div>
        )}
        <NextStepCard flight={f} data={state.data} changes={changes} />
        {!!state.data.delay_index?.operational_warnings?.length && <section className="operational-warnings" aria-label="Weather and aircraft warnings">{state.data.delay_index.operational_warnings.map((warning,i)=><article key={`${warning.kind}-${i}`}><h3>{warning.airport?`${warning.airport}: `:''}{warning.title}</h3><p>{warning.detail}</p><small>{warning.source}{warning.issued_at?` · Forecast issued ${new Date(warning.issued_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}`:''}</small>{warning.periods?.length>0&&<details><summary>When this weather is forecast</summary>{warning.periods.map((period,n)=><p key={n}>{new Date(period.from).toLocaleString()} – {new Date(period.to).toLocaleString()}{period.weather_probability!==null?` · ${period.weather_probability}% chance of the weather, not of a flight delay`:''}</p>)}<small>Times use your device’s time zone.</small></details>}</article>)}</section>}
        {state.data.schedule_only && (
          <div className="future-schedule-notice">
            <CalendarDays size={18} />
            <span>
              <b>Published future schedule</b>
              {state.data.schedule_notice}
            </span>
          </div>
        )}
        <section className="flight-title">
          <div className="carrier-identity">
            <CarrierLogo flight={f} />
            <div>
              <span>
                {f.operator || "Carrier not reported"}
                {state.data.diagnostics?.match_type === "codeshare"
                  ? ` · marketed as ${ident}`
                  : ""}
              </span>
              <h1>{f.ident_iata || f.ident}</h1>
            </div>
          </div>
          <div className="title-actions">
            <div className={`operational-status ${signal.tone}`}>
              {signal.tone === "negative" ? (
                <TrendingDown size={15} />
              ) : (
                <TrendingUp size={15} />
              )}{" "}
              {signal.label}
            </div>
            <button className="share-button" onClick={share}>
              <Share2 size={15} /> {shared ? "Link copied" : "Share link"}
            </button>
            <button
              className="share-button results-card-button"
              onClick={() => setShareCardOpen(true)}
            >
              <Download size={15} /> Results card
            </button>
            <button
              className="alerts-button"
              onClick={() => setAlertsOpen(true)}
            >
              <Bell size={15} /> Watch flight
            </button>
            <button
              className={`save-button ${isSaved ? "saved" : ""}`}
              onClick={() =>
                toggle({
                  ident,
                  date,
                  origin: f.origin,
                  destination: f.destination,
                  operator: f.operator,
                })
              }
            >
              <Star size={16} fill={isSaved ? "currentColor" : "none"} />{" "}
              {isSaved ? "Favorited" : "Favorite"}
            </button>
          </div>
        </section>
        <RouteChoices
          options={state.data.route_options || []}
          current={f}
          ident={ident}
          date={date}
          go={go}
        />
        <section className="route-panel">
          <div className="route-date">
            <span>
              {dateLabel(date)} · times local to each airport
            </span>
            <div className="route-carrier-preview">
              <CarrierLogo flight={f} />
              <span>
                {f.operator || "Airline"} ·{" "}
                {f.aircraft_type_friendly ||
                  f.aircraft_type ||
                  "Aircraft pending"}
              </span>
            </div>
          </div>
          <div className="route-main">
            <div>
              <strong>{code(f.origin)}</strong>
              <div className="airport-location">
                <span>{city(f.origin)}</span>
                <CountryMarker airport={f.origin} />
              </div>
              <time>{clock(out, f.origin?.timezone)}</time>
              <FreshnessBadge
                actual={f.actual_out}
                estimated={f.estimated_out}
                scheduled={f.scheduled_out}
                latest={state.data.flight_position?.timestamp}
                active={phase === "inflight"}
              />
              <small>
                {delay > 0
                  ? `${delay} min after schedule`
                  : `Scheduled ${clock(f.scheduled_out, f.origin?.timezone)}`}
              </small>
            </div>
            <div className="route-track">
              <div>
                <i
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <span>
                {progress > 0 && progress < 100
                  ? `${progress}% complete`
                  : signal.label}
              </span>
            </div>
            <div className="destination">
              <strong>{code(f.destination)}</strong>
              <div className="airport-location">
                <span>{city(f.destination)}</span>
                <CountryMarker airport={f.destination} />
              </div>
              <time>{clock(arrival, f.destination?.timezone)}</time>
              <FreshnessBadge
                actual={f.actual_in}
                estimated={f.estimated_in}
                scheduled={f.scheduled_in}
                latest={state.data.flight_position?.timestamp}
                active={phase === "inflight"}
              />
              <small>
                Scheduled {clock(f.scheduled_in, f.destination?.timezone)}
              </small>
            </div>
          </div>
        </section>
        {!f.actual_off && !f.actual_in && !f.cancelled && <TakeoffSlot slot={state.data.takeoff_slot} airport={f.origin} scheduled={f.scheduled_out} cached={state.data.cache_fallback?.active}/>}
        {phase === 'upcoming' && !f.cancelled && !/cancel/i.test(f.status||'') && <TravelerOutlook data={state.data} future={state.data.schedule_only} />}
        {phase === 'upcoming' && <RiskContext index={state.data.delay_index} cached={state.data.cache_fallback?.active}/>}
        {phase === "upcoming" ? (
          <>
            {!state.data.schedule_only && <section className="detail-grid phase-upcoming">
              {upcomingDetails.slice(0, 2).map(([label, value]) => (
                <ChangeAwareValue
                  key={label}
                  label={label}
                  value={value}
                  flightKey={`${ident}.${date}`}
                />
              ))}
            </section>}
            <InboundSummary
              flight={inbound}
              position={state.data.inbound_position}
              current={f}
              refreshed={state.data.refreshed_at}
              cached={state.data.cache_fallback?.active}
              rotation={state.data.aircraft_rotation}
            />
            {!state.data.schedule_only && <details className="traveler-details"><summary>Departure timeline</summary><TurnTimeline flight={f} inbound={inbound} /></details>}
          </>
        ) : (
          <LiveOperations
            flight={f}
            position={state.data.flight_position}
            refreshed={state.data.refreshed_at}
          />
        )}
        <TravelIntelligence ident={ident} date={date} origin={origin} destination={destination} departure={departure} refreshed={state.data.refreshed_at} cached={state.data.cache_fallback?.active} onRefresh={refresh} />
        <details className="traveler-details flight-analysis"><summary><span>Flight history &amp; explanation</span><small>Charts, contributing factors, and sources</small></summary>
          <button className="secondary traveler-export" onClick={() => setShareCardOpen(true)}><Download size={16}/> Download a flight card</button>
          <DelayReasoning data={state.data.delay_reasoning} cached={state.data.cache_fallback?.active} />
          <ProbabilityIndex index={state.data.delay_index} phase={phase} />
        </details>
        <LookupDiagnostics data={state.data.diagnostics} go={go} />
        <details className="traveler-details"><summary>About the flight data</summary><section className="sources-panel">
          <div>
            <Database size={18} />
            <span>
              <b>Flight and airport operations</b>FlightAware AeroAPI ·
              refreshed for this lookup
            </span>
          </div>
          {phase === "upcoming" && (
            <div>
              <Cloud size={18} />
              <span>
                <b>Weather conditions</b>
                {state.data.delay_index?.weather_strategy?.origin_provider ||
                  state.data.delay_index?.weather_strategy?.arrival_provider ||
                  "No current observation"}{" "}
                · provider shown per factor
              </span>
            </div>
          )}
          <p>
            {phase === "upcoming"
              ? "The Delay Index is calculated by Envolio from the displayed inputs. Weather fallback data is labeled and never blended. It is not FlightAware Foresight."
              : "Position and operating data are the latest values returned by FlightAware."}
          </p>
        </section></details>
      </main>
      <AlertEmitter
        flight={f}
        inbound={inbound}
        index={state.data.delay_index}
        flightKey={`${ident}.${date}`}
      />
      <Footer go={go} />
      <AlertSettings
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        flightKey={`${ident}.${date}`}
        flightLabel={f.ident_iata || f.ident}
      />
      {shareCardOpen && (
        <ShareResultCard
          flight={f}
          index={state.data.delay_index}
          date={date}
          onClose={() => setShareCardOpen(false)}
        />
      )}
    </>
  );
}

export default function App() {
  const [route, go] = useRoute(),
    s = useSaved();
  return <WebShell go={go}>{s.storageError&&<div className="storage-warning" role="status">This browser couldn’t save your changes. Favorites are available for this visit only.</div>}{route.page === 'flight'
    ? <FlightDetailV2 key={[route.ident,route.date,route.origin,route.destination,route.departure].join('|')} {...route} go={go} saved={s.saved} toggle={s.toggle}/>
    : route.page !== 'home' ? <ExplorePage route={route} go={go} saved={s.saved} remove={s.remove}/>
    : <Home go={go} saved={s.saved} remove={s.remove}/>}</WebShell>;
}
