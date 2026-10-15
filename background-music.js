/* 8aPDF unobtrusive background music: no floating controls. */
(()=>{'use strict';
const SOURCE='https://8apdf.xo.je/bgm.mp3';
const ENABLE_KEY='8apdf_bgm_enabled_v1',VOLUME_KEY='8apdf_bgm_volume_v1';
const read=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
let enabled=read(ENABLE_KEY,'true')!=='false';
let volume=Math.max(0,Math.min(100,Number(read(VOLUME_KEY,'35'))||0));
const audio=new Audio();
audio.src=SOURCE;audio.loop=true;audio.preload='auto';audio.volume=volume/100;audio.hidden=true;
audio.setAttribute('aria-hidden','true');
let blocked=false,loading=false;
const $=id=>document.getElementById(id);
function status(message){const el=$('bgmStatus');if(el)el.textContent=message;}
function sync(){if($('bgmEnable'))$('bgmEnable').checked=enabled;if($('bgmVolume'))$('bgmVolume').value=String(volume);if($('bgmVolumeValue'))$('bgmVolumeValue').textContent=volume+'%';if($('bgmVolume'))$('bgmVolume').disabled=!enabled;}
async function start(){
 if(!enabled||!audio.paused||loading)return;
 loading=true;
 try{await audio.play();blocked=false;status('Background music is playing.')}
 catch(e){blocked=true;status(e?.name==='NotAllowedError'?'Your browser blocked autoplay. Music will start after your first interaction.':'Music could not load. Please check the MP3 link.');}
 finally{loading=false;}
}
function setEnabled(value){enabled=!!value;save(ENABLE_KEY,enabled);sync();if(enabled)start();else{audio.pause();blocked=false;status('Background music is off.');}}
function setVolume(value){volume=Math.max(0,Math.min(100,Number(value)||0));audio.volume=volume/100;save(VOLUME_KEY,volume);sync();}
function unlock(){if(enabled&&audio.paused)start();}
['pointerdown','keydown','touchend'].forEach(event=>document.addEventListener(event,unlock,{capture:true,passive:true}));
audio.addEventListener('error',()=>status('Audio unavailable. Check https://8apdf.xo.je/bgm.mp3'));
audio.addEventListener('playing',()=>status('Background music is playing.'));
function mount(){
 const toggle=$('bgmEnable'),slider=$('bgmVolume');
 if(toggle)toggle.addEventListener('change',()=>setEnabled(toggle.checked));
 if(slider)slider.addEventListener('input',()=>setVolume(slider.value));
 sync();if(enabled&&blocked)status('Autoplay blocked — interact with the page to hear music.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.__8apdfBGM={audio,start,setEnabled,setVolume};
if(enabled)start();
})();