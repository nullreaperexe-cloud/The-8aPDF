/* 8aPDF optional name onboarding. No account or fabricated identity for guests. */
(() => {
 'use strict';
 const NAME_MARKER='8apdf_crimson_fresh_name_v20261115';
 const GUEST_MARKER='8apdf_guest_browse_v1';
 const nameKeys=['eightapdf_user_name_v2','eightapdf_user_name'];
 let guestInMemory=false;
 const read=key=>{
  for(const kind of ['localStorage','sessionStorage']){
   try{const v=window[kind].getItem(key);if(v!==null)return v}catch{}
  }
  return '';
 };
 const write=(key,value)=>{
  for(const kind of ['localStorage','sessionStorage']){
   try{window[kind].setItem(key,value);return true}catch{}
  }
  return false;
 };
 const remove=key=>{
  for(const kind of ['localStorage','sessionStorage']){
   try{window[kind].removeItem(key)}catch{}
  }
 };
 const isGuest=()=>guestInMemory||read(GUEST_MARKER)==='1';
 const enterGuest=()=>{
  guestInMemory=true;write(GUEST_MARKER,'1');
  document.documentElement.dataset.guest='on';
  delete document.documentElement.dataset.entryPending;
  document.dispatchEvent(new Event('8apdf:guest-browse'));
 };
 const leaveGuest=()=>{
  guestInMemory=false;remove(GUEST_MARKER);
  delete document.documentElement.dataset.guest;
 };
 window.__8apdfGuest={isGuest,enter:enterGuest,leave:leaveGuest,key:GUEST_MARKER};
 window.initNameOnboarding=({onConfirm=()=>{},onFinish=()=>{}}={})=>{
  const needsName=!isGuest()&&(read(NAME_MARKER)!=='complete'||!nameKeys.some(key=>read(key).trim()));
  if(!needsName)return false;
  const modal=document.getElementById('nameModal'),form=document.getElementById('nameForm');
  if(!modal||!form)return false;
  const input=document.getElementById('nameInput');
  const submit=form.querySelector('[type="submit"]');
  const skip=document.getElementById('skipNameOnboarding');
  const feedback=document.getElementById('nameFeedback');
  if(!input||!submit||!skip||!feedback)return false;
  const previousFocus=document.activeElement;
  const beforeLocked=document.body.classList.contains('locked');
  const originalInert=new Map();
  let submitting=false,finished=false,finishing=false;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||
    document.documentElement.dataset.motion==='off';
  const lock=()=>{
   for(const node of document.body.children){
    if(node===modal||originalInert.has(node))continue;
    originalInert.set(node,!!node.inert);
    node.inert=true;
   }
  };
  lock();
  const observer=new MutationObserver(lock);
  observer.observe(document.body,{childList:true});
  const keepFocus=e=>{
   if(!finishing&&!modal.contains(e.target))modal.focus({preventScroll:true});
  };
  const controls=()=>[...modal.querySelectorAll('input,button')].filter(
   node=>!node.disabled&&!node.inert&&node.getClientRects().length
  );
  const trap=e=>{
   if(e.key!=='Tab')return;
   const items=controls();
   if(!items.length){e.preventDefault();modal.focus();return}
   const first=items[0],last=items.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('focusin',keepFocus);
  modal.addEventListener('keydown',trap);
  function finish(skipped=false){
   if(finished||finishing)return;
   finishing=true;
   modal.classList.add('name-leaving');
   window.setTimeout(()=>{
    if(finished)return;
    finished=true;
    modal.classList.remove('show','name-leaving');
    modal.setAttribute('aria-hidden','true');
    delete modal.dataset.phase;
    delete document.documentElement.dataset.entryPending;
    if(!beforeLocked)document.body.classList.remove('locked');
    observer.disconnect();
    document.removeEventListener('focusin',keepFocus);
    modal.removeEventListener('keydown',trap);
    input.removeEventListener('input',update);
    form.removeEventListener('submit',handleSubmit);
    skip.removeEventListener('click',handleSkip);
    for(const [node,wasInert] of originalInert)if(node.isConnected)node.inert=wasInert;
    originalInert.clear();
    form.inert=false;
    const target=previousFocus?.isConnected&&previousFocus!==document.body?
      previousFocus:document.getElementById('profileBtn')||document.getElementById('searchInput');
    target?.focus?.({preventScroll:true});
    onFinish({skipped});
   },skipped||reduced()?0:280);
  }
  function update(){
   submit.disabled=submitting||!input.value.trim();
   input.removeAttribute('aria-invalid');
   feedback.textContent='Just your name. Make yourself at home.';
  }
  function handleSkip(){
   if(submitting||finishing)return;
   enterGuest();
   finish(true);
  }
  function handleSubmit(e){
   e.preventDefault();
   if(submitting||finishing)return;
   const name=input.value.trim();
   if(!name){
    input.setAttribute('aria-invalid','true');
    feedback.textContent='Please enter your name or choose Browse PDFs.';
    input.focus();
    return;
   }
   submitting=true;input.value=name;input.readOnly=true;submit.disabled=true;
   const label=submit.querySelector('span');if(label)label.textContent='Opening your workspace';
   nameKeys.forEach(k=>write(k,name));
   write(NAME_MARKER,'complete');
   leaveGuest();
   onConfirm(name);
   document.getElementById('nameWelcomeTitle').textContent='Welcome, '+name;
   document.getElementById('nameWelcomeDetail').textContent='Opening your PDF study library...';
   modal.dataset.phase='welcome';form.inert=true;modal.focus({preventScroll:true});
   window.setTimeout(()=>finish(false),reduced()?160:1050);
  }
  document.body.classList.add('locked');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  delete document.documentElement.dataset.entryPending;
  input.value='';
  input.readOnly=false;
  input.addEventListener('input',update);
  form.addEventListener('submit',handleSubmit);
  skip.addEventListener('click',handleSkip);
  update();input.focus({preventScroll:true});
  return true;
 };
})();
