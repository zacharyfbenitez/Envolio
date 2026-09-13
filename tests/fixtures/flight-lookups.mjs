const airport=(iata,icao,city,timezone)=>({code:icao,code_icao:icao,code_iata:iata,city,timezone});
const NRT=airport('NRT','RJAA','Tokyo','Asia/Tokyo'),LAX=airport('LAX','KLAX','Los Angeles','America/Los_Angeles'),SIN=airport('SIN','WSSS','Singapore','Asia/Singapore'),JFK=airport('JFK','KJFK','New York','America/New_York'),LHR=airport('LHR','EGLL','London','Europe/London');
const stamp=(date,time)=>`${date}T${time}:00Z`;

function diagnostics({requested,date,origin,resolved,operator,matchType='direct',routes,alternates=[]}){
  return {requested_ident:requested,requested_date:date,requested_origin:origin||null,requested_destination:null,identifiers_tried:[requested],matched_routes:routes,resolved_ident:resolved,operating_ident:resolved,operator,match_type:matchType,match_confidence:{score:matchType==='codeshare'?89:99,reasons:['Exact origin-local departure date',...(origin?['Origin hint matched']:[]),matchType==='codeshare'?'Requested code appears in FlightAware codeshares':'Flight identifier matched directly']},alternate_marketing_idents:alternates,freshness:{retrieved_at:stamp(date,'12:00'),latest_operational_timestamp:null,source:'FlightAware AeroAPI'},reason:null};
}

export function sq12Lookup(date,origin='NRT'){
  const selected={fa_flight_id:`fixture-sq12-${date}`,ident:'SIA12',ident_iata:'SQ12',operator:'Singapore Airlines',operator_iata:'SQ',operator_icao:'SIA',origin:NRT,destination:LAX,scheduled_out:stamp(date,'19:10'),estimated_out:stamp(date,'19:10'),scheduled_in:stamp(date,'05:50'),estimated_in:stamp(date,'05:50'),status:'Scheduled',aircraft_type:'A359',aircraft_type_friendly:'Airbus A350-900',terminal_origin:'1',gate_origin:'42'};
  const routes=[{origin:'SIN',destination:'NRT',scheduled_out:stamp(date,'01:00')},{origin:'NRT',destination:'LAX',scheduled_out:selected.scheduled_out}];
  return {flights:[selected],requested_date:date,resolved_ident:'SQ12',route_options:[{fa_flight_id:'fixture-sin-nrt',origin:SIN,destination:NRT,scheduled_out:stamp(date,'01:00')},{fa_flight_id:selected.fa_flight_id,origin:NRT,destination:LAX,scheduled_out:selected.scheduled_out}],diagnostics:diagnostics({requested:'SQ12',date,origin,resolved:'SQ12',operator:'SQ',routes}),delay_index:null,inbound_aircraft:null,flight_position:null,inbound_position:null,refreshed_at:stamp(date,'12:00')};
}

export function ba1511Lookup(date){
  const selected={fa_flight_id:`fixture-aa100-${date}`,ident:'AAL100',ident_iata:'AA100',operator:'American Airlines',operator_iata:'AA',operator_icao:'AAL',origin:JFK,destination:LHR,scheduled_out:stamp(date,'22:20'),estimated_out:stamp(date,'22:20'),scheduled_in:stamp(date,'06:25'),estimated_in:stamp(date,'06:25'),status:'Scheduled',aircraft_type:'B77W',aircraft_type_friendly:'Boeing 777-300ER',codeshares_iata:['BA1511']};
  const routes=[{origin:'JFK',destination:'LHR',scheduled_out:selected.scheduled_out}];
  return {flights:[selected],requested_date:date,resolved_ident:'BA1511',route_options:[{fa_flight_id:selected.fa_flight_id,origin:JFK,destination:LHR,scheduled_out:selected.scheduled_out}],diagnostics:diagnostics({requested:'BA1511',date,resolved:'AA100',operator:'AA',matchType:'codeshare',routes,alternates:['AA100']}),delay_index:null,inbound_aircraft:null,flight_position:null,inbound_position:null,refreshed_at:stamp(date,'12:00')};
}
