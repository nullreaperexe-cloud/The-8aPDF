
/* Crimson interaction layer: does not replace 8aPDF's original handlers. */
(()=>{'use strict';
 const html=document.documentElement;
 if(html.dataset.uiMode!=='studio')return;
 if(!document.getElementById('crimsonSky')){
   const sky=document.createElement('div');sky.id='crimsonSky';sky.setAttribute('aria-hidden','true');
   sky.innerHTML='<i class="crimson-grid"></i><i class="crimson-orb"></i><i class="crimson-star"></i><i class="crimson-star two"></i>';
   document.body.insertBefore(sky,document.body.firstChild);
 }
 const motionOn=()=>html.dataset.motion!=='off'&&html.dataset.ultraLow!=='on'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const revealNodes='main .section-heading h2,main .section-heading p,main .experience-heading h2,main .premium-stat,main .feature,main .experience-tile,main .widget,main .pdf-card,main .notice-card';
 const watched=new WeakSet();
 const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
  for(const e of entries){if(e.isIntersecting){e.target.setAttribute('data-crimson-reveal','shown');observer.unobserve(e.target)}}
 },{rootMargin:'0px 0px -25px 0px',threshold:.05}):null;
 function installReveals(){
  if(!observer||!motionOn())return;
  document.querySelectorAll(revealNodes).forEach(el=>{
   if(watched.has(el))return;
   watched.add(el);
   const box=el.getBoundingClientRect();
   if(box.top<innerHeight*.85&&box.bottom>0){el.setAttribute('data-crimson-reveal','shown');return}
   el.setAttribute('data-crimson-reveal','pending');
   observer.observe(el);
  });
 }
 let raf=0;
 function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;installReveals()})}
 const watchedAreas=['pdfGrid','announcementGrid','dashboardWidgets','premiumRecentSection','premiumSummary','newSchoolPlanner','experienceHub'];
 for(const id of watchedAreas){const area=document.getElementById(id);if(area)new MutationObserver(schedule).observe(area,{childList:true,subtree:true})}
 installReveals();
 let activeCard=null,animation=0,pointerEvent=null;
 const canTilt=()=>motionOn()&&matchMedia('(pointer:fine) and (hover:hover)').matches;
 document.addEventListener('pointermove',e=>{
  if(!canTilt())return;
  const card=e.target.closest('.pdf-card,.notice-card');
  if(card!==activeCard){if(activeCard)activeCard.style.transform='';activeCard=card}
  if(!card)return;
  pointerEvent={x:e.clientX,y:e.clientY};
  if(animation)return;
  animation=requestAnimationFrame(()=>{
   animation=0;
   if(!activeCard||!pointerEvent)return;
   const rect=activeCard.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const x=Math.max(-.5,Math.min(.5,(pointerEvent.x-rect.left)/rect.width-.5));
   const y=Math.max(-.5,Math.min(.5,(pointerEvent.y-rect.top)/rect.height-.5));
   activeCard.style.setProperty('--crimson-pointer-x',((x+.5)*100)+'%');
   activeCard.style.setProperty('--crimson-pointer-y',((y+.5)*100)+'%');
   activeCard.style.transform='perspective(1200px) rotateX('+(-y*8).toFixed(2)+'deg) rotateY('+(x*8).toFixed(2)+'deg) translateY(-4px)';
  });
 },{passive:true});
 document.addEventListener('pointerout',e=>{
  if(activeCard&&!activeCard.contains(e.relatedTarget)){activeCard.style.transform='';activeCard=null}
 },{passive:true});
 window.addEventListener('blur',()=>{if(activeCard){activeCard.style.transform='';activeCard=null}});
 /* The app itself controls pagination, bookmarks, search, announcements, theme, audio and overlays. */
})();
