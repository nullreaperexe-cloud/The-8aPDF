(() => {
  'use strict';
  const $ = id => document.getElementById(id), api = () => parent.__8apdfPush;
  let busy = false;
  function deliveryText(state) {
    if (!state.subscribed) return '';
    const d = state.latestDelivery;
    if (!d) return 'Use the closed-site test to check background delivery on this phone.';
    if (d.notification_shown_at) return 'Browser confirmed notification display at ' + new Date(d.notification_shown_at).toLocaleString() + '. Lock-screen visibility follows your phone settings.';
    if (d.receipt_error) return 'The browser received the push but could not display it (' + d.receipt_error + '). Repair this device and check notification permissions.';
    if (d.status === 'pending') return 'A notification is queued for this device. Close the website for the background test, then return to refresh this status.';
    if (d.status === 'failed') return 'The push service could not accept this notification after retries. Repair this device and run the closed-site test.';
    if (d.receipt_id && d.provider_accepted_at) return 'Push service accepted the latest notification. Browser display is not confirmed yet. If the alert stays missing, repair this device and check the phone settings below.';
    return 'Earlier notifications were accepted by the push service. Run a new closed-site test to verify browser display.';
  }
  function present(state) {
    $('pushState').textContent = !state.supported ? 'This browser needs a supported installed web app. See the iPhone steps below.' : state.subscribed ? 'Enabled on this device · background push is registered' : state.permission === 'denied' ? 'Blocked by this browser. Allow 8aPDF notifications in site settings.' : 'Not enabled yet. Choose Enable and allow notifications.';
    if (state.supported && (!state.lastChecked || Date.now() - Date.parse(state.lastChecked) > 5 * 60 * 1000)) $('pushState').textContent += ' · The background feed has not completed a recent check. Updates may be delayed.';
    $('pushDelivery').textContent = deliveryText(state);
    for (const [id, key] of [['pushPdfs', 'pdfs'], ['pushAnnouncements', 'announcements'], ['pushTestsOnly', 'testsOnly']]) $(id).checked = !!state.preferences[key];
    $('pushTest').disabled = !state.subscribed;
    $('pushTestClosed').disabled = !state.subscribed;
    $('pushRepair').disabled = !state.supported;
    $('pushDisable').disabled = !state.subscribed && !state.pendingUnsubscribe;
    $('pushEnable').disabled = state.subscribed || !state.supported;
  }
  async function refresh() {
    if (busy) return;
    try { if (!api()) throw Error('Notification service is loading'); present(await api().status()); }
    catch (e) { $('pushState').textContent = e.message; }
  }
  async function act(action) {
    if (busy) return;
    busy = true;
    $('pushState').textContent = 'Updating this device…';
    try {
      if (action === 'testClosed') {
        const result = await api().testClosed();
        $('pushState').textContent = result.queued ? 'Test scheduled. Close all 8aPDF tabs and lock your phone now. Check for the alert in about 30–90 seconds, then return and refresh delivery status.' : 'The background test could not be scheduled.';
      } else if (action === 'test') {
        const result = await api().test();
        $('pushState').textContent = result.sent ? 'Push service accepted the test. Check your phone’s notification tray.' : 'Your push service did not accept the test.';
      } else {
        present(await api()[action]());
        if (action === 'repair') $('pushState').textContent += ' · Device renewed. Run the closed-site test next.';
      }
    } catch (e) { $('pushState').textContent = e.message; }
    finally { busy = false; }
  }
  $('pushEnable').onclick = () => act('enable');
  $('pushDisable').onclick = () => act('disable');
  $('pushRepair').onclick = () => act('repair');
  $('pushRefresh').onclick = refresh;
  $('pushTest').onclick = () => act('test');
  $('pushTestClosed').onclick = () => act('testClosed');
  for (const id of ['pushPdfs', 'pushAnnouncements', 'pushTestsOnly']) $(id).onchange = async () => {
    try { present(await api().savePreferences({ pdfs: $('pushPdfs').checked, announcements: $('pushAnnouncements').checked, testsOnly: $('pushTestsOnly').checked })); }
    catch (e) { $('pushState').textContent = e.message; }
  };
  $('markChatsRead').onclick = async () => {
    try { await parent.__8apdfSocial.markAllRead(); $('chatReadStatus').textContent = 'All conversations marked as read. New messages will count from now on.'; }
    catch (e) { $('chatReadStatus').textContent = e.message; }
  };
  parent.document.addEventListener('8apdf:push-changed', refresh);
  window.addEventListener('pagehide', () => parent.document.removeEventListener('8apdf:push-changed', refresh), { once: true });
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data?.type === '8apdf:tool-visible' && e.data.visible) refresh(); });
  refresh();
})();
