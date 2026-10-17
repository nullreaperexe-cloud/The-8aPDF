(() => {
  'use strict';
  const endpoint = 'https://uumqvvsfqwpwtwerdylv.supabase.co/functions/v1/school-push';
  const key = '8apdf_phone_notifications_v1', optInKey = key + '_enabled';
  let registrationPromise = null, enabling = null, generation = 0;
  let preferences = { pdfs: true, announcements: true, testsOnly: false };
  const stored = name => { try { return localStorage.getItem(name); } catch { return null; } };
  const persist = (name, value) => { try { localStorage.setItem(name, value); } catch { /* Private browsing may disable storage. */ } };
  try { preferences = { ...preferences, ...JSON.parse(stored(key) || '{}') }; } catch { /* Preserve defaults. */ }
  const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const changed = () => document.dispatchEvent(new Event('8apdf:push-changed'));

  async function fetchJSON(options = {}) {
    const response = await fetch(endpoint, { ...options, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'The notification service is temporarily unavailable.');
    return data;
  }
  async function worker() {
    if (!supported()) throw Error('Background notifications are unavailable here. On iPhone, add 8aPDF to your Home Screen and open it there.');
    // One registration per page; clear a rejected promise so users can retry.
    registrationPromise ||= navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('The notification worker did not become ready. Please retry.')), 15000);
        navigator.serviceWorker.ready.then(reg => { clearTimeout(timer); resolve(reg); }, error => { clearTimeout(timer); reject(error); });
      })).catch(error => { registrationPromise = null; throw error; });
    return registrationPromise;
  }
  async function request(action, subscription, nextPreferences = preferences) {
    if (!window.__8apdfGetSocialClient) throw Error('Your device session is still loading. Please retry.');
    const { db } = await window.__8apdfGetSocialClient();
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) throw Error('Your device session is unavailable. Reopen 8aPDF and retry.');
    return fetchJSON({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ action, subscription: subscription?.toJSON ? subscription.toJSON() : subscription, preferences: nextPreferences }) });
  }
  function bytes(base64) {
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }
  async function subscribe(create = true) {
    const started = generation;
    const reg = await worker();
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription && !create) return null;
    if (!subscription) {
      const config = await fetchJSON();
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(config.publicKey) });
    }
    await request('subscribe', subscription);
    if (started !== generation && stored(optInKey) === 'false') {
      await request('unsubscribe', subscription); await subscription.unsubscribe(); return null;
    }
    persist(optInKey, 'true'); changed();
    return subscription;
  }
  async function status() {
    if (!supported()) return { supported: false, subscribed: false, permission: 'unsupported', preferences };
    const reg = await worker(), subscription = await reg.pushManager.getSubscription();
    let subscribed = false, latestDelivery = null;
    if (subscription && Notification.permission === 'granted' && stored(optInKey) !== 'false') {
      const server = await request('status', subscription);
      latestDelivery = server.latestDelivery || null;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint));
      const id = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
      const own = server.subscriptions?.find(item => item.id === id);
      subscribed = !!own;
      if (own) preferences = { ...preferences, ...own.preferences };
    }
    // Fetch fresh health: caching config forever hid stalled school ingestion.
    const config = await fetchJSON();
    return { supported: true, subscribed, pendingUnsubscribe: !!subscription && stored(optInKey) === 'false', permission: Notification.permission, preferences, lastChecked: config.lastChecked, intervalMinutes: config.intervalMinutes, latestDelivery };
  }
  async function enable() {
    if (!supported()) throw Error('Background notifications are unavailable here. On iPhone, open 8aPDF from your Home Screen.');
    if (enabling) return enabling;
    // Request permission directly from the click, before any network await.
    const permission = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    enabling = (async () => {
      const result = await permission;
      if (result !== 'granted') throw Error(result === 'denied' ? 'Notifications are blocked. Allow them in your browser’s site settings.' : 'Notifications were not enabled. You can try again.');
      generation++; await subscribe(); return status();
    })().finally(() => { enabling = null; });
    return enabling;
  }
  async function disable() {
    const reg = await worker(), subscription = await reg.pushManager.getSubscription();
    // Keep explicit opt-out across reloads, even if a later network call fails.
    generation++; persist(optInKey, 'false');
    if (subscription) {
      // Keep the browser subscription if the server delete fails, so retrying
      // Disable can still identify and remove the server-side record.
      await request('unsubscribe', subscription);
      if (!await subscription.unsubscribe()) throw Error('The browser could not remove this subscription. Please retry.');
    }
    changed(); return status();
  }
  async function savePreferences(next) {
    const updated = { ...preferences, ...next };
    if (supported() && Notification.permission === 'granted' && stored(optInKey) !== 'false') {
      const reg = await worker(), subscription = await reg.pushManager.getSubscription();
      if (subscription) await request('subscribe', subscription, updated);
    }
    preferences = updated; persist(key, JSON.stringify(preferences)); return status();
  }
  async function test(closed = false) {
    const reg = await worker(), subscription = await reg.pushManager.getSubscription();
    if (!subscription || stored(optInKey) === 'false') throw Error('Enable notifications first.');
    return request(closed ? 'test-closed' : 'test', subscription);
  }
  async function repair() {
    if (!supported() || Notification.permission !== 'granted') return enable();
    const reg = await worker();
    await reg.update();
    // A repair is an explicit user action. Replace stale endpoint/key material
    // while retaining the user's saved content preferences.
    generation++;
    const old = await reg.pushManager.getSubscription();
    if (old) {
      await request('unsubscribe', old);
      if (!await old.unsubscribe()) throw Error('The old subscription could not be renewed. Please retry.');
    }
    await subscribe();
    return status();
  }
  window.__8apdfPush = { status, enable, disable, repair, savePreferences, test, testClosed: () => test(true) };
  if (supported()) {
    worker().then(() => {
      // Permission alone is not a subscription or consent to re-enable it.
      if (Notification.permission === 'granted' && stored(optInKey) !== 'false') return subscribe(stored(optInKey) === 'true');
    }).catch(error => console.warn('Background notifications:', error.message));
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === '8apdf:push-subscription-changed' && stored(optInKey) === 'true') {
        subscribe().catch(error => console.warn('Notification subscription renewal:', error.message));
      }
    });
  }
})();
