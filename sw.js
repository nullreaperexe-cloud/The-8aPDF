/* Native Web Push + versioned static asset caching. HTML, APIs, PDFs and user data are never cached. */
'use strict';
const PUSH_WORKER_VERSION = 'lockscreen-v2';
async function reportDisplay(token, stage, error) {
  if (typeof token !== 'string' || token.length > 1200) return;
  try {
    const response = await fetch('https://uumqvvsfqwpwtwerdylv.supabase.co/functions/v1/school-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'receipt', token, stage, error, workerVersion: PUSH_WORKER_VERSION }),
      signal: AbortSignal.timeout(8000)
    });
    await response.body?.cancel();
  } catch { /* Reporting must never prevent the notification from appearing. */ }
}
function safePath(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  if(typeof caches!=='undefined'){
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('8apdf-static-')&&k!==STATIC_ASSET_CACHE).map(k=>caches.delete(k)));
  }
  await self.clients.claim();
})()));

/* Cache only explicitly versioned code/style resources, never HTML, API, chat, PDF or personal data. */
const STATIC_ASSET_CACHE='8apdf-static-v1';
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode==='navigate')return;
 let url;
 try{url=new URL(request.url)}catch{return}
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||
    !/\.(?:js|css)$/i.test(url.pathname)||!url.searchParams.has('v'))return;
 event.respondWith((async()=>{
  if(typeof caches==='undefined')return fetch(request);
  try{
   const cache=await caches.open(STATIC_ASSET_CACHE);
   const saved=await cache.match(request);
   if(saved){
    event.waitUntil(fetch(request).then(res=>{
     if(res.ok&&res.type!=='opaque')return cache.put(request,res.clone());
    }).catch(()=>{}));
    return saved;
   }
   const response=await fetch(request);
   if(response.ok&&response.type!=='opaque')event.waitUntil((async()=>{
    await cache.put(request,response.clone());
    const keys=await cache.keys();
    await Promise.all(keys.length>100?keys.slice(0,keys.length-100).map(key=>cache.delete(key)):[]);
   })().catch(()=>{}));
   return response;
  }catch{return fetch(request)}
 })());
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; }
    catch { payload = { body: event.data?.text() || 'A new school update is available.' }; }
    if (typeof payload !== 'object' || Array.isArray(payload)) payload = {};
    const chatRelated = /^\/chat(?:\/|$)/.test(safePath(payload.url)) || String(payload.type || payload.kind || payload.tag || '').toLowerCase().includes('chat');
    const title = chatRelated ? '8aPDF · New message' : String(payload.title || '8aPDF school update').slice(0, 180);
    const options = {
      body: chatRelated ? 'Unlock Friends Chat to read your message.' : String(payload.body || 'New PDFs or school messages are ready.').slice(0, 250),
      icon: '/assets/app-icon-192.png', badge: '/assets/app-icon-192.png',
      tag: String(payload.tag || '8apdf-school-update').slice(0, 100),
      renotify: true, silent: false, vibrate: [200, 100, 200], requireInteraction: true,
      data: { path: safePath(payload.url) }
    };
    try {
      await self.registration.showNotification(title, options);
    } catch {
      // Older browsers may reject an optional presentation setting. Still show
      // the native notification with the universally supported options.
      try { await self.registration.showNotification(title, { body: options.body, tag: options.tag, data: options.data }); }
      catch (error) { await reportDisplay(payload.receiptToken, 'error', error?.name || 'NotificationError'); return; }
    }
    await reportDisplay(payload.receiptToken, 'shown');
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = safePath(event.notification.data?.path);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      // Navigation also works if the focused tab has not loaded the SPA bridge.
      try { const target = await existing.navigate(path); if (target) { await target.focus(); return; } }
      catch { /* A disappearing tab is handled by opening a fresh window. */ }
    }
    await self.clients.openWindow(path);
  })());
});
self.addEventListener('pushsubscriptionchange', event => {
  // The authenticated page repairs rotated subscriptions on the next open.
  // Never embed a session token or private VAPID key in the service worker.
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(windows => {
    for (const client of windows) client.postMessage({ type: '8apdf:push-subscription-changed' });
  }));
});
