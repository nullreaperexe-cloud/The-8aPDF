/* Premium presentation layer. The school bridge remains the source of truth. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),root=document.documentElement;
 const bridge=()=>window.__8apdfStudyBridge;
 const mobile=matchMedia('(max-width:810px)');
 const studio=()=>root.dataset.uiMode==='studio'&&root.dataset.novaUi!=='on';
 const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback}catch{return fallback}};
 let returnFocus=null,lastTab='home';
 function greeting(){
  const name=read('eightapdf_user_name_v2',read('eightapdf_user_name','')).trim();
  $('premiumWelcome').textContent=name&&name!=='Student'?'Welcome '+name:'Welcome';
 }
 function overview(){
  const docs=bridge()?.documents?.()||[],messages=bridge()?.announcements?.()||[];
  $('premiumSubjectCount').textContent=docs.length?String(new Set(docs.map(x=>x.subject).filter(Boolean)).size):'—';
  $('premiumSavedCount').textContent=String(bridge()?.bookmarks?.()?.length||0);
  $('premiumMessageCount').textContent=messages.length?String(messages.length):(bridge()?.isLive?.()?'0':'—');
  $('premiumDay').textContent='Day '+(bridge()?.schoolDay?.()||1);
 }
 function summaryPosition(){
  const summary=$('premiumSummary'),widgets=$('dashboardWidgets');
  if(mobile.matches)widgets.before(summary);else widgets.after(summary);
 }
 function activate(){
  const search=$('command').classList.contains('open'),more=!$('studioMorePanel').hidden;
  document.querySelectorAll('.studio-mobile-item').forEach(b=>{
   const active=b.id==='studioMobileSearch'?search:b.id==='studioMobileMore'?more:!search&&!more&&b.dataset.go===lastTab;
   b.classList.toggle('active',active);
   if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
 }
 function routeTab(){
  lastTab=/^\/(announcements|updates)/.test(location.pathname)?'announcements':location.pathname==='/pdfs'?'library':'home';activate();
 }
 function finishMore(){
  const panel=$('studioMorePanel');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','More study tools');
  const links=[
   ['All Subjects',()=>{$('studioSidebarToggle').click()}],
   ['Latest Uploads',()=>document.querySelector('#studioSidebar [data-go="latest"]')?.click()],
   ['Study Chatbot',()=>$('studioAssistantLink').click()],
   ['All PDFs & To-Do',()=>document.querySelector('#wsExtraLinks [data-ws-action="todo"]')?.click()],
   ['Download PDFs as ZIP',()=>document.querySelector('#wsExtraLinks [data-ws-action="zip"]')?.click()],
   ['Edit Home Widgets',()=>document.querySelector('#wsExtraLinks [data-ws-action="widgets"]')?.click()],
   ['Reminders',()=>{if(!$('wsUpcomingBtn')?.hidden)$('wsUpcomingBtn').click();else bridge()?.notify?.('No upcoming dated school reminders.')}]
  ];
  links.forEach(([label,action])=>{
   const b=document.createElement('button');b.type='button';b.textContent=label;
   b.onclick=()=>{panel.hidden=true;action();activate()};panel.append(b);
  });
  $('studioMobileMore').setAttribute('aria-controls','studioMorePanel');
  $('studioMobileMore').setAttribute('aria-expanded','false');
 }
 function init(){
  if(!$('premiumWelcome')||!bridge())return;
  const recents=$('dashboardWidgets').children[2];
  if(recents&&studio()){
   recents.id='premiumRecentWidget';
   const extra=document.createElement('section');extra.id='premiumRecentSection';extra.className='shell widgets premium-extra-widgets';extra.setAttribute('aria-label','Latest school PDFs');
   $('dashboardWidgets').after(extra);extra.append(recents);
  }
  greeting();overview();summaryPosition();finishMore();routeTab();
  const reminder=document.createElement('button');reminder.type='button';reminder.className='studio-side-link';reminder.id='premiumReminders';reminder.innerHTML='<svg aria-hidden="true"><use href="#i-bell"/></svg><span>School Reminders</span>';
  reminder.onclick=()=>{if(!$('wsUpcomingBtn')?.hidden)$('wsUpcomingBtn').click();else bridge()?.notify?.('No upcoming dated school reminders.')};
  document.querySelector('.studio-nav-secondary').append(reminder);
  const searchClose=document.createElement('button');searchClose.className='premium-search-close';searchClose.type='button';searchClose.setAttribute('aria-label','Close search');searchClose.textContent='Close search ×';
  searchClose.onclick=()=>{$('command').click();$('studioMobileSearch').focus()};
  $('command').querySelector('.command-card').prepend(searchClose);
  const friends=document.querySelector('.studio-friends-group'),tools=document.querySelector('.studio-nav-secondary');
  if(friends&&tools)tools.before(friends);
  const searchLabel=$('topSearch').querySelector('span');
  searchLabel.replaceChildren();
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-search');icon.append(use);
  searchLabel.append(icon,document.createTextNode('Search PDFs, notes, subjects or announcements…'));
  $('premiumSubjects').onclick=()=>document.querySelector('#studioSubjects [data-sidebar-subject="All Subjects"]')?.click();
  $('nameForm').addEventListener('submit',greeting);
  $('daySelect').addEventListener('change',overview);
  ['8apdf:library-updated','8apdf:teacher-data','8apdf:document-opened'].forEach(event=>document.addEventListener(event,overview));
  window.addEventListener('storage',()=>{greeting();overview()});
  window.addEventListener('pageshow',()=>{greeting();overview();routeTab()});
  window.addEventListener('popstate',()=>{routeTab();$('studioMorePanel').hidden=true});
  mobile.addEventListener('change',summaryPosition);
  document.addEventListener('click',e=>{
   const b=e.target.closest('[data-go]');
   if(b){if(['home','library','announcements','latest','saved'].includes(b.dataset.go))lastTab=['latest','saved'].includes(b.dataset.go)?'library':b.dataset.go;
    if(mobile.matches&&root.dataset.studioMobileMenu==='open')$('studioSidebarClose').click();}
   if(e.target.closest('[data-pdf="save"]'))queueMicrotask(overview);
   if(e.target.closest('#studioMobileMore')){
    returnFocus=$('studioMobileMore');queueMicrotask(()=>{if(!$('studioMorePanel').hidden)$('studioCloseMore').focus()});
   }
   if(!e.target.closest('#studioMorePanel,#studioMobileMore'))$('studioMorePanel').hidden=true;
   activate();
  });
  document.addEventListener('keydown',e=>{
   const panel=$('studioMorePanel');if(panel.hidden||!studio())return;
   if(e.key==='Escape'){panel.hidden=true;returnFocus?.focus();activate()}
   if(e.key==='Tab'){
    const all=[...panel.querySelectorAll('button')],first=all[0],last=all.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
   }
  });
  new MutationObserver(()=>{
   $('studioMobileMore').setAttribute('aria-expanded',String(!$('studioMorePanel').hidden));activate();
  }).observe($('studioMorePanel'),{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(activate).observe($('command'),{attributes:true,attributeFilter:['class']});
  // Bookmark rendering already happens in the original PDF handlers.
  new MutationObserver(overview).observe($('pdfGrid'),{childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
