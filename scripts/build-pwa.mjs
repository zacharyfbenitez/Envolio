import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=(await readdir('dist/assets')).map(name=>`assets/${name}`);
const shell=await readFile('dist/index.html','utf8');
const version=createHash('sha256').update(shell+JSON.stringify(assets)).digest('hex').slice(0,16);
const files=[...assets,'manifest.webmanifest','envolio-passport.svg','envolio-passport-192.png','envolio-passport-512.png','envolio-passport-maskable-512.png','envolio-passport-apple.png'];
await writeFile('dist/sw.js', `
const ROOT=new URL('./',self.location.href).href;
const PREFIX='disruption-shell-'+new URL(ROOT).pathname+'-';
const CACHE=PREFIX+'${version}';
const FILES=${JSON.stringify(files)}.map(path=>new URL(path,ROOT).href);
async function scopedShell(response){
 let html=await response.text();
 html=html.replace(/(src|href)="\\/(?!\\/)/g,(_,attr)=>attr+'="'+ROOT);
 const path=new URL(ROOT).pathname.slice(1);
 if(path)html=html.split(ROOT+path).join(ROOT);
 return new Response(html,{headers:{'Content-Type':'text/html'}});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(FILES);
 const response=await fetch(ROOT,{cache:'reload'});
 if(!response.ok)throw new Error('App shell unavailable');
 await cache.put(ROOT,await scopedShell(response));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||!url.href.startsWith(ROOT)||url.pathname.includes('/api/'))return;
 if(req.mode==='navigate')event.respondWith((async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{const response=await fetch(req,{signal:controller.signal});if(!response.ok)throw new Error('Navigation unavailable');return await scopedShell(response);}
  catch{return(await caches.open(CACHE)).match(ROOT);}
  finally{clearTimeout(timer);}
 })());
 else if(FILES.includes(url.href))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(req))||fetch(req)));
});
`);
console.log(`PWA shell ${version}: ${files.length} local assets. APIs excluded.`);
