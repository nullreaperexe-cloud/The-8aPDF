(()=>{'use strict';let started=false,busy=false,triedButton=false,repairedTrack=false;
const status=(playing,blocked=false)=>{if(parent!==window)parent.postMessage({type:'8apdf:music-state',playing,blocked},location.origin)};
function mediaElements(root=document){const all=[...root.querySelectorAll('audio')];for(const el of root.querySelectorAll('*'))if(el.shadowRoot)all.push(...mediaElements(el.shadowRoot));return all;}
async function start(){
 if(started||busy)return;busy=true;
 try{
  const widget=document.querySelector('[class*="elfsight-app-"]');
  const media=mediaElements();
  // The supplied widget includes a YouTube playlist URL as a native audio
  // track. It cannot be decoded as audio; start its first actual music track.
  if(!repairedTrack&&media.some(a=>/youtube\.com\/playlist/i.test(a.src))){const first=widget?.querySelector('[class*="PlaylistItem__PlaylistItemComponent"]');if(first){repairedTrack=true;first.click();return;}}
  if(media.length){for(const audio of media){audio.autoplay=true;if(!audio.paused){started=true;status(true);return}try{await audio.play();started=true;status(true);return}catch{status(false,true)}}}
  if(!media.length&&!triedButton){const button=widget&&[...widget.querySelectorAll('button,[role="button"]')].find(el=>/^play(?: music| audio| track)?$/i.test((el.getAttribute('aria-label')||el.title||el.textContent||'').trim()));if(button){triedButton=true;button.click();}}
 }finally{busy=false}
}
window.addEventListener('message',e=>{if(!/^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com$/.test(e.origin)||![...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))return;try{const data=typeof e.data==='string'?JSON.parse(e.data):e.data;if(data?.info?.playerState===1){started=true;status(true)}else if(data?.info?.playerState===2)status(false)}catch{}});
window.__8apdfStartMusic=()=>{if(!started)triedButton=false;return start()};
document.addEventListener('play',()=>{started=true;status(true)},true);document.addEventListener('pause',()=>status(false),true);
document.addEventListener('pointerdown',()=>window.__8apdfStartMusic(),{passive:true});
let retry=0;new MutationObserver(()=>{clearTimeout(retry);retry=setTimeout(start,80)}).observe(document.body,{childList:true,subtree:true});
start();
})();
