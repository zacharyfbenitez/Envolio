import React,{useState} from 'react';
import {Plane,CheckCircle2,Clock3,XCircle,ArrowRight,MapPin} from 'lucide-react';
import './scenario-showcase.css';
const scenarios=[
 {id:'on-time',label:'On time',subtitle:'Ready to go',Icon:CheckCircle2,headline:'Your plane is at the gate.',status:'On time',depart:'3:30 PM',arrive:'4:55 PM',change:'No departure delay reported',reason:'Your incoming aircraft has arrived. Boarding is expected at 3:00 PM.',action:'Head to your gate',advice:'Keep an eye on the airport screens and listen for boarding announcements.',steps:['Plane arrived','Boarding next','Depart 3:30'],gate:'Gate 42',chip:'Aircraft arrived'},
 {id:'delayed',label:'Delayed',subtitle:'Know what changed',Icon:Clock3,headline:'A late plane. A clearer plan.',status:'Delayed 45 min',depart:'4:15 PM',arrive:'5:40 PM',change:'Was 3:30 PM · now expected 4:15 PM',reason:'Your incoming plane is running late. Boarding may move while the aircraft is prepared.',action:'Stay near your gate',advice:'Keep your original check-in time. If you have a connection, check its departure time now.',steps:['Inbound late','Turnaround','Depart 4:15'],gate:'Gate 42',chip:'Incoming plane late'},
 {id:'cancelled',label:'Cancelled',subtitle:'Find your next step',Icon:XCircle,headline:'Cancelled doesn’t mean stranded.',status:'Flight cancelled',depart:'Cancelled',arrive:'—',change:'This flight will not operate',reason:'The airline has cancelled this flight. The next priority is confirming another way to your destination.',action:'Ask about rebooking',advice:'Check the airline’s app or speak to an agent about another flight. Confirm the new booking before leaving.',steps:['Cancelled','Contact airline','New flight'],gate:'Gate no longer applies',chip:'Rebooking needed'}
];
export default function ScenarioShowcase(){
 const [selected,setSelected]=useState('delayed');const s=scenarios.find(x=>x.id===selected),Icon=s.Icon;
 return <section className={`home-showcase scenario-showcase scenario-${s.id}`} aria-label="Envolio product preview">
  <div className="showcase-heading"><span>INTERACTIVE EXAMPLE · NOT LIVE FLIGHT DATA</span><h2>Whatever changes, know your next step.</h2><p>Try a scenario. See how Envolio helps you make sense of it.</p></div>
  <div className="scenario-choices" role="group" aria-label="Choose an example flight situation">{scenarios.map(({id,label,subtitle,Icon:ChoiceIcon})=><button type="button" key={id} className={`scenario-choice choice-${id}`} aria-pressed={selected===id} aria-controls="scenario-preview" onClick={()=>setSelected(id)}><ChoiceIcon size={20}/><span><b>{label}</b><small>{subtitle}</small></span></button>)}</div>
  <div id="scenario-preview" className="scenario-preview" aria-live="polite" aria-atomic="true">
   <article className="scenario-flight" key={s.id}><div className="scenario-status"><span><Icon size={18}/>{s.status}</span><small>Example flight</small></div><h3>{s.headline}</h3>
    <div className="scenario-airports"><div><strong>JFK</strong><span>New York</span><b>{s.depart}</b></div><div className="scenario-route-line"><span/>{s.id==='cancelled'?<XCircle size={24}/>:<Plane size={24}/>}<span/></div><div><strong>BOS</strong><span>Boston</span><b>{s.arrive}</b></div></div>
    <p className="scenario-time-change">{s.change}</p><div className="scenario-chips"><span><Plane size={15}/>{s.chip}</span><span><MapPin size={15}/>{s.gate}</span></div>
    <ol className="scenario-timeline" aria-label="Example next steps">{s.steps.map((step,i)=><li key={step}><span>{i===0?<Icon size={14}/>:i+1}</span><b>{step}</b></li>)}</ol>
   </article>
   <aside className="scenario-guidance"><span className="scenario-kicker">WHAT SHOULD I DO?</span><h3>{s.action}</h3><p>{s.advice}</p><div className="scenario-why"><b>Why?</b><p>{s.reason}</p></div><small>Illustrative scenario. Your flight’s updates and options may differ.</small></aside>
  </div>
  <button type="button" className="scenario-try" onClick={()=>{const input=document.querySelector('#flight-query');input?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});input?.focus({preventScroll:true});}}>Now check your flight <ArrowRight size={17}/></button>
 </section>;
}
