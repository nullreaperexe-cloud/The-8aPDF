(()=>{'use strict';let started=false,busy=false,triedButton=false;
const status=(playing,blocked=false)=>{if(parent!==window)parent.postMessage({type:'8apdf:music-state',playing,blocked},location.origin)};
function mediaElements(root=document){const all=[...root.querySelectorAll('audio')];for(const el of root.querySelectorAll('*'))if(el.shadowRoot)all.push(...mediaElements(el.shadowRoot));return all;}
async function start(){
 if(started||busy)return;busy=true;
 try{
  const media=mediaElements();if(media.length){for(const audio of media){audio.autoplay=true;if(!audio.paused){started=true;status(true);return}try{await audio.play();started=true;status(true);return}catch{status(false,true)}}}
  if(!media.length&&!triedButton){const widget=document.querySelector('[class*="elfsight-app-"]'),button=widget&&[...widget.querySelectorAll('button,[role="button"]')].find(el=>/^play(?: music| audio| track)?$/i.test((el.getAttribute('aria-label')||el.title||el.textContent||'').trim()));if(button){triedButton=true;button.click();}}
 }finally{busy=false}
}
window.__8apdfStartMusic=()=>{if(!started)triedButton=false;return start()};
document.addEventListener('play',()=>{started=true;status(true)},true);document.addEventListener('pause',()=>status(false),true);
document.addEventListener('pointerdown',()=>window.__8apdfStartMusic(),{passive:true});
let retry=0;new MutationObserver(()=>{clearTimeout(retry);retry=setTimeout(start,80)}).observe(document.body,{childList:true,subtree:true});
start();
})();
