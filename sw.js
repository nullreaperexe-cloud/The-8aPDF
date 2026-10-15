/* Native Web Push. No app-shell cache, so new deployments remain visible. */
'use strict';
function safePath(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; }
    catch { payload = { body: event.data?.text() || 'A new school update is available.' }; }
    if (typeof payload !== 'object' || Array.isArray(payload)) payload = {};
    await self.registration.showNotification(String(payload.title || '8aPDF school update').slice(0, 180), {
      body: String(payload.body || 'New PDFs or school messages are ready.').slice(0, 250),
      icon: '/assets/app-icon-192.png', badge: '/assets/app-icon-192.png',
      tag: String(payload.tag || '8apdf-school-update').slice(0, 100),
      renotify: false, data: { path: safePath(payload.url) }
    });
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
