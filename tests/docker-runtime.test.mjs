import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,copyFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {build} from 'vite';

test('Docker runtime includes every backend dependency and starts without native projects',{timeout:120000},async t=>{
 const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'envolio-runtime-'));
 const docker=await readFile('Dockerfile','utf8'),runtime=docker.split('FROM node:22-alpine\n')[1];
 const files=[...runtime.matchAll(/\/app\/([\w-]+\.js)/g)].map(m=>m[1]);
 const seen=new Set();
 async function check(file){if(seen.has(file))return;seen.add(file);assert.ok(files.includes(file),`Docker runtime omits ${file}`);const source=await readFile(file,'utf8');for(const m of source.matchAll(/from ['"]\.\/([^'"]+\.js)['"]/g))await check(m[1]);}
 await check('server.js');
 for(const file of new Set(['package.json',...files]))await copyFile(file,path.join(dir,file));
 await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
 await build({configFile:path.join(root,'vite.config.js'),base:'/',build:{outDir:path.join(dir,'dist'),emptyOutDir:true}});
 const html=await readFile(path.join(dir,'dist/index.html'),'utf8');assert.doesNotMatch(html,/rel="manifest"/);assert.match(html,/envolio.travel/);
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await new Promise(r=>socket.once('listening',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{PATH:process.env.PATH,NODE_ENV:'production',PUBLIC_BASE:'/',PORT:String(port),ENABLE_ALERT_SUBSCRIPTIONS:'false'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);t.after(()=>child.kill('SIGTERM'));
 const base=`http://127.0.0.1:${port}`;let healthy=false;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{const r=await fetch(base+'/healthz');if(r.ok){assert.equal((await r.json()).service,'envolio');healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(healthy,logs);
 assert.equal((await fetch(base)).status,200);
 const missing=await fetch(base+'/api/not-real');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/json/);
 assert.equal((await fetch(base+'/api/telemetry/summary')).status,404);
 const alert=await fetch(base+'/api/alerts/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(alert.status,503);
 assert.doesNotMatch(logs,/ERR_MODULE_NOT_FOUND/);
 t.diagnostic('Verified isolated Docker runtime file set, not a Docker-engine build.');
});
