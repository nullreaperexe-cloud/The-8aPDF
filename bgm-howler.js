/* 8aPDF invisible background music: external MP3, Howler.js streaming, Settings-only controls. */
(()=>{
  'use strict';
  const AUDIO_URL='https://8apdf.xo.je/BGM.MP3?i=1';
  const STORAGE='8apdf_background_music_v1';
  const DEFAULTS={enabled:true,volume:18};
  let prefs={...DEFAULTS};
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(saved&&typeof saved==='object'){
      if(typeof saved.enabled==='boolean')prefs.enabled=saved.enabled;
      if(Number.isFinite(saved.volume))prefs.volume=Math.max(0,Math.min(100,Math.round(saved.volume)));
    }
  } catch {}
  let sound=null,mode='',starting=false,sourceFailed=false,statusNode=null,toggleNode=null,rangeNode=null,volumeNode=null;
  const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(prefs))}catch{}};
  function setStatus(message){
    if(statusNode)statusNode.textContent=message;
  }
  function playing(){
    if(!sound)return false;
    return mode==='howler'?sound.playing():!sound.paused;
  }
  function makeSound(){
    if(sound||sourceFailed)return;
    if(typeof window.Howl==='function'){
      mode='howler';
      sound=new window.Howl({
        src:[AUDIO_URL],format:['mp3'],html5:true,preload:'metadata',
        loop:true,volume:prefs.volume/100,
        onplay(){starting=false;setStatus('Playing quietly in the background.');},
        onpause(){starting=false;if(!prefs.enabled)setStatus('Music is off.');},
        onplayerror(_id,error){starting=false;setStatus('Autoplay is blocked. Tap anywhere on 8aPDF to start music.');console.info('8aPDF BGM: browser blocked audio start',error);},
        onloaderror(_id,error){starting=false;sourceFailed=true;setStatus('Music link unavailable. Check that BGM.MP3 opens as audio.');console.warn('8aPDF BGM: remote MP3 failed to load',error);}
      });
    }else{
      mode='native';
      sound=new Audio();
      sound.src=AUDIO_URL;
      sound.preload='none';
      sound.loop=true;
      sound.volume=prefs.volume/100;
      sound.addEventListener('playing',()=>{starting=false;setStatus('Playing quietly in the background.');});
      sound.addEventListener('error',()=>{starting=false;sourceFailed=true;setStatus('Music link unavailable. Check that BGM.MP3 opens as audio.');});
    }
  }
  function start(){
    if(!prefs.enabled||sourceFailed||starting||playing())return;
    makeSound();
    if(!sound)return;
    starting=true;
    try{
      if(mode==='howler'){
        sound.play();
      }else{
        const attempt=sound.play();
        if(attempt&&typeof attempt.catch==='function'){
          attempt.then(()=>{starting=false;setStatus('Playing quietly in the background.');}).catch(()=>{
            starting=false;setStatus('Autoplay is blocked. Tap anywhere on 8aPDF to start music.');
          });
        }else starting=false;
      }
    }catch(error){
      starting=false;setStatus('Tap anywhere on 8aPDF to start music.');
      console.info('8aPDF BGM could not start:',error);
    }
  }
  function pause(){
    if(sound){
      try{sound.pause()}catch{}
    }
    starting=false;
  }
  function setVolume(value){
    prefs.volume=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
    if(sound){try{sound.volume(prefs.volume/100)}catch{if(mode==='native')sound.volume=prefs.volume/100}}
    if(volumeNode)volumeNode.textContent=prefs.volume+'%';
    if(rangeNode)rangeNode.value=String(prefs.volume);
    save();
  }
  function enable(value){
    prefs.enabled=!!value;
    save();
    if(toggleNode)toggleNode.checked=prefs.enabled;
    if(rangeNode)rangeNode.disabled=!prefs.enabled;
    if(!prefs.enabled){pause();setStatus('Music is off.');return}
    setStatus('Loading background music…');
    start();
  }
  function mountSettings(){
    let host=document.getElementById('eightapdfSettingsMusic');
    if(!host){
      const parent=document.getElementById('studioUiSetting')||document.querySelector('#settingsPanel .setting-body');
      if(!parent)return;
      host=document.createElement('div');host.id='eightapdfSettingsMusic';host.className='eightapdf-settings-music';
      parent.appendChild(host);
    }
    host.innerHTML='<h4>Background Music</h4>'+
      '<p>Invisible, looping music from your BGM.MP3 link. No floating widget or music upload.</p>'+
      '<label class="eightapdf-setting-toggle" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0">'+
      '<span>Enable background music</span><input id="eightapdfBgmToggle" type="checkbox" aria-label="Enable background music"></label>'+
      '<label for="eightapdfBgmVolume" style="display:flex;justify-content:space-between;gap:12px;margin:14px 0 6px">'+
      '<span>Music volume</span><strong id="eightapdfBgmVolumeLabel">18%</strong></label>'+
      '<input id="eightapdfBgmVolume" type="range" min="0" max="100" step="1" aria-label="Background music volume" style="width:100%;accent-color:var(--button,#ddd)">'+
      '<p id="eightapdfBgmStatus" role="status" aria-live="polite" style="font-size:12px;color:var(--muted,#999);margin-top:10px">Preparing music…</p>';
    toggleNode=document.getElementById('eightapdfBgmToggle');
    rangeNode=document.getElementById('eightapdfBgmVolume');
    volumeNode=document.getElementById('eightapdfBgmVolumeLabel');
    statusNode=document.getElementById('eightapdfBgmStatus');
    toggleNode.checked=prefs.enabled;
    rangeNode.value=String(prefs.volume);
    rangeNode.disabled=!prefs.enabled;
    volumeNode.textContent=prefs.volume+'%';
    toggleNode.addEventListener('change',()=>enable(toggleNode.checked));
    rangeNode.addEventListener('input',()=>setVolume(rangeNode.value));
    setStatus(prefs.enabled?'Preparing music…':'Music is off.');
  }
  function unlock(){
    if(prefs.enabled&&!sourceFailed&&!playing())start();
  }
  function init(){
    mountSettings();
    document.addEventListener('click',unlock,true);
    document.addEventListener('keydown',unlock,true);
    document.addEventListener('touchend',unlock,{passive:true,capture:true});
    if(prefs.enabled)start();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.__8apdfBackgroundAudio={play:()=>enable(true),stop:()=>enable(false),setVolume,getState:()=>({...prefs,playing:playing()})};
})();