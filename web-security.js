// Single-instance guardrails; production should also enforce edge/provider budgets.
export function apiGuard({limit=90,writeLimit=12,windowMs=60_000,maxKeys=5000,now=Date.now}={}) {
  const clients=new Map();
  return (req,res,next)=>{
    const stamp=now(),key=req.ip||req.socket?.remoteAddress||'unknown';
    let item=clients.get(key);
    if(!item||item.until<=stamp){
      if(clients.size>=maxKeys){for(const [k,v]of clients)if(v.until<=stamp)clients.delete(k);}
      if(clients.size>=maxKeys&&!clients.has(key))return res.status(503).json({error:'Search is busy. Please try again shortly.'});
      item={until:stamp+windowMs,total:0,writes:0};clients.set(key,item);
    }
    item.total++;if(!['GET','HEAD','OPTIONS'].includes(req.method))item.writes++;
    res.set('Cache-Control','no-store');
    if(item.total>limit||item.writes>writeLimit){res.set('Retry-After',String(Math.max(1,Math.ceil((item.until-stamp)/1000))));return res.status(429).json({error:'Too many requests. Please wait a minute and try again.'});}
    next();
  };
}
export function publicFeedback(body={}) {
  // Never persist arbitrary client text, contact details or a pasted booking.
  return {type:body.type==='wrong_match'?'wrong_match':'lookup_feedback',ident:String(body.ident||'').slice(0,12),reason:body.type==='wrong_match'?'wrong_match':'lookup_feedback'};
}
