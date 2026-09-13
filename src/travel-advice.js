import {isCancelled,isDiverted} from './flight-state.js';
export function travelAdvice(flight, { future = false, cached = false, changes = [], inbound = null } = {}, now = Date.now()) {
  const status = String(flight.status || '');
  if (cached) return ['Check the airline for the latest update', 'These results are saved. Confirm your flight time and gate before making plans.'];
  if (isCancelled(flight)) return ['Check your rebooking options', 'Open the airline’s app or speak to its service desk before travelling to the airport.'];
  if (isDiverted(flight)) return ['Confirm your new arrival airport', 'Follow the airline’s instructions before arranging onward travel.'];
  if (flight.actual_in) return [flight.baggage_claim ? `Head to baggage claim ${flight.baggage_claim}` : 'Check your onward journey', flight.baggage_claim ? 'Confirm the carousel on airport screens. Connecting? Check your next gate instead.' : 'Check airport screens for your next gate or baggage carousel.'];
  if (flight.actual_out) return ['Plan for your arrival', 'Check the arrival estimate below and your next gate if you have a connection.'];
  if (future) return ['Save your flight and check back before you travel', 'Your schedule is published. Gate and aircraft details will appear closer to departure.'];
  const change = changes.find(item => /Departure (gate|terminal)/i.test(item.label));
  if (change) return ['Check your new gate or terminal', `${change.label}: ${change.current}. Confirm the change on airport screens before heading there.`];
  const arrival = inbound?.actual_in || inbound?.estimated_in;
  const shortTurn = arrival && Date.parse(arrival) > Date.parse(flight.scheduled_out) - 30 * 60000;
  const delayed = Date.parse(flight.estimated_out) - Date.parse(flight.scheduled_out) >= 15 * 60000;
  if (shortTurn || delayed || /delay/i.test(status)) return ['Keep checking your boarding time', 'Boarding may move. If you’re already at the airport, stay near the gate; follow the airline’s original check-in deadlines.'];
  const untilDeparture = Date.parse(flight.estimated_out || flight.scheduled_out) - now;
  if (untilDeparture > 0 && untilDeparture <= 60 * 60000) return ['Be ready at your departure gate', 'Check airport screens and listen for boarding announcements. Boarding may close before departure time.'];
  return ['Follow your airline’s check-in guidance', 'Allow time for security and check your gate again when you reach the airport.'];
}
