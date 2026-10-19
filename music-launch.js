/* 8aPDF Music Catalog launch announcement.
 * Close = this visit only. Don't show again = saved on this browser.
 */
(() => {
 'use strict';
 const KEY='8apdf_music_catalog_launch_v1_dont_show';
 const COOKIE='8apdf_music_launch_hidden';
 let root=null,shown=false,observer=null,previousFocus=null,previousOverflow='',scheduled=null;
 const cookieHidden=()=>document.cookie.split(';').some(part=>part.trim()===COOKIE+'=1');
 function hiddenForever(){
  try{if(localStorage.getItem(KEY)==='1')return true}catch{}
  return cookieHidden();
 }
 function remember(){
  try{localStorage.setItem(KEY,'1')}catch{}
  try{document.cookie=COOKIE+'=1; Path=/; Max-Age=157680000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')}catch{}
 }
 function canShow(){
  if(!document.body||hiddenForever())return false;
  const name=document.getElementById('nameModal');
  return !document.body.classList.contains('locked')&&!document.body.inert&&
   !name?.classList.contains('show')&&document.documentElement.dataset.onboard!=='needed';
 }
 function stopWatching(){
  observer?.disconnect();observer=null;
  if(scheduled!==null)clearTimeout(scheduled);
  scheduled=null;
 }
 function close(permanently=false){
  if(permanently)remember();
  if(!root)return;
  root.removeEventListener('keydown',onKeys);
  root.remove();root=null;
  document.body.classList.remove('music-launch-open');
  document.body.style.overflow=previousOverflow;
  if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
  previousFocus=null;
 }
 function onKeys(event){
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key!=='Tab'||!root)return;
  const controls=[...root.querySelectorAll('button:not([disabled])')];
  if(!controls.length)return;
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
 function openMusic(){
  close(); // Exploring is not a "don't show again" choice.
  if(typeof window.__8apdfDriveMusic?.open==='function'){window.__8apdfDriveMusic.open();return}
  const entry=document.getElementById('studioDriveMusic')||
   document.getElementById('studioMobileDriveMusic')||
   document.getElementById('dmClassicLauncher');
  entry?.click();
 }
 function show(){
  if(shown||!canShow())return;
  shown=true;stopWatching();
  previousFocus=document.activeElement;
  previousOverflow=document.body.style.overflow;
  root=document.createElement('div');
  root.id='musicLaunchAnnouncement';root.className='music-launch-backdrop';
  root.innerHTML="<section class=\"music-launch-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"musicLaunchTitle\" aria-describedby=\"musicLaunchDesc\">\n  <div class=\"music-launch-topline\">\n    <span class=\"music-launch-brand\"><span class=\"music-launch-brand-mark\" aria-hidden=\"true\">♫</span> 8aPDF <span class=\"music-launch-slash\">/</span> BIG UPDATE</span>\n    <button type=\"button\" class=\"music-launch-x\" data-ml-action=\"close\" aria-label=\"Close music announcement\">×</button>\n  </div>\n  <div class=\"music-launch-art\" aria-hidden=\"true\">\n    <div class=\"music-launch-disc\"><span class=\"music-launch-disc-center\"></span></div>\n    <span class=\"music-launch-art-label\">A NEW SOUND FOR YOUR SPACE</span>\n    <div class=\"music-launch-wave\"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>\n  </div>\n  <div class=\"music-launch-copy\">\n    <div class=\"music-launch-kicker\"><span class=\"music-launch-live-dot\"></span> JUST LAUNCHED <span class=\"music-launch-kicker-rule\"></span> MUSIC CATALOG</div>\n    <h2 id=\"musicLaunchTitle\">Your study space<br>has a <em>soundtrack.</em></h2>\n    <p id=\"musicLaunchDesc\">Say hello to the all-new <strong>8aPDF Music Library</strong> — explore 97 songs, find your favourites, and keep the music going while you study.</p>\n    <div class=\"music-launch-features\">\n      <div class=\"music-launch-feature\"><strong>97</strong><span>Songs in the<br>catalog</span></div>\n      <div class=\"music-launch-feature\"><strong>♡</strong><span>Search and<br>like tracks</span></div>\n      <div class=\"music-launch-feature\"><strong>♫</strong><span>Mini-player<br>while studying</span></div>\n    </div>\n    <div class=\"music-launch-theme-note\">Same 8aPDF themes · Black, Light &amp; more</div>\n    <button type=\"button\" class=\"music-launch-explore\" data-ml-action=\"explore\"><span><span class=\"music-launch-play\" aria-hidden=\"true\">▶</span> Explore Music Library</span><span aria-hidden=\"true\">↗</span></button>\n    <div class=\"music-launch-footer\" role=\"group\" aria-label=\"Announcement visibility options\">\n      <button type=\"button\" data-ml-action=\"close\">Close</button>\n      <span class=\"music-launch-footer-divider\" aria-hidden=\"true\"></span>\n      <button type=\"button\" data-ml-action=\"never\">Don't show again</button>\n    </div>\n  </div>\n</section>";
  document.body.append(root);
  document.body.style.overflow='hidden';
  document.body.classList.add('music-launch-open');
  root.addEventListener('keydown',onKeys);
  root.addEventListener('click',event=>{
   const action=event.target.closest('[data-ml-action]')?.dataset.mlAction;
   if(action==='close'||event.target===root)close();
   else if(action==='never')close(true);
   else if(action==='explore')openMusic();
  });
  root.querySelector('[data-ml-action="explore"]')?.focus({preventScroll:true});
 }
 function maybeSchedule(){
  if(shown||hiddenForever()||scheduled!==null||!canShow())return;
  scheduled=setTimeout(()=>{scheduled=null;if(canShow())show()},560);
 }
 function start(){
  if(hiddenForever()||!document.body)return;
  // Wait for the existing student-name onboarding dialog to finish.
  observer=new MutationObserver(maybeSchedule);
  const name=document.getElementById('nameModal');
  if(name)observer.observe(name,{attributes:true,attributeFilter:['class','aria-hidden']});
  observer.observe(document.body,{attributes:true,attributeFilter:['class','inert']});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-onboard']});
  maybeSchedule();
 }
 window.__8apdfMusicLaunch={show,close,dismissForever:()=>close(true),hiddenForever};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();