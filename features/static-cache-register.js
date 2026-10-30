/* Idle-only static cache registration; no push subscription or permission request. */
(()=>{'use strict';
 if(!window.isSecureContext||!('serviceWorker' in navigator))return;
 let started=false;
 async function register(){
  if(started)return;started=true;
  try{
   const existing=await navigator.serviceWorker.getRegistration('/');
   if(!existing)await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  }catch{/* Offline and unsupported browsers remain fully functional. */}
 }
 function idle(){
  if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(register,{timeout:4500});
  else setTimeout(register,2200);
 }
 if(document.readyState==='complete')idle();
 else window.addEventListener('load',idle,{once:true});
})();
