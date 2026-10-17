/* 8aPDF background music — original local MP3s, no audio conversion.
   First visit: Tum Hi Ho. Following page loads: random different song.
   A temporary legacy fallback prevents a silent site until all four MP3s are uploaded. */
(()=>{
'use strict';
const TRACKS=[
 {id:'tum-hi-ho',title:'Tum Hi Ho',detail:'Piano Cover · Aakash Desai',url:'/assets/bgm/tum-hi-ho.mp3'},
 {id:'meri-duniya',title:'Meri Duniya Tu Hi Re',detail:'Heyy Babyy · Lyrical',url:'/assets/bgm/meri-duniya-tu-hi-re.mp3'},
 {id:'khairiyat',title:'Khairiyat',detail:'Piano Cover · Aakash Desai',url:'/assets/bgm/khairiyat.mp3'},
 {id:'saiyaara',title:'Saiyaara',detail:'Peaceful instrumental',url:'/assets/bgm/saiyaara.mp3'}
];
const OLD_AUDIO='/assets/8apdf-background-music.mp3';
const ZIP_ARCHIVE='/8apdf-four-original-bg-tracks.zip';
// While GitHub Actions extracts the ZIP, these exact MP3 bytes can play
// directly from its uncompressed ZIP entries, without any re-encoding.
let zipContentsPromise=null,activeBlobUrl=null,zipAttempted=false;
function originalZipTracks(){
 if(!zipContentsPromise)zipContentsPromise=fetch(ZIP_ARCHIVE,{cache:'force-cache'}).then(async r=>{
  if(!r.ok)throw Error('Music archive unavailable (HTTP '+r.status+')');
  const bytes=await r.arrayBuffer(),view=new DataView(bytes),tracks=new Map(),decoder=new TextDecoder();
  let pos=0;
  while(pos+30<=bytes.byteLength&&view.getUint32(pos,true)===0x04034b50){
   const flags=view.getUint16(pos+6,true),method=view.getUint16(pos+8,true);
   const size=view.getUint32(pos+18,true),nameLength=view.getUint16(pos+26,true),extra=view.getUint16(pos+28,true);
   const start=pos+30+nameLength+extra,end=start+size;
   if(method!==0||(flags&8)||end>bytes.byteLength)throw Error('Unsupported MP3 archive format');
   const name='/'+decoder.decode(new Uint8Array(bytes,pos+30,nameLength));
   tracks.set(name,new Uint8Array(bytes.slice(start,end)));
   pos=end;
  }
  if(tracks.size!==4)throw Error('Expected four original MP3 tracks in archive');
  return tracks;
 }).catch(error=>{zipContentsPromise=null;throw error});
 return zipContentsPromise;
}
async function urlFromZip(path){
 const tracks=await originalZipTracks(),bytes=tracks.get(path);
 if(!bytes)throw Error('Track is missing from music archive');
 return URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
}
const SETTINGS_KEY='8apdf_background_music_v1';
const VISITED_KEY='8apdf_music_four_tracks_seen_v2';
const LAST_KEY='8apdf_music_four_tracks_last_v2';
const get=(k)=>{try{return localStorage.getItem(k)}catch{return null}};
const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
const $=id=>document.getElementById(id);
const saved=(()=>{try{return JSON.parse(get(SETTINGS_KEY)||'null')}catch{return null}})();
const pref={
 enabled:typeof saved?.enabled==='boolean'?saved.enabled:true,
 volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(100,Math.round(saved.volume))):18
};
function persist(){put(SETTINGS_KEY,JSON.stringify(pref))}
function chooseInitial(){
 const first=get(VISITED_KEY)!=='yes',last=get(LAST_KEY);
 let chosen=TRACKS[0];
 if(!first){
  const options=TRACKS.filter(t=>t.id!==last);
  chosen=options[Math.floor(Math.random()*options.length)];
 }
 put(VISITED_KEY,'yes');put(LAST_KEY,chosen.id);
 return chosen;
}
let selected=chooseInitial(),audio=null,playing=false,pending=false,blocked=false;
let manuallyPaused=false,usingLegacy=false,sourceFailed=false,retryId=0;
const current=()=>selected.title;
const status=message=>{const e=$('eightapdfBgmStatus');if(e)e.textContent=message};
function sync(){
 const on=$('eightapdfBgmToggle'),volume=$('eightapdfBgmVolume'),percent=$('eightapdfBgmVolumeLabel');
 const choose=$('eightapdfBgmTrack'),button=$('eightapdfBgmTest'),shuffle=$('eightapdfBgmShuffle');
 const now=$('eightapdfBgmNow');
 if(on)on.checked=pref.enabled;
 if(volume){volume.value=String(pref.volume);volume.disabled=!pref.enabled}
 if(percent)percent.textContent=pref.volume+'%';
 if(choose){choose.value=selected.id;choose.disabled=!pref.enabled}
 if(button){button.disabled=!pref.enabled;button.textContent=playing?'❚❚ Pause music':'▶ Play music'}
 if(shuffle)shuffle.disabled=!pref.enabled;
 if(now)now.textContent=usingLegacy?'New MP3s pending upload':current()+' · '+selected.detail;
}
function begin(){
 if(!pref.enabled||!audio||playing||pending||sourceFailed)return;
 pending=true;blocked=false;
 status('Starting '+(usingLegacy?'temporary backup music':current())+'…');
 const source=audio.currentSrc||audio.src;
 try{
  const promise=audio.play();
  if(promise&&typeof promise.catch==='function')promise.catch(e=>{
   if(source!==(audio.currentSrc||audio.src))return;
   pending=false;playing=false;
   if(e?.name==='NotAllowedError'){blocked=true;status('Browser blocked autoplay. Tap anywhere once or press Play music.')}
   else if(!sourceFailed)status('Unable to start audio. Check your connection or press Play music.');
   sync();
  });
  else pending=false;
 }catch(e){pending=false;blocked=true;status('Audio could not start. Press Play music.');sync()}
}
function loadCurrent(){
 if(!audio)return;
 retryId++;sourceFailed=false;usingLegacy=false;pending=false;playing=false;blocked=false;zipAttempted=false;
 audio.pause();
 if(activeBlobUrl){URL.revokeObjectURL(activeBlobUrl);activeBlobUrl=null;}
 audio.src=selected.url;audio.load();sync();
 if(pref.enabled&&!manuallyPaused)begin();
}
function pickTrack(id){
 const track=TRACKS.find(t=>t.id===id);
 if(!track)return;
 selected=track;put(LAST_KEY,selected.id);
 manuallyPaused=false;
 loadCurrent();
}
function randomNext(){
 const choices=TRACKS.filter(t=>t.id!==selected.id);
 pickTrack(choices[Math.floor(Math.random()*choices.length)].id);
}
function pause(){
 manuallyPaused=true;
 if(audio)audio.pause();
 playing=false;pending=false;blocked=false;
 status('Music paused. Press Play music to resume.');sync();
}
function setEnabled(value){
 pref.enabled=!!value;persist();
 if(!pref.enabled){manuallyPaused=true;audio?.pause();playing=false;pending=false;status('Background music is off.');sync();return}
 manuallyPaused=false;sourceFailed=false;
 if(audio?.error)loadCurrent();else begin();
 sync();
}
function setVolume(value){
 pref.volume=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
 if(audio)audio.volume=pref.volume/100;
 persist();sync();
}
function togglePlayback(){
 if(!pref.enabled)return;
 if(playing){pause();return}
 manuallyPaused=false;pending=false;blocked=false;sourceFailed=false;
 if(audio?.error)loadCurrent();else begin();
}
function mount(){
 const host=$('eightapdfSettingsMusic');
 if(!host)return;
 host.innerHTML='<div class="eightapdf-bgm-header"><span class="setting-label">♫ Background Music</span><small>ORIGINAL MP3 · 4 TRACKS</small></div>'+
 '<p class="setting-explainer">First visit plays Tum Hi Ho. On every refresh, a different random track is chosen. Your manual selection plays immediately.</p>'+
 '<label class="setting-row"><span><strong>Enable background music</strong><small style="display:block;color:var(--muted)">Keep playing while browsing the website</small></span><input id="eightapdfBgmToggle" class="toggle" type="checkbox"></label>'+
 '<label for="eightapdfBgmTrack" class="eightapdf-bgm-label">Choose a song</label>'+
 '<select id="eightapdfBgmTrack" aria-label="Choose background song">'+TRACKS.map(t=>'<option value="'+t.id+'">'+t.title+'</option>').join('')+'</select>'+
 '<div class="eightapdf-bgm-now">Selected: <strong id="eightapdfBgmNow"></strong></div>'+
 '<div class="eightapdf-bgm-volume"><label for="eightapdfBgmVolume">Volume</label><strong id="eightapdfBgmVolumeLabel"></strong></div>'+
 '<input id="eightapdfBgmVolume" type="range" min="0" max="100" step="1" aria-label="Background music volume">'+
 '<div class="eightapdf-bgm-actions"><button id="eightapdfBgmTest" type="button">▶ Play music</button><button id="eightapdfBgmShuffle" type="button">⇄ Shuffle now</button></div>'+
 '<p id="eightapdfBgmStatus" aria-live="polite" role="status">Ready to play.</p>'+
 '<small class="eightapdf-bgm-help">Autoplay depends on browser permissions. If blocked, one tap anywhere starts your selected track. Audio files remain unmodified.</small>';
 const style=document.createElement('style');
 style.textContent='.eightapdf-bgm-header,.eightapdf-bgm-volume{display:flex;justify-content:space-between;align-items:center;gap:10px}.eightapdf-bgm-header small,.eightapdf-bgm-now,.eightapdf-bgm-help{font-size:.72rem;color:var(--muted)}.eightapdf-bgm-label{display:block;font-weight:650;margin:18px 0 7px;font-size:.83rem}.eightapdf-settings-music select{width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line-bold);border-radius:11px;color:var(--text);background:var(--surface-high);font:inherit}.eightapdf-bgm-now{margin:10px 0 20px}.eightapdf-bgm-now strong{color:var(--text-soft)}.eightapdf-bgm-volume{font-size:.82rem}.eightapdf-settings-music input[type=range]{width:100%;margin:11px 0 19px;accent-color:var(--button)}.eightapdf-bgm-actions{display:flex;flex-wrap:wrap;gap:9px}.eightapdf-bgm-actions button{padding:11px 15px;border:1px solid var(--line-bold);background:var(--surface-high);border-radius:11px;color:var(--text);cursor:pointer;font:inherit;font-size:.82rem}.eightapdf-bgm-actions button:first-child{background:var(--button);color:var(--button-text)}.eightapdf-bgm-actions button:disabled{opacity:.48;cursor:not-allowed}#eightapdfBgmStatus{font-size:.78rem;color:var(--muted);margin:17px 0 9px;line-height:1.6}.eightapdf-bgm-help{display:block;line-height:1.6}';
 document.head.append(style);
 $('eightapdfBgmToggle').addEventListener('change',e=>setEnabled(e.target.checked));
 $('eightapdfBgmVolume').addEventListener('input',e=>setVolume(e.target.value));
 $('eightapdfBgmTrack').addEventListener('change',e=>pickTrack(e.target.value));
 $('eightapdfBgmTest').addEventListener('click',togglePlayback);
 $('eightapdfBgmShuffle').addEventListener('click',randomNext);
 sync();
}
function init(){
 mount();
 audio=document.createElement('audio');
 audio.id='eightapdfBgmEngine';audio.preload='metadata';audio.loop=true;audio.style.display='none';
 audio.volume=pref.volume/100;audio.setAttribute('playsinline','');
 audio.addEventListener('playing',()=>{
  playing=true;pending=false;blocked=false;sourceFailed=false;
  status(usingLegacy?'New tracks still need uploading — old background music is temporarily playing.':'Playing '+current()+' ✓');sync();
 });
 audio.addEventListener('pause',()=>{playing=false;pending=false;sync()});
 audio.addEventListener('waiting',()=>{if(pref.enabled&&!blocked)status('Buffering '+current()+'…')});
 audio.addEventListener('error',async()=>{
  playing=false;pending=false;
  if(!usingLegacy&&!zipAttempted){
   zipAttempted=true;
   const requestedId=selected.id;
   try{
    status('Loading original '+current()+' from the uploaded music archive…');
    const url=await urlFromZip(selected.url);
    if(requestedId!==selected.id){URL.revokeObjectURL(url);return;}
    activeBlobUrl=url;
    audio.src=url;audio.load();
    if(pref.enabled&&!manuallyPaused)begin();
    return;
   }catch(error){
    if(requestedId!==selected.id)return;
    console.warn('8aPDF: music ZIP fallback unavailable:',error);
   }
  }
  if(!usingLegacy){
   // Preserve the previous working soundtrack until the user uploads the new 4 files.
   usingLegacy=true;retryId++;audio.src=OLD_AUDIO;audio.load();
   status('Four original MP3 files have not been uploaded to GitHub yet. Trying the temporary old track…');
   sync();if(pref.enabled&&!manuallyPaused)begin();
  }else{
   sourceFailed=true;
   status('Music files unavailable. Upload the four MP3s to /assets/bgm/ in GitHub.');
   sync();
  }
 });
 document.body.appendChild(audio);
 loadCurrent();
 for(const event of ['pointerdown','keydown','touchstart']){
  document.addEventListener(event,e=>{
   if(!e.isTrusted||!pref.enabled||manuallyPaused||playing||pending||!blocked||sourceFailed)return;
   if(e.target?.closest?.('#eightapdfBgmTest,#eightapdfBgmToggle,#eightapdfBgmTrack,#eightapdfBgmShuffle'))return;
   blocked=false;begin();
  },{capture:true,passive:true});
 }
 window.addEventListener('storage',e=>{
  if(e.key!==SETTINGS_KEY)return;
  try{const updated=JSON.parse(e.newValue||'null');if(!updated)return;
   if(typeof updated.enabled==='boolean'&&updated.enabled!==pref.enabled){
    pref.enabled=updated.enabled;
    if(!pref.enabled){manuallyPaused=true;audio?.pause();playing=false;pending=false;status('Background music is off.');}
    else {manuallyPaused=false;if(audio?.error)loadCurrent();else begin();}
   }
   if(Number.isFinite(updated.volume)){pref.volume=Math.max(0,Math.min(100,Math.round(updated.volume)));if(audio)audio.volume=pref.volume/100;}
   sync();
  }catch{}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.__8apdfBackgroundAudio={
 play:()=>setEnabled(true),stop:()=>setEnabled(false),setVolume,
 select:pickTrack,shuffle:randomNext,retry:togglePlayback,
 getState:()=>({...pref,selected:selected.id,playing,pending,blocked,usingLegacy,sourceFailed,tracks:TRACKS.map(t=>({...t}))})
};
})();