// One-way migration for browsers that previously installed Envolio's offline shell.
// No caching, fetch interception, installation UI, or new registrations.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prefix='disruption-shell-'+new URL(self.registration.scope).pathname+'-';
  for(const key of await caches.keys())if(key.startsWith(prefix))await caches.delete(key);
  await self.registration.unregister();
})()));
