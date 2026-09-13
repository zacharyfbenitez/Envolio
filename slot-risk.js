// Transparent uncalibrated lower bound on the risk index, not a proven probability.
// Max(base, slot floor) avoids adding the same ATC delay via airport/schedule twice.
export function applySlotRisk(index,flight,slot,now=Date.now()){
 if(!index||flight.actual_out||flight.actual_off||flight.actual_in||flight.cancelled||flight.schedule_only||!['assigned','revised'].includes(slot?.status)||!['EDCT','CTOT'].includes(slot.kind)||!['FAA','EUROCONTROL'].includes(slot.authority))return index;
 if((slot.authority==='FAA')!==(slot.kind==='EDCT'))return index;
 const assigned=Date.parse(slot.assigned_time),verified=Date.parse(slot.verified_at),gate=Date.parse(flight.scheduled_out),off=Date.parse(flight.scheduled_off);
 if(![assigned,verified,gate].every(Number.isFinite)||now-verified>300000||verified>now+60000||assigned<now-900000||Math.abs(assigned-gate)>86400000)return index;
 const taxi=(off-gate)/60000,known=Number.isFinite(taxi)&&taxi>=0&&taxi<=90;
 const reference=known?off:gate+30*60000,late=Math.max(0,(assigned-reference)/60000);
 if(late<=0)return index;
 const anchors=[[0,0],[15,60],[30,75],[60,85],[120,95],[180,97]];
 let floor=97;for(let i=1;i<anchors.length;i++){const [x,y]=anchors[i],[px,py]=anchors[i-1];if(late<=x){floor=Math.round(py+(y-py)*(late-px)/(x-px));break;}}
 const baseline=index.score;index.score=Math.max(baseline,floor);index.on_time_probability=100-index.score;index.level=index.score>=65?'high':index.score>=35?'elevated':'low';
 const detail=`The ${slot.authority} takeoff slot is ${Math.round(late)} minutes later than ${known?'the published scheduled takeoff':'scheduled gate departure plus a 30-minute taxi allowance'}. This strongly raises concern about a late departure, but a plane can wait after leaving the gate and slots can change.`;
 index.slot_adjustment={baseline_score:baseline,risk_floor:floor,applied_points:index.score-baseline,delay_minutes:Math.round(late),method:'Maximum of existing index and a magnitude-based ATC-slot heuristic; never summed',evidence_label:'Official assignment + heuristic',detail,source_detail:{authority:slot.authority,kind:slot.kind,provider:slot.provider,source_url:slot.source_url||null,message_id:slot.message_id||null,assigned_time:slot.assigned_time,verified_at:slot.verified_at,scheduled_out:flight.scheduled_out,scheduled_off:known?flight.scheduled_off:null,taxi_allowance_minutes:known?taxi:30,taxi_basis:known?'Published scheduled gate-to-takeoff interval':'Heuristic; not measured taxi time',anchors,calibrated:false}};
 index.operational_warnings=[{kind:'atc_slot',title:'A later takeoff slot raises departure risk',detail,source:slot.provider||slot.authority},...(index.operational_warnings||[])];
 index.methodology+=' ATC slot adjustment uses max(existing score, unvalidated magnitude-based floor). Gate-versus-takeoff timing uses published scheduled times or an explicit 30-minute taxi allowance; this is not evidence of a guaranteed gate delay.';
 return index;
}
