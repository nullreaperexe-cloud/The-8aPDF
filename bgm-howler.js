/* 8aPDF invisible music: external stream only; controls live in website Settings. */
(()=>{
'use strict';
const URL_AUDIO='https://8apdf.xo.je/BGM.MP3?i=1';
const PREF_KEY='8apdf_background_music_v1';
let pref={enabled:true,volume:18};
try{const v=JSON.parse(localStorage.getItem(PREF_KEY)||'null');if(v&&typeof v==='object'){if(typeof v.enabled==='boolean')pref.enabled=v.enabled;if(Number.isFinite(v.volume))pref.volume=Math.max(0,Math.min(100,Math.round(v.volume)));}}catch{}
const persist=()=>{try{localStorage.setItem(PREF_KEY,JSON.stringify(pref));}catch{}};
const $=id=>document.getElementById(id);
let music=null,engine='',playing=false,pending=false,blocked=false,sourceError='',playedId=null;
const status=s=>{const e=$('eightapdfBgmStatus');if(e)e.textContent=s;};
function sync(){
 const toggle=$('eightapdfBgmToggle'),range=$('eightapdfBgmVolume'),value=$('eightapdfBgmVolumeLabel'),button=$('eightapdfBgmTest');
 if(toggle)toggle.checked=pref.enabled;
 if(range){range.disabled=!pref.enabled;range.value=String(pref.volume);}
 if(value)value.textContent=pref.volume+'%';
 if(button){button.disabled=!pref.enabled;button.textContent=playing?'❚❚ Pause music':'▶ Play / Test music';}
}
function reportMediaError(prefix,e){
 const n=(engine==='native'?music?.error?.code:e);
 return prefix+' (media error '+String(n??'unknown')+'). The external xo.je host may block playback from other websites.';
}
function clearPlayer(){
 if(!music)return;
 try{engine==='howler'?music.unload():(music.pause(),music.removeAttribute('src'),music.load());}catch{}
 music=null;playing=false;pending=false;playedId=null;
}
function makeNative(){
 clearPlayer();
 engine='native';
 music=document.createElement('audio');
 music.src=URL_AUDIO;
 music.loop=true;
 music.preload='none';
 music.volume=pref.volume/100;
 music.addEventListener('playing',()=>{playing=true;pending=false;blocked=false;sourceError='';status('Playing in the background ✓');sync();});
 music.addEventListener('pause',()=>{playing=false;pending=false;sync();if(!pref.enabled)status('Music is off.');});
 music.addEventListener('waiting',()=>{status('Buffering external music…');});
 music.addEventListener('error',()=>{playing=false;pending=false;sourceError=reportMediaError('Could not load the audio',null);status(sourceError);sync();console.warn('8aPDF BGM: remote audio failed. Check browser Network tab for 403, blocked hotlinking, or HTML instead of MP3.');});
 sync();
}
function makeHowler(){
 if(music)return;
 if(typeof window.Howl!=='function'){makeNative();return;}
 engine='howler';
 music=new window.Howl({
  src:[URL_AUDIO],format:['mp3'],html5:true,preload:'metadata',
  loop:true,volume:pref.volume/100,
  onplay(){playing=true;pending=false;blocked=false;sourceError='';status('Playing in the background ✓');sync();},
  onpause(){playing=false;pending=false;sync();if(!pref.enabled)status('Music is off.');},
  onstop(){playing=false;pending=false;sync();},
  onplayerror(id,error){
   pending=false;playing=false;blocked=true;
   status('Browser blocked autoplay. Click Play / Test music, or tap the page once.');
   sync();console.info('8aPDF BGM: autoplay denied',error);
   if(music&&engine==='howler')music.once('unlock',()=>{if(pref.enabled&&!playing)start();});
  },
  onloaderror(id,error){
   pending=false;playing=false;sourceError=reportMediaError('Howler could not load the audio',error);
   console.warn('8aPDF BGM:',sourceError,'Trying native HTML5 audio.');
   status('Howler could not load MP3. Trying browser audio engine…');
   const retry=pref.enabled&&!blocked;
   makeNative();
   if(retry)start();
  }
 });
}
function start(){
 if(!pref.enabled||playing||pending)return;
 if(!music)makeHowler();
 if(!music)return;
 pending=true;sourceError='';
 status('Connecting to background music…');
 try{
  if(engine==='howler'){
   const id=music.play();
   if(typeof id==='number')playedId=id;
   // Await onplay/onplayerror; do not claim music has started before the event.
  }else{
   const promise=music.play();
   if(promise&&typeof promise.then==='function'){
    promise.then(()=>{pending=false;}).catch(e=>{
      pending=false;playing=false;
      if(e?.name==='NotAllowedError'){blocked=true;status('Browser blocked autoplay. Click Play / Test music.');}
      else {sourceError=reportMediaError('Could not play this MP3',e?.name);status(sourceError);}
      sync();console.warn('8aPDF BGM: audio play failed',e?.name||e);
    });
   }else pending=false;
  }
 }catch(e){pending=false;blocked=true;status('Playback failed. Click Play / Test music again.');console.warn('8aPDF BGM:',e);}
}
function pause(){
 if(music)try{music.pause();}catch{}
 pending=false;playing=false;sync();
}
function setEnabled(on){
 pref.enabled=!!on;persist();sync();
 if(!pref.enabled){pause();status('Music is off.');return;}
 status('Music enabled — preparing playback…');
 start();
}
function setVolume(n){
 pref.volume=Math.max(0,Math.min(100,Math.round(Number(n)||0)));
 if(music)try{if(engine==='howler')music.volume(pref.volume/100);else music.volume=pref.volume/100;}catch{}
 persist();sync();
}
function manualPlay(){
 if(!pref.enabled)return;
 if(playing){pause();status('Paused — music stays enabled.');return;}
 // A fresh playback attempt is allowed even if a previous attempt failed.
 pending=false;blocked=false;sourceError='';
 if(engine==='native'&&music?.error)makeNative();
 start();
}
function mount(){
 let host=$('eightapdfSettingsMusic');
 if(!host){const parent=$('studioUiSetting')||document.querySelector('#settingsPanel .setting-body');if(!parent)return;host=document.createElement('div');host.id='eightapdfSettingsMusic';host.className='eightapdf-settings-music';parent.appendChild(host);}
 host.innerHTML='<h4>Background Music</h4>'+
 '<p>Your MP3 plays invisibly while you browse. No floating music widget.</p>'+
 '<label class="eightapdf-setting-toggle" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0"><span>Enable background music</span><input id="eightapdfBgmToggle" type="checkbox" aria-label="Enable background music"></label>'+
 '<label for="eightapdfBgmVolume" style="display:flex;justify-content:space-between;gap:12px;margin:14px 0 6px"><span>Music volume</span><strong id="eightapdfBgmVolumeLabel">18%</strong></label>'+
 '<input id="eightapdfBgmVolume" type="range" min="0" max="100" step="1" aria-label="Background music volume" style="width:100%;accent-color:var(--button,#ddd)">'+
 '<button id="eightapdfBgmTest" type="button" style="margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--surface-high,#222);color:var(--text,#fff);border:1px solid var(--line,#555)">▶ Play / Test music</button>'+
 '<p id="eightapdfBgmStatus" role="status" aria-live="polite" style="font-size:12px;color:var(--muted,#999);margin-top:10px">Music not started yet.</p>';
 $('eightapdfBgmToggle').addEventListener('change',e=>setEnabled(e.target.checked));
 $('eightapdfBgmVolume').addEventListener('input',e=>setVolume(e.target.value));
 $('eightapdfBgmTest').addEventListener('click',manualPlay);
 sync();status(pref.enabled?'Ready. Browser may require Play / Test music.':'Music is off.');
}
function init(){
 mount();
 // Try genuine autoplay when allowed; retry within an actual trusted gesture otherwise.
 if(pref.enabled)start();
 for(const evt of ['pointerdown','keydown','touchend']){
  document.addEventListener(evt,e=>{
   if(!e.isTrusted||!pref.enabled||playing||pending||sourceError)return;
   if(e.target?.closest?.('#eightapdfBgmTest,#eightapdfBgmToggle'))return;
   // Prevent another attempt until the browser has actually blocked autoplay.
   if(!blocked&&music)return;
   blocked=false;start();
  },{capture:true,passive:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.__8apdfBackgroundAudio={play:()=>setEnabled(true),stop:()=>setEnabled(false),setVolume,retry:manualPlay,getState:()=>({...pref,playing,pending,engine,blocked,sourceError})};
})();