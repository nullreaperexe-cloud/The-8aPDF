/* 8aPDF Crimson V6 interaction layer — progressive enhancement only.
   Does not replace original PDF, announcement, filter, timetable, chat or music handlers. */
(()=>{'use strict';
const root=document.documentElement;
if(root.dataset.crimsonUi!=='on')return;
const $=id=>document.getElementById(id);
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.motion==='off'||root.dataset.ultraLow==='on';
const finePointer=()=>matchMedia('(pointer:fine) and (hover:hover)').matches&&!reduceMotion();
if(!$('crimsonSky')){
 const sky=document.createElement('div');
 sky.id='crimsonSky';sky.setAttribute('aria-hidden','true');
 sky.innerHTML='<i class="crimson-grid"></i><i class="crimson-orb"></i><i class="crimson-star"></i><i class="crimson-star two"></i>';
 document.body.insertBefore(sky,document.body.firstChild);
}
/* Floating, screen-reader-friendly theme switch, synced to the existing preference engine. */
const toggle=document.createElement('button');
toggle.id='crimsonThemeToggle';toggle.type='button';
toggle.setAttribute('aria-label','Switch to light theme');
toggle.title='Switch to light theme';
const sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
const moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.1 15.4A8.6 8.6 0 0 1 8.6 3.9a8.7 8.7 0 1 0 11.5 11.5Z"/></svg>';
function updateThemeButton(){
 const isLight=root.dataset.tone==='light';
 toggle.innerHTML=(isLight?moon:sun);
 toggle.setAttribute('aria-label',isLight?'Switch to dark theme':'Switch to light theme');
 toggle.setAttribute('title',isLight?'Switch to dark theme':'Switch to light theme');
 toggle.setAttribute('aria-pressed',String(isLight));
}
toggle.addEventListener('click',()=>{
 const next=root.dataset.tone==='light'?'pure-black':'light';
 if(typeof window.__8apdfSetWorkspaceTheme==='function'){
   window.__8apdfSetWorkspaceTheme(next);
 }else{
   try{
    const key='8apdf_ws_v4_preferences';
    const old=JSON.parse(localStorage.getItem(key)||'{}');
    old.theme=next;localStorage.setItem(key,JSON.stringify(old));
   }catch{}
   root.dataset.tone=next==='light'?'light':'dark';
   root.dataset.theme=next;
 }
 updateThemeButton();
});
document.body.appendChild(toggle);
const themeObserver=new MutationObserver(updateThemeButton);
themeObserver.observe(root,{attributes:true,attributeFilter:['data-tone']});
updateThemeButton();
/* Staggered scroll entrance. WAAPI animates only after a node enters the viewport,
   then hands control back to the original app and the independent 3D hover engine. */
const selector=[
 '#library .section-heading h2','#library .section-heading p',
 '#announcements .section-heading h2','#announcements .section-heading p',
 '#newSchoolPlanner .widget','#newSchoolPlanner .planner-task',
 '#experienceHub .experience-tile','#experienceHub .experience-heading h2',
 '#pdfGrid>.pdf-card','#announcementGrid>.notice-card',
 '#pdfGrid .card-actions .action','#announcementGrid .card-actions .action',
 '#morePdf','#moreAnnouncements',
 '#library .school-term-segment button',
 '#library .mini-tabs button','#library .filter-foot button',
 '#studioSubjects .studio-side-link',
 '#studioSidebar .studio-nav-group>.studio-side-link',
 '.hero .premium-hero-actions .action',
 '.hero .suggestions .chip',
 '.section-heading .heading-kicker'
].join(',');
const watched=new WeakSet();
const visible=new WeakSet();
let queued=false;
function stage(el){
 if(watched.has(el))return;
 watched.add(el);
 if(!('IntersectionObserver'in window)||reduceMotion()){visible.add(el);return}
 const rect=el.getBoundingClientRect();
 if(rect.width===0&&rect.height===0){
   // A hidden page should never be made invisible. Register when it is revealed.
   return;
 }
 el.style.opacity='0';
 revealObserver.observe(el);
}
function isCard(el){return el.matches('.pdf-card,.notice-card')}
function order(el){
 const parent=el.parentElement;if(!parent)return 0;
 const siblings=Array.from(parent.children).filter(x=>x.matches(el.tagName.toLowerCase()));
 return Math.max(0,siblings.indexOf(el));
}
function animateVisible(el){
 if(visible.has(el))return;
 visible.add(el);
 el.dataset.crimsonSeen='1';
 el.style.removeProperty('opacity');
 if(reduceMotion()||typeof el.animate!=='function')return;
 const card=isCard(el),button=el.matches('button,.action,.chip,.studio-side-link');
 const index=order(el),base=card?Math.min(index%3,2)*135:button?Math.min(index%7,6)*65:0;
 const delay=card?base:button?base:70;
 const frames=card?[
   {opacity:0,translate:'0 24px'},
   {opacity:1,translate:'0 0'}
 ]:button?[
   {opacity:0,transform:'translate3d(0,20px,0) scale(.94)',filter:'blur(2px)'},
   {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0px)'}
 ]:[
   {opacity:0,transform:'perspective(900px) translate3d(0,43px,-30px) rotateX(7deg)',filter:'blur(4px)'},
   {opacity:1,transform:'perspective(900px) translate3d(0,0,0) rotateX(0deg)',filter:'blur(0px)'}
 ];
 try{
  const animation=el.animate(frames,{
    duration:card?620:button?510:720,
    delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'
  });
  // Prevent invisible nodes if animations are cancelled by a low-power setting.
  animation.finished.catch(()=>{}).then(()=>{
   el.style.removeProperty('opacity');
   el.style.removeProperty('filter');
  });
 }catch{}
}
const revealObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting)continue;
  revealObserver.unobserve(entry.target);
  animateVisible(entry.target);
 }
},{rootMargin:'0px 0px -7% 0px',threshold:.045}):null;
function scan(){
 if(root.dataset.uiMode!=='studio')return;
 document.querySelectorAll(selector).forEach(el=>{
  if(watched.has(el))return;
  const r=el.getBoundingClientRect();
  if(r.width===0&&r.height===0)return;
  stage(el);
 });
}
function scheduleScan(){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;scan()});
}
scan();
document.addEventListener('DOMContentLoaded',scheduleScan,{once:true});
const main=document.querySelector('main');
if(main)new MutationObserver(scheduleScan).observe(main,{childList:true,subtree:true});
for(const id of ['library','announcements','studioSidebar','experienceHub','newSchoolPlanner']){
 const element=$(id);
 if(element)new MutationObserver(scheduleScan).observe(element,{attributes:true,attributeFilter:['class','style','hidden']});
}
if($('studioSubjects'))new MutationObserver(scheduleScan).observe($('studioSubjects'),{childList:true});
addEventListener('pageshow',scheduleScan,{passive:true});
addEventListener('resize',scheduleScan,{passive:true});
document.addEventListener('8apdf:library-updated',scheduleScan);
document.addEventListener('8apdf:teacher-data',scheduleScan);
/* CSS owns the transform transition on both themes; no inline transform jumps. */
let current=null,last=null,frame=0;
function settle(){if(!current)return;for(const key of ['--crimson-rotate-x','--crimson-rotate-y','--crimson-pointer-x','--crimson-pointer-y'])current.style.removeProperty(key);current=null;}
function paint(){frame=0;if(!current||!last||!current.isConnected)return;const b=current.getBoundingClientRect();if(b.width<20||b.height<20)return;const x=Math.max(-.5,Math.min(.5,(last.x-b.left)/b.width-.5)),y=Math.max(-.5,Math.min(.5,(last.y-b.top)/b.height-.5));current.style.setProperty('--crimson-pointer-x',((x+.5)*100).toFixed(2)+'%');current.style.setProperty('--crimson-pointer-y',((y+.5)*100).toFixed(2)+'%');current.style.setProperty('--crimson-rotate-x',(-y*5).toFixed(2)+'deg');current.style.setProperty('--crimson-rotate-y',(x*5).toFixed(2)+'deg');}
document.addEventListener('pointermove',event=>{if(!finePointer()){settle();return}const card=event.target.closest('#pdfGrid>.pdf-card,#announcementGrid>.notice-card');if(current!==card){settle();current=card}if(!current)return;last={x:event.clientX,y:event.clientY};if(!frame)frame=requestAnimationFrame(paint);},{passive:true});
document.addEventListener('pointerout',event=>{if(current&&!current.contains(event.relatedTarget))settle();},{passive:true});
addEventListener('blur',settle);
})();
