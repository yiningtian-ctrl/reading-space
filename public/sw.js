const CACHE='readspace-shell-__READSPACE_PWA_VERSION__';
const staticPath=p=>p.startsWith('/_next/static/')||p.startsWith('/icons/')||p.startsWith('/images/')||['/favicon.svg','/offline.html','/manifest.webmanifest'].includes(p);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const manifest=await fetch('/pwa-assets.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Missing shell manifest');return r.json();});
 const assets=manifest.assets.filter(p=>typeof p==='string'&&p.startsWith('/')&&!p.startsWith('//')&&staticPath(p));
 await cache.addAll([...new Set(['/', '/offline.html',...assets])]);
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('readspace-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')void self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // No account, OTP, sync, dictionary or imported-body API is ever intercepted/cached.
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok)return response;throw Error('Unavailable');}catch{return await caches.match(new Request(self.location.origin+'/'),{cacheName:CACHE})||await caches.match('/offline.html',{cacheName:CACHE})||Response.error();}})());return;
 }
 if(staticPath(url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;})());
});
