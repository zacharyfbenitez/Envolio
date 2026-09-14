// Run as a scheduled/background service, never imported by the web client.
import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','ALERT_FROM_EMAIL'];
if(process.env.ENABLE_ACCOUNT_EMAIL!=='true'||required.some(k=>!process.env[k]))throw Error('Account email worker is disabled or missing server-side configuration.');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:jobs,error}=await db.rpc('claim_notifications',{batch_size:20});if(error)throw Error('Unable to claim notification jobs.');
for(const job of jobs){
 try{
  const {data:p,error:preferenceError}=await db.from('notification_preferences').select('email_enabled,consent_at,events').eq('user_id',job.user_id).eq('flight_key',job.flight_key).maybeSingle();
  if(preferenceError)throw Error('Preference check failed');
  if(!p?.email_enabled||!p.consent_at||p.events?.[job.event_type]!==true){const {error}=await db.from('notification_outbox').update({state:'cancelled'}).eq('id',job.id);if(error)throw error;continue;}
  const {data,error:userError}=await db.auth.admin.getUserById(job.user_id);if(userError)throw userError;
  if(!data.user?.email_confirmed_at||!data.user.email)throw Error('Verified recipient unavailable');
  const title=String(job.payload.title||'Your flight update').replace(/[\r\n]/g,' ').slice(0,160),text=String(job.payload.text||'').slice(0,4000);
  if(!text)throw Error('Empty message');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`envolio-${job.id}`},body:JSON.stringify({from:process.env.ALERT_FROM_EMAIL,to:data.user.email,subject:title,text:`${text}\n\nManage or stop flight emails in your Envolio notification settings: https://envolio.travel/dashboard\nEnvolio estimates are not airline instructions. Verify changes with your airline.`})});
  if(!response.ok)throw Error('Email provider did not accept message');
  const {error}=await db.from('notification_outbox').update({state:'sent',sent_at:new Date().toISOString()}).eq('id',job.id);if(error)throw error;
 }catch{
  // Never log email addresses, message content, credentials or upstream response bodies.
  const {error}=await db.from('notification_outbox').update({state:job.attempts>=5?'failed':'pending',available_at:new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString()}).eq('id',job.id);
  if(error)process.exitCode=1;
 }
}
console.log(JSON.stringify({processed:jobs.length,delivery:'email',note:'Review failed outbox rows; no recipient data logged.'}));
