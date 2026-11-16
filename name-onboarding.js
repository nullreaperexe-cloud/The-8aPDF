/* Optional 8aPDF name onboarding. Old names and music choices are never overwritten by Skip. */
(()=>{
 'use strict';
 const NAME_MARKER='8apdf_crimson_fresh_name_v20261115';
 const GUEST_KEY='8apdf_onboarding_deferred_v1';
 const MUSIC_DEFERRED='8apdf_music_deferred_v1';
 const NAME_KEYS=['eightapdf_user_name_v2','eightapdf_user_name'];
 const read=key=>{
  for(const kind of ['localStorage','sessionStorage']){
   try{const value=window[kind].getItem(key);if(value!==null)return value}catch{}
  }
  return '';
 };
 const write=(key,value)=>{
  for(const kind of ['localStorage','sessionStorage']){
   try{window[kind].setItem(key,value);return true}catch{}
  }
  return false;
 };
 const deferred=()=>window.__8apdfGuestDeferred===true||read(GUEST_KEY)==='1';
 window.__8apdfGuestDeferred=deferred();
 window.initNameOnboarding=({onConfirm=()=>{},onFinish=()=>{}}={})=>{
  // A pre-existing name is authoritative even if a redesigned version marker is missing.
  if(deferred()||NAME_KEYS.some(key=>read(key).trim()))return false;
  const modal=document.getElementById('nameModal'),form=document.getElementById('nameForm');
  const input=document.getElementById('nameInput'),button=form?.querySelector('.name-continue');
  const skip=document.getElementById('nameSkip'),feedback=document.getElementById('nameFeedback');
  if(!modal||!form||!input||!button||!skip)return false;
  const previousFocus=document.activeElement;
  const previouslyLocked=document.body.classList.contains('locked');
  const oldFormInert=Boolean(form.inert);
  const inert=new Map();
  let completed=false,submitting=false,stageTimer=null,leaveTimer=null;
  const reduced=()=>Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    ||document.documentElement.dataset.motion==='off';
  function lockNewSiblings(){
   for(const node of document.body.children){
    if(node===modal||inert.has(node))continue;
    inert.set(node,Boolean(node.inert));
    node.inert=true;
   }
  }
  lockNewSiblings();
  const observer=new MutationObserver(lockNewSiblings);
  observer.observe(document.body,{childList:true});
  const keepFocus=e=>{if(!modal.contains(e.target))modal.focus({preventScroll:true})};
  const trap=e=>{
   if(e.key!=='Tab')return;
   const controls=[...modal.querySelectorAll('input,button')].filter(node=>
    !node.disabled&&!node.inert&&(!node.getClientRects||node.getClientRects().length));
   if(!controls.length){e.preventDefault();modal.focus({preventScroll:true});return}
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('focusin',keepFocus);
  modal.addEventListener('keydown',trap);
  function cleanup(skipped){
   if(completed)return;
   completed=true;
   if(stageTimer!==null)clearTimeout(stageTimer);
   if(leaveTimer!==null)clearTimeout(leaveTimer);
   observer.disconnect();
   document.removeEventListener('focusin',keepFocus);
   modal.removeEventListener('keydown',trap);
   input.removeEventListener('input',update);
   form.removeEventListener('submit',submit);
   skip.removeEventListener('click',onSkip);
   for(const [node,wasInert] of inert)if(node.isConnected)node.inert=wasInert;
   inert.clear();
   form.inert=oldFormInert;
   input.readOnly=false;
   modal.classList.remove('show','name-leaving');
   modal.setAttribute('aria-hidden','true');
   delete modal.dataset.phase;
   delete document.documentElement.dataset.entryPending;
   if(!previouslyLocked)document.body.classList.remove('locked');
   const target=previousFocus?.isConnected&&previousFocus!==document.body
     ?previousFocus:document.getElementById('profileBtn');
   if(target?.isConnected)target.focus?.({preventScroll:true});
   onFinish({skipped});
  }
  function onSkip(){
   if(submitting||completed)return;
   write(GUEST_KEY,'1');
   write(MUSIC_DEFERRED,'1');
   window.__8apdfGuestDeferred=true; // session-only fallback when storage is blocked
   document.documentElement.dataset.onboard='deferred';
   cleanup(true); // no welcome transition or other permission/consent overlays
  }
  function update(){
   button.disabled=submitting||!input.value.trim();
   input.removeAttribute('aria-invalid');
   if(feedback)feedback.textContent='Your name is optional. You can browse PDFs as a guest.';
  }
  function submit(event){
   event.preventDefault();
   if(completed||submitting)return;
   const name=input.value.trim();
   if(!name){
    input.setAttribute('aria-invalid','true');
    if(feedback)feedback.textContent='Enter a name or choose Skip / Browse PDFs.';
    input.focus({preventScroll:true});return;
   }
   submitting=true;
   NAME_KEYS.forEach(key=>write(key,name));
   write(NAME_MARKER,'complete');
   onConfirm(name);
   input.value=name;input.readOnly=true;button.disabled=true;
   const label=button.querySelector('span');
   if(label)label.textContent='Opening your workspace';
   const title=document.getElementById('nameWelcomeTitle');
   const detail=document.getElementById('nameWelcomeDetail');
   if(title)title.textContent='Welcome, '+name;
   if(detail)detail.textContent='Opening your PDF study library...';
   modal.dataset.phase='welcome';form.inert=true;modal.focus({preventScroll:true});
   stageTimer=setTimeout(()=>{
    modal.classList.add('name-leaving');
    leaveTimer=setTimeout(()=>cleanup(false),reduced()?0:280);
   },reduced()?160:1050);
  }
  document.body.classList.add('locked');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  delete document.documentElement.dataset.entryPending;
  input.value='';
  input.addEventListener('input',update);
  form.addEventListener('submit',submit);
  skip.addEventListener('click',onSkip);
  update();
  input.focus({preventScroll:true});
  return true;
 };
})();
