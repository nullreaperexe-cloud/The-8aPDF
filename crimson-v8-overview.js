/* 8aPDF — live read-only dashboard indicators. Original school bridge remains source of truth. */
(()=>{'use strict';
const root=document.documentElement;
const $=id=>document.getElementById(id);
const bridge=()=>window.__8apdfStudyBridge;
const readCount=id=>{
 const value=$(id)?.textContent?.trim()||'';
 return /^\d+$/.test(value)?Number(value):null;
};
const number=n=>Number.isFinite(n)&&n>=0?String(Math.floor(n)):'—';
function update(){
 const host=$('crimsonLiveSummary');if(!host||root.dataset.uiMode!=='studio')return;
 const b=bridge(),loaded=b?.isLive?.()===true;
 const docs=typeof b?.documents==='function'?b.documents():null;
 const messages=typeof b?.announcements==='function'?b.announcements():null;
 const pdfs=loaded&&Array.isArray(docs)?docs.length:readCount('premiumSavedCount');
 // Announcements fetch independently of the PDF catalogue; never gate on PDF isLive().
 const notices=b?.areAnnouncementsReady?.()===true&&Array.isArray(messages)
  ?messages.length:readCount('premiumMessageCount');
 let tests=null;
 if(typeof window.__8apdfStudyIntel?.upcoming==='function'){
  const events=window.__8apdfStudyIntel.upcoming();
  if(Array.isArray(events))tests=events.filter(e=>e?.kind==='test').length;
 }
 const values={crimsonStatPdfs:pdfs,crimsonStatAnnouncements:notices,crimsonStatTests:tests};
 for(const [id,v]of Object.entries(values)){
  const target=$(id),label=number(v);
  if(target&&target.textContent!==label)target.textContent=label;
 }
}
let queued=false;
function schedule(){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;update()});
}
const events=['8apdf:library-updated','8apdf:teacher-data','8apdf:chat-unread','8apdf:school-day-changed','8apdf:profile-changed'];
for(const name of events)document.addEventListener(name,schedule);
window.addEventListener('pageshow',schedule);
window.addEventListener('storage',schedule);
function init(){
 schedule();
 const nodes=['premiumSavedCount','premiumMessageCount','premiumSubjectCount'].map($).filter(Boolean);
 if('MutationObserver'in window&&nodes.length){
  const observer=new MutationObserver(schedule);
  for(const el of nodes)observer.observe(el,{childList:true,characterData:true,subtree:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
