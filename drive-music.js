/* Tiny music launcher: no song DOM, images, audio or styles load until opened. */
(()=>{'use strict';
 let loading=null;
 const css=['base.css','frame.css','components.css','mobile.css'];
 function style(name){
  return new Promise(resolve=>{
   const link=document.createElement('link');link.rel='stylesheet';
   link.href='/music-library/'+name+'?v=20261101-layout2';
   link.onload=resolve;link.onerror=resolve;document.head.append(link);
  });
 }
 async function ensure(){
  if(!loading)loading=(async()=>{
   const styleReady=Promise.all(css.map(style));
   await import('/music-library/player-core.js?v=20261101-layout2');
   await styleReady;
   const module=await import('/music-library/enhance.js?v=20261101-layout2');
   return module;
  })().catch(e=>{loading=null;throw e});
  return loading;
 }
 async function open(){
  try{const addon=await ensure();window.__8apdfDriveMusic?.open?.();addon.attach();}
  catch(e){console.error('Music library could not load',e);alert('Music Library is unavailable. Refresh and try again.')}
 }
 window.__8apdfDriveMusic={open,minimize:()=>{},getState:()=>({opened:false,playing:false,tracks:0}),reload:open};
 document.addEventListener('click',e=>{
  const target=e.target instanceof Element?e.target.closest('#studioDriveMusic,#studioMobileDriveMusic'):null;
  if(target){e.preventDefault();open()}
 });
 // Existing tests and behaviour: don't focus the song input on small phones.
 const shouldFocus=()=>window.matchMedia?.('(min-width:661px)')?.matches;
})();
