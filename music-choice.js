/* One-time, explicit 8aPDF background music choice.
 * Full-screen second onboarding step (never an Elfsight/music-catalog popup).
 * The choice is per browser/device, and is required before the workspace opens.
 */
(()=>{
 'use strict';
 const KEY='8apdf_music_choice_v1';
 const $=id=>document.getElementById(id);
 const valid=v=>v==='with'||v==='without'?v:null;
 function getChoice(){
  try{const value=valid(localStorage.getItem(KEY));if(value)return value}catch{}
  try{return valid(sessionStorage.getItem(KEY))}catch{return null}
 }
 function storeChoice(value){
  try{localStorage.setItem(KEY,value);return}catch{}
  try{sessionStorage.setItem(KEY,value)}catch{}
 }
 let screen=null,observer=null,siblings=new Map(),previousFocus=null,focusGuard=null,keyGuard=null;
 function release(){
  observer?.disconnect();observer=null;
  document.removeEventListener('focusin',focusGuard,true);
  document.removeEventListener('keydown',keyGuard,true);
  for(const [node,wasInert] of siblings)if(node.isConnected)node.inert=wasInert;
  siblings.clear();
  document.body?.classList.remove('music-choice-locked');
  if(screen){screen.remove();screen=null}
  if(previousFocus?.isConnected && typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
  previousFocus=null;
 }
 function choose(value){
  if(!valid(value)||!screen)return;
  storeChoice(value);
  release();
  window.__8apdfBackgroundAudio?.acceptChoice?.(value==='with');
  document.dispatchEvent(new CustomEvent('8apdf:music-choice',{detail:{enabled:value==='with'}}));
 }
 function lockSite(){
  siblings=new Map();
  const lock=()=>{
   for(const node of document.body.children){
    if(node===screen||siblings.has(node))continue;
    siblings.set(node,Boolean(node.inert));
    node.inert=true;
   }
  };
  lock();
  observer=new MutationObserver(lock);
  observer.observe(document.body,{childList:true});
  focusGuard=e=>{if(screen && !screen.contains(e.target))screen.querySelector('[data-music-choice]')?.focus({preventScroll:true})};
  keyGuard=e=>{
   if(!screen)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();return}
   if(e.key!=='Tab')return;
   const controls=[...screen.querySelectorAll('[data-music-choice]')];
   if(!controls.length){e.preventDefault();return}
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('focusin',focusGuard,true);
  document.addEventListener('keydown',keyGuard,true);
  document.body.classList.add('music-choice-locked');
 }
 function request(){
  if(getChoice())return false;
  if(!document.body){document.addEventListener('DOMContentLoaded',request,{once:true});return false}
  // Name screen always comes first. Returning-user welcome must finish too.
  if($('nameModal')?.classList.contains('show')||$('welcomeScreen')?.classList.contains('show'))return false;
  if(screen)return true;
  previousFocus=document.activeElement;
  screen=document.createElement('section');
  screen.id='eightapdfMusicChoice';
  screen.className='music-choice-screen';
  screen.setAttribute('role','dialog');
  screen.setAttribute('aria-modal','true');
  screen.setAttribute('aria-labelledby','musicChoiceTitle');
  screen.setAttribute('aria-describedby','musicChoiceDescription');
  screen.tabIndex=-1;
  screen.innerHTML="<div class=\"mc-stage\">\n  <header class=\"mc-masthead\">\n    <span class=\"mc-wordmark\"><span class=\"mc-logo\" aria-hidden=\"true\">8</span>8aPDF</span>\n    <span class=\"mc-edition\">YOUR SPACE · YOUR RULES</span>\n  </header>\n  <div class=\"mc-composition\">\n    <div class=\"mc-intro\">\n      <p class=\"mc-kicker\"><span></span>02 / SET THE MOOD</p>\n      <h2 id=\"musicChoiceTitle\">Your space.<span>Your sound.</span></h2>\n      <p id=\"musicChoiceDescription\">Would you like to enable background music while you study?</p>\n      <div class=\"mc-equalizer\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>\n      <p class=\"mc-track-note\">TUM HI HO &nbsp;·&nbsp; KHAIRIYAT &nbsp;·&nbsp; SAIYAARA</p>\n    </div>\n    <div class=\"mc-decisions\" role=\"group\" aria-label=\"Choose your background music preference\">\n      <p class=\"mc-decisions-label\">MAKE IT YOURS <span>CHOOSE ONE TO CONTINUE</span></p>\n      <button type=\"button\" class=\"mc-option mc-on\" data-music-choice=\"with\">\n        <span class=\"mc-option-icon\" aria-hidden=\"true\">♫</span>\n        <span class=\"mc-option-copy\"><strong>With Music</strong><small>Study with three soft background tracks.</small></span>\n        <span class=\"mc-option-arrow\" aria-hidden=\"true\">↗</span>\n      </button>\n      <button type=\"button\" class=\"mc-option mc-off\" data-music-choice=\"without\">\n        <span class=\"mc-option-icon\" aria-hidden=\"true\">◌</span>\n        <span class=\"mc-option-copy\"><strong>No Music</strong><small>A quiet workspace, with no background music.</small></span>\n        <span class=\"mc-option-arrow\" aria-hidden=\"true\">↗</span>\n      </button>\n      <p class=\"mc-saved-note\">Your choice is saved on this device. You can change it anytime in Settings.</p>\n    </div>\n  </div>\n  <footer class=\"mc-footer\"><span>ONE SIMPLE CHOICE</span><span>MADE FOR YOUR FOCUS</span></footer>\n</div>";
  document.body.appendChild(screen);
  screen.querySelectorAll('[data-music-choice]').forEach(button=>{
   button.addEventListener('click',()=>choose(button.dataset.musicChoice));
  });
  lockSite();
  screen.querySelector('[data-music-choice]')?.focus({preventScroll:true});
  return true;
 }
 window.__8apdfMusicConsent={request,getChoice,isComplete:()=>Boolean(getChoice())};
 // The full-page step is shown after either the explicit name callback or
 // a returning-user welcome. The guard is a fallback for deep-link entries.
 document.addEventListener('DOMContentLoaded',request,{once:true});
 window.addEventListener('pageshow',()=>{if(!getChoice())request()});
})();
