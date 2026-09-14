import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chown,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawnSync} from 'node:child_process';

test('real PostgreSQL: account isolation, friends, blocks, private contacts and opt-in statistics',{timeout:120000},async t=>{
 if(spawnSync('postgres',['--version']).status!==0){t.skip('PostgreSQL binaries are required for real RLS verification');return;}
 const dir=await mkdtemp(path.join(tmpdir(),'envolio-rls-'));
 const uid=process.getuid?.()===0?Number(spawnSync('id',['-u','postgres'],{encoding:'utf8'}).stdout.trim()):process.getuid();
 const gid=process.getuid?.()===0?Number(spawnSync('id',['-g','postgres'],{encoding:'utf8'}).stdout.trim()):process.getgid();
 if(process.getuid?.()===0)await chown(dir,uid,gid);
 const run=(bin,args,input)=>spawnSync(bin,args,{uid,gid,encoding:'utf8',input,timeout:30000,maxBuffer:2e6});
 const init=run('initdb',['-D',dir+'/data','--auth=trust','--no-locale']);assert.equal(init.status,0,init.stderr);
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await new Promise(r=>socket.once('listening',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 t.after(()=>run('pg_ctl',['-D',dir+'/data','-m','fast','-w','stop']));
 const started=run('pg_ctl',['-D',dir+'/data','-l',dir+'/log','-o',`-F -k ${dir} -p ${port} -h 127.0.0.1 -c shared_buffers=16MB -c max_connections=20`,'-w','start']);assert.equal(started.status,0,started.stderr);
 function sql(query,{as,fail=false,role='authenticated'}={}){
  const prefix=as?`SET ROLE ${role}; SET "request.jwt.claim.sub"='${as}';`:(role==='anon'?'SET ROLE anon;':'');
  const r=run('psql',['-X','-q','-A','-t','-h',dir,'-p',String(port),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],prefix+query);
  if(fail){assert.notEqual(r.status,0,'Expected authorization failure: '+query);return r.stderr;}
  assert.equal(r.status,0,r.stderr+'\n'+query);return r.stdout.trim();
 }
 sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated;`);
 for(const file of ['20260914_accounts.sql','20260914010000_profiles_social.sql','20260914020000_travel_statistics.sql'])sql(await readFile('supabase/migrations/'+file,'utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 sql(`insert into auth.users values('${a}','a@example.test',now()),('${b}','b@example.test',now()),('${c}','c@example.test',now());`);
 const unverified='44444444-4444-4444-8444-444444444444';
 sql(`insert into auth.users values('${unverified}','unverified@example.test',null);`);
 assert.match(sql(`select public.complete_traveler_profile('{"handle":"unverified","display_name":"Test","home_airport":"JFK","favorite_airline":"Porter","favorite_aircraft":"A220"}', '+12125550123')`,{as:unverified,fail:true}),/Verify your email/);
 for(const [id,handle]of [[a,'traveler_a'],[b,'traveler_b'],[c,'traveler_c']])sql(`select (public.complete_traveler_profile('{"handle":"${handle}","display_name":"${handle}","home_airport":"JFK","favorite_airline":"Porter Airlines","favorite_aircraft":"Airbus A220","discoverable":true}', '+12125550123')).handle;`,{as:id});
 assert.equal(sql('select count(*) from public.account_contacts',{as:a}),'1');
 assert.equal(sql(`select count(*) from public.traveler_profiles where user_id='${b}'`,{as:a}),'0');
 assert.match(sql(`update public.account_contacts set user_id='${b}' where user_id='${a}'`,{as:a,fail:true}),/row-level security|duplicate key/);
 sql(`select * from public.account_contacts`,{role:'anon',fail:true});sql(`select public.find_traveler('traveler_b')`,{role:'anon',fail:true});
 const preview=JSON.parse(sql(`select public.find_traveler('traveler_b')`,{as:a}));assert.equal(preview.can_view,false);assert.equal(preview.phone,undefined);assert.equal(preview.home_airport,undefined);
 assert.equal(sql(`select public.request_friend('${b}')`,{as:a}),'pending');
 const request=sql(`select id from public.friendships where requester_id='${a}'`,{as:b});
 sql(`select public.respond_friend('${request}',true)`,{as:a,fail:true});sql(`select public.respond_friend('${request}',true)`,{as:c,fail:true});
 sql(`select public.respond_friend('${request}',true)`,{as:b});
 assert.equal(sql(`select count(*) from public.traveler_profiles where user_id='${b}'`,{as:a}),'1');
 assert.equal(sql(`select count(*) from public.account_contacts where user_id='${b}'`,{as:a}),'0');
 sql(`insert into public.saved_flights values('${b}','BA100', '{"ident":"BA100"}',now())`,{as:b});assert.equal(sql(`select count(*) from public.saved_flights`,{as:a}),'0');
 sql(`insert into public.travel_log(user_id,flight_number,travel_date,origin,destination,airline,outcome,source,scheduled_departure,actual_departure) values('${b}','PD604',current_date-1,'LGA','YYZ','Porter Airlines','taken','manual',now()-interval '1 day',now()-interval '1 day'+interval '20 minutes')`,{as:b});
 assert.equal(sql(`select count(*) from public.travel_log`,{as:a}),'0');assert.equal(sql(`select public.traveler_statistics('${b}','all')`,{as:a}),'');
 sql(`update public.traveler_profiles set share_stats=true where user_id='${b}'`,{as:b});
 const stats=JSON.parse(sql(`select public.traveler_statistics('${b}','all')`,{as:a}));assert.equal(stats.taken,1);assert.equal(stats.on_time_percent,0);assert.equal(stats.airports,2);assert.equal(stats.departure_observations,1);assert.equal(stats.airtime_minutes,null);
 assert.equal(sql(`select public.shared_travel_history('${b}')`,{as:a}),'');
 sql(`update public.traveler_profiles set share_history=true where user_id='${b}'`,{as:b});const history=JSON.parse(sql(`select public.shared_travel_history('${b}')`,{as:a}));assert.equal(history[0].flight_number,'PD604');assert.equal(history[0].actual_departure,undefined);
 sql(`select public.block_traveler('${a}',true)`,{as:b});assert.equal(sql(`select public.find_traveler('traveler_b')`,{as:a}),'');assert.equal(sql(`select public.traveler_statistics('${b}','all')`,{as:a}),'');assert.equal(sql(`select count(*) from public.friendships`,{as:a}),'0');
 sql(`select public.request_friend('${b}')`,{as:a,fail:true});
 sql(`select public.block_traveler('${a}',false)`,{as:b});sql(`select public.request_friend('${b}')`,{as:a});
 const second=sql(`select id from public.friendships`,{as:a});sql(`select public.respond_friend('${second}',false)`,{as:b});sql(`select public.request_friend('${b}')`,{as:a,fail:true});
 sql(`insert into public.friendships(requester_id,recipient_id,status) values('${a}','${c}','accepted')`,{as:a,fail:true});
 sql(`insert into public.notification_outbox(user_id,flight_key,event_key,event_type,payload) values('${a}','x','x','delay','{}')`,{as:a,fail:true});
 sql(`select public.claim_notifications(20)`,{as:a,fail:true});
 t.diagnostic('Actual PostgreSQL RLS and functions tested with synthetic auth identities; this does not test hosted Supabase email/SMTP.');
});
