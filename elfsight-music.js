/* Elfsight music integration: invisible host, controls only in Settings. */
(()=>{'use strict';
const ENABLE='8apdf_bgm_enabled_v1',VOLUME='8apdf_bgm_volume_v1';
const get=(key,fallback)=>{try{return localStorage.getItem(key)??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
let enabled=get(ENABLE,'true')!=='false';
let volume=Math.min(100,Math.max(0,Number(get(VOLUME,'35'))||0));
const $=id=>document.getElementById(id);
const host=()=>document.getElementById('elfsightMusicHost');
const status=t=>{const el=$('bgmStatus');if(el)el.textContent=t};
function sync(){if($('bgmEnable'))$('bgmEnable').checked=enabled;if($('bgmVolume'))$('bgmVolume').value=volume;if($('bgmVolumeValue'))$('bgmVolumeValue').textContent=volume+'%';}
function players(){const h=host();if(!h)return[];return [...h.querySelectorAll('audio,video')];}
function apply(){const h=host();if(!h)return;h.style.display=enabled?'block':'none';for(const media of players()){media.volume=volume/100;if(!enabled)media.pause();}sync();}
function tryPlay(){if(!enabled)return;apply();const media=players();if(media.length){Promise.allSettled(media.map(a=>a.play())).then(results=>status(results.some(r=>r.status==='fulfilled')?'Music playback requested.':'Browser blocked autoplay. Try again after interacting with the page.'));return;}
const h=host();const frames=h?[...h.querySelectorAll('iframe')]:[];
status(frames.length?'Elfsight loaded. Playback is controlled by Elfsight; automatic play and volume cannot be guaranteed.':'Loading Elfsight audio player…');
}
function mount(){const h=host();if(!h)return;const observer=new MutationObserver(()=>{apply();if(enabled&&players().length)tryPlay();});observer.observe(h,{childList:true,subtree:true});
$('bgmEnable')?.addEventListener('change',e=>{enabled=e.target.checked;save(ENABLE,enabled);apply();if(enabled)tryPlay();else status('Music is off in Settings.');});
$('bgmVolume')?.addEventListener('input',e=>{volume=Math.max(0,Math.min(100,Number(e.target.value)||0));save(VOLUME,volume);apply();if(!players().length)status('Elfsight iframe volume cannot be controlled from this slider.');});
$('bgmRetry')?.addEventListener('click',tryPlay);
apply();if(enabled)tryPlay();else status('Music is off in Settings.');
const script=document.createElement('script');script.src='https://elfsightcdn.com/platform.js';script.async=true;script.onload=()=>{apply();if(enabled)tryPlay()};script.onerror=()=>status('Could not load Elfsight. Check network or content blocker.');document.head.appendChild(script);
['pointerdown','keydown','touchend'].forEach(type=>document.addEventListener(type,()=>{if(enabled&&players().length)tryPlay()},{once:true,passive:true}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();