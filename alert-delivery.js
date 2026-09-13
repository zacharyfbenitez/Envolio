export function alertCapabilities(env=process.env){
 const enabled=env.ENABLE_ALERT_SUBSCRIPTIONS==='true'&&!!env.ALERT_DELIVERY_WEBHOOK;
 return {email:!!(enabled&&env.RESEND_API_KEY&&env.ALERT_FROM_EMAIL),sms:!!(enabled&&env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&(env.TWILIO_FROM_NUMBER||env.TWILIO_MESSAGING_SERVICE_SID)),note:'Delivery requires an active background worker. Browser alerts only run while this flight page is open.'};
}
// Shared contract for the background delivery worker. No invented cause or timing.
export function travelerAlert({flight,event,before,after,reason}){
 const name=String(flight||'Your flight').slice(0,30);
 const messages={gate:[`Gate update${after?`: ${after}`:''}.`,'Check airport screens before heading to the new gate.'],delay:[`Flight time changed${after?`: ${after}`:''}.`,'Keep the airline’s check-in deadline and stay near your gate.'],cancelled:['Flight cancelled.','Contact your airline about rebooking before buying another ticket.'],inbound:['Your incoming plane has reached the gate.','Allow time for passengers to leave and the plane to be prepared.'],boarding:['Boarding reminder.','Check your boarding pass and airport screens; this is not a confirmed boarding announcement.'],landing:['Your flight has landed.','Wait for gate arrival before making onward plans.'],baggage:[`Baggage update${after?`: ${after}`:''}.`,'Confirm the belt on airport screens.'],probability:['Your estimated delay risk changed.',reason?`Why: ${String(reason).slice(0,240)}`:'Open your flight for the latest explanation.']};
 const [update,action]=messages[event]||['Your flight has an update.','Open your flight for details.'];
 return `${name}: ${update} ${action}`;
}
