(()=>{'use strict';
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const ROOT=document.documentElement;
 if(location.protocol==='file:')ROOT.dataset.localPreview='yes';
 const STORE='8apdf_ui_mode_v1';
 function activeStyle(mode){
  mode=mode==='classic'?'classic':'studio';ROOT.dataset.uiMode=mode;
  $$('#studioUiSetting [data-set-ui]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.setUi===mode));});
  try{localStorage.setItem(STORE,mode)}catch{}
  document.dispatchEvent(new CustomEvent('8apdf:ui-mode-changed',{detail:{mode}}));
 }
 activeStyle(ROOT.dataset.uiMode||'studio');
 $('#studioUiSetting').addEventListener('click',e=>{const b=e.target.closest('[data-set-ui]');if(b)activeStyle(b.dataset.setUi)});
 $('#resetSettings').addEventListener('click',()=>activeStyle('studio'));
 function activate(go){
  if(!go)return;
  $$('.studio-side-link[data-go],.studio-mobile-item[data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===go));
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){activate(b.dataset.go);$('#studioMorePanel').hidden=true}});
 function openShortLinks(){
  $('#studioMorePanel').hidden=true;
  const section=document.querySelector('#myShortLinks')||document.querySelector('#studioPreviewLinks');
  if(section){section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});return}
 }
 for(const id of ['studioShortLinksLink','studioMoreLinks'])$('#'+id).addEventListener('click',openShortLinks);
 for(const id of ['studioFocusLink','studioMoreFocus'])$('#'+id).addEventListener('click',()=>{
  $('#studioMorePanel').hidden=true;
  const open=$('#openFocusStudio');if(open)open.click();
  else {const hub=$('#experienceHub');if(hub)hub.scrollIntoView({behavior:'smooth'})}
 });
 for(const id of ['studioSidebarSearch','studioMobileSearch'])$('#'+id).addEventListener('click',()=>$('#topSearch').click());
 $('#studioMobileMore').addEventListener('click',()=>{$('#studioMorePanel').hidden=!$('#studioMorePanel').hidden});
 $('#studioCloseMore').addEventListener('click',()=>{$('#studioMorePanel').hidden=true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')$('#studioMorePanel').hidden=true});
 $('#studioLinksBack').addEventListener('click',()=>$('#library').scrollIntoView({behavior:'smooth'}));
})();
