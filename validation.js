// Point-in-time route baseline. Never uses current operations or later outcomes.
export function completedHistory(flight, rows, now = Date.now()) {
  const code = a => a?.code_icao || a?.code || a?.code_iata;
  const cutoff = Math.min(now, Date.parse(flight.scheduled_out) || now);
  const seen = new Set();
  return rows.filter(f => {
    const key = f.fa_flight_id || `${f.ident}|${f.scheduled_out}|${code(f.origin)}|${code(f.destination)}`;
    if (seen.has(key) || (flight.fa_flight_id && f.fa_flight_id === flight.fa_flight_id)) return false;
    seen.add(key);
    return code(f.origin) === code(flight.origin) && code(f.destination) === code(flight.destination)
      && Number.isFinite(Date.parse(f.actual_out)) && Date.parse(f.actual_out) < cutoff
      && Number.isFinite(Date.parse(f.scheduled_out)) && Date.parse(f.scheduled_out) < cutoff;
  }).map(f => ({ date: f.scheduled_out, actual_at: f.actual_out,
    minutes: Math.max(0, (Date.parse(f.actual_out) - Date.parse(f.scheduled_out)) / 60000) }))
    .sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
}

export function routeValidation(records) {
  const backtest = [];
  for (let i = 0; i < records.length; i++) {
    // Earlier scheduled flights that had actually departed by prediction time.
    const earlier = records.slice(0, i).filter(r => Date.parse(r.actual_at) < Date.parse(records[i].date));
    if (earlier.length < 3) continue;
    const p = earlier.filter(r => r.minutes >= 15).length / earlier.length;
    backtest.push({ date: records[i].date, predicted_delay_probability: Math.round(p * 100),
      actual_delay_minutes: Math.round(records[i].minutes), actual_delayed: records[i].minutes >= 15,
      squared_error: (p - Number(records[i].minutes >= 15)) ** 2 });
  }
  return { backtest, brier: backtest.length ? backtest.reduce((s,r) => s + r.squared_error, 0) / backtest.length : null };
}
