/* 8aPDF · Alabaster progressive enhancement.
 * Feature actions are delegated to the existing school bridge / controls.
 * No new auth, API, Supabase, Firebase or PDF persistence logic. */
(()=>{
 'use strict';
 const doc=document,root=doc.documentElement;
 const $=id=>doc.getElementById(id);
 const bridge=()=>window.__8apdfStudyBridge;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const noMotion=()=>reduced.matches||root.dataset.ultraLow==='on'||root.dataset.motion==='off';
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const liveData=()=>bridge()?.isLive?.()||false;
 let pendingFrame=0,hovering=null,lastPointer=null;
 const cardSelector='.pdf-card,.notice-card,.explorer-card,.alabaster-spotlight-card';
 function resetCard(node){
   if(!node)return;
   node.classList.remove('alabaster-tilting');
   node.style.removeProperty('--rx');
   node.style.removeProperty('--ry');
   node.style.removeProperty('--glare-x');
   node.style.removeProperty('--glare-y');
 }
 function registerCards(scope=doc){
   if(!scope?.querySelectorAll)return;
   scope.querySelectorAll(cardSelector).forEach((node,i)=>{
     if(node.dataset.alabasterTilt==='yes')return;
     node.dataset.alabasterTilt='yes';
     if(i<9&&!noMotion()){
       node.classList.add('alabaster-enter');
       node.style.setProperty('--stagger-delay',Math.min(i,8)*38+'ms');
       node.addEventListener('animationend',()=>node.classList.remove('alabaster-enter'),{once:true});
     }
   });
 }
 function pointerMove(event){
   if(!fine.matches||noMotion())return;
   const card=event.target instanceof Element?event.target.closest(cardSelector):null;
   if(!card)return;
   lastPointer={card,x:event.clientX,y:event.clientY};
   if(pendingFrame)return;
   pendingFrame=requestAnimationFrame(()=>{
     pendingFrame=0;
     const point=lastPointer;if(!point||!point.card.isConnected)return;
     if(hovering&&hovering!==point.card)resetCard(hovering);
     hovering=point.card;
     const rect=point.card.getBoundingClientRect();
     const x=Math.max(0,Math.min(1,(point.x-rect.left)/Math.max(1,rect.width)));
     const y=Math.max(0,Math.min(1,(point.y-rect.top)/Math.max(1,rect.height)));
     point.card.style.setProperty('--rx',((.5-y)*12).toFixed(2)+'deg');
     point.card.style.setProperty('--ry',((x-.5)*12).toFixed(2)+'deg');
     point.card.style.setProperty('--glare-x',(x*100).toFixed(1)+'%');
     point.card.style.setProperty('--glare-y',(y*100).toFixed(1)+'%');
     point.card.classList.add('alabaster-tilting');
   });
 }
 function pointerOut(event){
   const card=event.target instanceof Element?event.target.closest(cardSelector):null;
   if(!card)return;
   const related=event.relatedTarget;
   if(related instanceof Node && card.contains(related))return;
   if(hovering===card)hovering=null;
   if(lastPointer?.card===card)lastPointer=null;
   resetCard(card);
 }
 function initMotion(){
   doc.addEventListener('pointermove',pointerMove,{passive:true});
   doc.addEventListener('pointerout',pointerOut,{passive:true});
   window.addEventListener('blur',()=>resetCard(hovering));
   reduced.addEventListener?.('change',()=>resetCard(hovering));
   const candidates=['pdfGrid','announcementGrid','explorerGrid'];
   for(const id of candidates){
     const target=$(id);
     if(!target)continue;
     registerCards(target);
     const observer=new MutationObserver(()=>registerCards(target));
     observer.observe(target,{childList:true});
   }
 }
 function updateCounts(){
   const b=bridge();if(!b)return;
   const docs=b.documents?.()||[],notices=b.announcements?.()||[];
   const n=$('alabasterDocsCount'),a=$('alabasterNoticesCount');
   if(n)n.textContent=liveData()?String(docs.length):'–';
   if(a)a.textContent=liveData()?String(notices.length):'–';
 }
 function initSidebar(){
   const side=$('studioSidebar'),end=side?.querySelector('.studio-side-end');
   if(!side||!end||$('alabasterDocsCount'))return;
   const stats=doc.createElement('div');stats.className='alabaster-side-stats';
   stats.setAttribute('aria-label','Library totals');
   stats.innerHTML='<span><strong id="alabasterDocsCount">–</strong><small>Study PDFs</small></span><span><strong id="alabasterNoticesCount">–</strong><small>Notices</small></span>';
   end.prepend(stats);
   if($('studioMobileMore')){
     const more=doc.createElement('button');more.type='button';more.className='alabaster-side-more';
     more.textContent='More study tools';more.setAttribute('aria-label','Open more study tools');
     more.addEventListener('click',()=>{
       const mobile=matchMedia('(max-width:810px)').matches;
       if(mobile&&root.dataset.studioMobileMenu==='open')$('studioSidebarClose')?.click();
       $('studioMobileMore')?.click();
     });
     end.append(more);
   }
   updateCounts();
   doc.addEventListener('8apdf:library-updated',updateCounts);
   doc.addEventListener('8apdf:teacher-data',updateCounts);
 }
 function smallText(x,max=135){
   return String(x||'').replace(/\s+/g,' ').trim().slice(0,max);
 }
 function buildSpotlight(){
   if(!$('experienceHub')||!bridge())return;
   let stage=$('alabasterSpotlight');
   if(!stage){
     stage=doc.createElement('section');stage.id='alabasterSpotlight';
     stage.className='alabaster-spotlight shell';
     stage.setAttribute('aria-label','Latest school notices and circulars');
     const head=doc.createElement('div');head.className='alabaster-spotlight-head';
     const intro=doc.createElement('div');
     intro.innerHTML='<span class="alabaster-spotlight-eyebrow">LIVE SCHOOL UPDATES</span><h2>Notices & circulars</h2>';
     const all=doc.createElement('button');all.type='button';all.className='alabaster-spotlight-all';all.textContent='View all updates ↗';
     all.addEventListener('click',()=>bridge()?.navigate?.('announcements'));
     head.append(intro,all);
     const deck=doc.createElement('div');deck.className='alabaster-deck';deck.id='alabasterDeck';deck.setAttribute('aria-label','Recent announcements');
     stage.append(head,deck);$('experienceHub').before(stage);
   }
   const deck=$('alabasterDeck'),items=(bridge()?.announcements?.()||[]).slice().sort((a,b)=>{
     const date=x=>{const raw=x.messageDate||x.eventDate||x.createdAt;const n=new Date(raw).getTime();return Number.isFinite(n)?n:0};
     return date(b)-date(a);
   }).slice(0,5);
   const signature=items.map(x=>[x.id,x.title,x.category].join('|')).join('~')+'#'+liveData();
   if(deck.dataset.signature===signature)return;
   deck.dataset.signature=signature;deck.replaceChildren();
   if(!items.length&&!liveData()){
     for(let i=0;i<3;i++){const shell=doc.createElement('div');shell.className='alabaster-spotlight-card alabaster-skeleton';shell.setAttribute('aria-hidden','true');shell.innerHTML='<span></span>';deck.append(shell)}
     return;
   }
   if(!items.length){const p=doc.createElement('p');p.textContent='No school notices yet. New notices will appear here automatically.';p.style.color='#64748B';deck.append(p);return}
   for(const item of items){
     const node=doc.createElement('button');node.type='button';node.className='alabaster-spotlight-card';
     const category=smallText(item.category||item.subject||'School update',45);
     const urgent=/urgent|exam|important|test/i.test(category+' '+String(item.title||''));
     const top=doc.createElement('span');top.className='alabaster-spotlight-category';
     const dot=doc.createElement('i');dot.className='alabaster-spotlight-dot'+(urgent?' urgent':'');
     dot.setAttribute('aria-hidden','true');top.append(dot,doc.createTextNode(category));
     const title=doc.createElement('strong');title.textContent=smallText(item.title||'School notice',110);
     const preview=doc.createElement('span');preview.className='alabaster-summary';preview.textContent=smallText(item.description||item.message||item.fullMessage||'',150);
     const action=doc.createElement('span');action.className='alabaster-open';
     action.textContent='Read announcement ↗';
     node.append(top,title,preview,action);
     node.setAttribute('aria-label','Read '+String(item.title||'school notice'));
     node.addEventListener('click',()=>bridge()?.openAnnouncement?.(item.id));
     deck.append(node);
   }
   registerCards(deck);
 }
 function initSpotlight(){
   if(!bridge()||!$('experienceHub'))return;
   buildSpotlight();
   doc.addEventListener('8apdf:teacher-data',buildSpotlight);
   doc.addEventListener('8apdf:library-updated',buildSpotlight);
 }
 function initExplorer(){
   const shell=doc.querySelector('.explorer');
   if(!shell||$('alabasterExplorerToggle'))return;
   const header=shell.querySelector('.explorer-header'),sidebar=shell.querySelector('aside'),filters=$('explorerSubjects');
   if(!header||!sidebar||!filters)return;
   const btn=doc.createElement('button');btn.type='button';btn.id='alabasterExplorerToggle';
   btn.className='explorer-mobile-toggle';btn.textContent='☷ Subjects';btn.setAttribute('aria-label','Open subject filters');
   btn.setAttribute('aria-controls','explorerSubjects');btn.setAttribute('aria-expanded','false');
   header.prepend(btn);
   const mask=doc.createElement('div');mask.className='explorer-subject-scrim';mask.hidden=true;mask.setAttribute('aria-hidden','true');shell.append(mask);
   const open=v=>{
     root.dataset.alabasterExplorerOpen=v?'yes':'no';
     btn.setAttribute('aria-expanded',String(v));btn.setAttribute('aria-label',(v?'Close':'Open')+' subject filters');
     mask.hidden=!v;
   };
   btn.addEventListener('click',()=>open(root.dataset.alabasterExplorerOpen!=='yes'));
   mask.addEventListener('click',()=>open(false));
   filters.addEventListener('click',event=>{if(event.target.closest('[data-subject]'))open(false)});
   doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.dataset.alabasterExplorerOpen==='yes')open(false)});
   const media=matchMedia('(min-width:621px)');media.addEventListener?.('change',event=>{if(event.matches)open(false)});
 }
 function init(){
   initMotion();
   if($('studioSidebar')){initSidebar();initSpotlight();}
   initExplorer();
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
