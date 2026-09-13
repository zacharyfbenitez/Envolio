export function travelerChance(index, future=false, cached=false) {
 if(future||cached)return {label:future?'Too early for a delay forecast':'Live outlook unavailable',detail:future?'Check back closer to departure. Your published times are still useful for planning.':'Refresh for current conditions. Saved information may have changed.',percent:null,tone:'neutral'};
 const route=index?.calibration?.route;
 if(index?.calibration?.material_signal&&Number.isFinite(index.score))return {label:'Estimated chance of a delay',percent:Math.round(index.score),tone:index.score>=50?'caution':'neutral',detail:'Chance of leaving at least 15 minutes late. An estimate, not a guarantee.'};
 if(route?.sample_size>=3&&Number.isFinite(route.delay_rate))return {label:'How often this route ran late',percent:Math.round(route.delay_rate),tone:'neutral',detail:`Of ${route.sample_size} recent comparable flights, ${Math.round(route.delay_rate)}% left at least 15 minutes late. This is past performance—not a prediction for your flight.`};
 return {label:'Not enough history yet',percent:null,tone:'neutral',detail:'We can show reported flight updates, but there isn’t enough evidence for a useful delay percentage.'};
}

export function weatherWords(summary) {
 if(!summary)return 'A forecast for your flight time isn’t available yet.';
 const words={TSRA:'thunderstorms with rain',SHRA:'rain showers',SN:'snow',RA:'rain',DZ:'drizzle',FG:'fog',BR:'mist',HZ:'haze',TS:'thunderstorms',SHSN:'snow showers',FZRA:'freezing rain',CAVOK:'good visibility with no significant weather reported',NSW:'no significant weather reported'};
 return summary.replace(/\b(?:TSRA|SHRA|SHSN|FZRA|CAVOK|NSW|SN|RA|DZ|FG|BR|HZ|TS)\b/g,m=>words[m]).replace(/wind (\d+(?:\.\d+)?) kt/gi,(_,n)=>`wind around ${Math.round(Number(n)*1.852)} km/h (${Math.round(Number(n)*1.15078)} mph)`);
}
