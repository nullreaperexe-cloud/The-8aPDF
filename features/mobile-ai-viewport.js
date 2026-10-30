(()=>{
  'use strict';
  const layer=document.getElementById('pdfAiLayer');
  const input=document.getElementById('pdfAiInput');
  const composer=document.getElementById('pdfAiForm');
  if(!layer||!input||!composer)return;
  let baseline=0,frame=0;
  const isMobile=()=>window.matchMedia('(max-width:750px)').matches;
  const viewport=()=>window.visualViewport;
  function synchronize(){
    frame=0;
    if(!isMobile()){
      layer.style.removeProperty('--ai-viewport-height');
      layer.style.removeProperty('--ai-viewport-top');
      delete layer.dataset.aiKeyboard;
      baseline=0;
      return;
    }
    const vv=viewport();
    const visibleHeight=vv?.height||window.innerHeight;
    const visibleTop=vv?.offsetTop||0;
    if(!Number.isFinite(visibleHeight)||visibleHeight<150)return;
    const focused=document.activeElement===input;
    if(!focused||!baseline)baseline=Math.max(baseline,visibleHeight);
    const keyboardOpen=focused&&baseline-visibleHeight>95;
    layer.style.setProperty('--ai-viewport-height',visibleHeight+'px');
    layer.style.setProperty('--ai-viewport-top',visibleTop+'px');
    layer.dataset.aiKeyboard=keyboardOpen?'open':'closed';
    // The message log scrolls independently; the input stays anchored above the keyboard.
  }
  function queueSync(){
    if(frame)return;
    frame=requestAnimationFrame(synchronize);
  }
  const vv=viewport();
  vv?.addEventListener('resize',queueSync,{passive:true});
  vv?.addEventListener('scroll',queueSync,{passive:true});
  window.addEventListener('resize',queueSync,{passive:true});
  window.addEventListener('orientationchange',()=>{
    baseline=0;
    queueSync();
    setTimeout(queueSync,300);
  },{passive:true});
  input.addEventListener('focus',()=>{
    queueSync();
    // Android IME changes size asynchronously across multiple animation frames.
    [80,180,340,550].forEach(delay=>setTimeout(queueSync,delay));
  });
  input.addEventListener('blur',()=>{
    queueSync();
    setTimeout(queueSync,180);
  });
  // The route can be opened directly from /chatbot as well as via the sidebar.
  document.getElementById('studioAssistantLink')?.addEventListener('click',queueSync);
  document.getElementById('pdfAiClose')?.addEventListener('click',queueSync);
  queueSync();
})();
