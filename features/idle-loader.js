/* Loads secondary feature modules after first paint, or immediately when the matching control is used. */
(()=>{
'use strict';
const loaded=new Map();
const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1200));
const loadScript=(src,id)=>{
 if(loaded.has(id))return loaded.get(id);
 const promise=new Promise(resolve=>{
  const existing=document.querySelector('script[data-lazy-id="'+id+'"],script[src^="'+src.split('?')[0]+'"]');
  if(existing){resolve();return}
  const script=document.createElement('script');script.src=src;script.defer=true;script.dataset.lazyId=id;
  script.onload=resolve;script.onerror=resolve;document.head.append(script);
 });loaded.set(id,promise);return promise;
};
const files={chat:['/features/ai-chat-client.js?v=questions-20261101-v1','chat'],tools:['/workspace-pages.js?v=20261124-idle','tools'],notifications:['/site-polish.js?v=unread-stable-20261013','notifications'],push:['/push-notifications.js?v=20261117-idle','push'],polish:['/crimson-v6-motion.js?v=red-smooth-20261116','polish'],overview:['/crimson-v8-overview.js?v=red-nextday-20261116','overview']};
const load=name=>{const item=files[name];return item?loadScript(item[0],item[1]):Promise.resolve()};
window.__8apdfLoadFeature=load;
const bind=(selector,name)=>document.addEventListener('click',event=>{if(event.target.closest(selector))load(name)},{capture:true,passive:true});
bind('#studioAssistantLink,#studioMoreAssistant,[data-open-ai]','chat');
bind('[data-open-friends-chat],a[href^="/chat"],#htmlCodeLink,#pdfExplorerLink,#schoolCalendarLink,#testsLink,#importantMessagesLink,#notificationSettingsLink','tools');
bind('#notificationBtn,[data-open-notifications]','push');
idle(()=>{load('tools');load('polish');load('overview')},{timeout:3500});
})();
