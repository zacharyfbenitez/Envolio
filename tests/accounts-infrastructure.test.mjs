import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
test('account tables require per-user RLS; queue and claims are server-only',async()=>{
 const sql=await readFile('supabase/migrations/20260914_accounts.sql','utf8');
 for(const table of ['saved_flights','notification_preferences','notification_outbox'])assert.match(sql,new RegExp(`alter table public.${table} enable row level security`));
 assert.equal((sql.match(/with check \(\(select auth.uid\(\)\)=user_id\)/g)||[]).length,2);
 assert.match(sql,/revoke all on public.notification_outbox from anon,authenticated/);
 assert.match(sql,/for update skip locked/);assert.match(sql,/unique\(user_id,flight_key,event_key\)/);assert.match(sql,/revoke all on function public.claim_notifications\(integer\) from public,anon,authenticated/);
});
test('worker refuses to deliver when not enabled',()=>{
 const r=spawnSync(process.execPath,['scripts/notification-worker.mjs'],{env:{PATH:process.env.PATH,ENABLE_ACCOUNT_EMAIL:'false'},encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/worker is disabled/);
});
