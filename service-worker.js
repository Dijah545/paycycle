const CACHE='paycycle-budget-full-v1';
const ASSETS=['./','./index.html','./css/styles.css','./js/app.js','./js/database.js','./js/paycycle.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(cached=>{
    const network=fetch(e.request).then(resp=>{if(e.request.method==='GET'&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return resp}).catch(()=>cached);
    return cached||network;
  }));
});