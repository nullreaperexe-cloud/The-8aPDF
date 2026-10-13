/* Elfsight stays mounted. Use media APIs only when a real track is ready. */
(()=>{'use strict';let started=false,busy=false,repairedTrack=false,yt=null,ytFrame=null,ytReady=false;
const status=(playing,blocked=false)=>{if(parent!==window)parent.postMessage({type:'8apdf:music-state',playing,blocked},location.origin)};
function mediaElements(root=document){const all=[...root.querySelectorAll('audio')];for(const el of root.querySelectorAll('*'))if(el.shadowRoot)all.push(...mediaElements(el.shadowRoot));return all;}
function youtube(widget){
 const frame=[...(widget?.querySelectorAll('iframe[src*="youtube.com/embed"]')||[])].find(f=>!f.closest('[class*="PlaylistItem__"]'));
 if(!frame||!window.YT?.Player)return false;
 if(ytFrame!==frame){ytFrame=frame;ytReady=false;frame.setAttribute('allow','autoplay; encrypted-media');
  // Official IFrame API supports attaching to an existing enablejsapi iframe.
  yt=new YT.Player(frame,{events:{onReady:e=>{ytReady=true;if(!started)e.target.playVideo()},onStateChange:e=>{if(e.data===1){started=true;status(true)}else if(e.data===2)status(false)},onAutoplayBlocked:()=>status(false,true),onError:()=>status(false,true)}});
 }
 if(ytReady&&!started)yt.playVideo();return true;
}
async function start(){
 if(started||busy)return;busy=true;
 try{
  const widget=document.querySelector('[class*="elfsight-app-"]'),media=mediaElements();
  // The supplied widget has a YouTube playlist URL configured as native audio.
  // That URL cannot be decoded as audio; select its first actual music track.
  if(!repairedTrack&&media.some(a=>/youtube\.com\/playlist/i.test(a.src))){const first=widget?.querySelector('[class*="PlaylistItem__PlaylistItemComponent"]');if(first){repairedTrack=true;first.click();return}}
  if(youtube(widget))return;
  for(const audio of media.filter(a=>a.currentSrc||a.getAttribute('src'))){audio.autoplay=true;if(!audio.paused){started=true;status(true);return}try{await audio.play();started=true;status(true);return}catch{status(false,true)}}
 }finally{busy=false}
}
window.__8apdfStartMusic=start;
document.getElementById('musicPlay').onclick=()=>{started=false;start()};
document.getElementById('musicPause').onclick=()=>{started=true;yt?.pauseVideo?.();mediaElements().forEach(a=>a.pause());status(false)};
document.addEventListener('play',()=>{started=true;status(true)},true);document.addEventListener('pause',()=>status(false),true);
document.addEventListener('pointerdown',start,{passive:true});
let retry=0;new MutationObserver(()=>{clearTimeout(retry);retry=setTimeout(start,80)}).observe(document.body,{childList:true,subtree:true});
let attempts=0;const loading=setInterval(()=>{if(started||++attempts>60){clearInterval(loading);return}start()},500);start();
})();
