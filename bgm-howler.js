/* 8aPDF — original MP3 background playlist: fixed order, persistent selection, single-song loop. */
(()=>{
'use strict';
const TRACKS=[
 {id:'tum-hi-ho',title:'Tum Hi Ho',detail:'Piano Cover · Aakash Desai',url:'/assets/bgm/tum-hi-ho.mp3'},
 {id:'khairiyat',title:'Khairiyat',detail:'Piano Cover · Aakash Desai',url:'/assets/bgm/khairiyat.mp3'},
 {id:'saiyaara',title:'Saiyaara',detail:'Peaceful instrumental',url:'/assets/bgm/saiyaara.mp3'}
];
const KEY='8apdf_background_music_v1',byId=id=>document.getElementById(id);
const ordered=()=>TRACKS.map(x=>x.id);
const normalize=value=>{
 const selected=new Set(Array.isArray(value)?value:[]);
 const valid=ordered().filter(id=>selected.has(id));
 return valid.length?valid:ordered();
};
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
const saved=read();
const defaultVolume=/(Android|iPhone|iPad|iPod|Mobile)/i.test(navigator.userAgent)?40:100;
const prefs={enabled:typeof saved?.enabled==='boolean'?saved.enabled:true,volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(100,Math.round(saved.volume))):defaultVolume,selectedTracks:normalize(saved?.selectedTracks)};
const write=()=>{try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}};
// A quiet background layer even when the device volume is at its maximum.
// Keep the UI slider at 0–100%; never send more than 5% output to the audio element.
const MAX_BACKGROUND_OUTPUT=0.05;
const audioLevel=value=>MAX_BACKGROUND_OUTPUT*Math.max(0,Math.min(100,Number(value)||0))/100;
const playlist=()=>TRACKS.filter(t=>prefs.selectedTracks.includes(t.id));
let active=prefs.selectedTracks[0],audio=null,playing=false,pending=false,blocked=false,pausedByUser=false,error=false,generation=0;
const track=()=>TRACKS.find(t=>t.id===active)||playlist()[0];
const status=s=>{const e=byId('eightapdfBgmStatus');if(e)e.textContent=s};
function sync(){
 const toggle=byId('eightapdfBgmToggle'),vol=byId('eightapdfBgmVolume'),label=byId('eightapdfBgmVolumeLabel');
 const button=byId('eightapdfBgmTest'),current=byId('eightapdfBgmNow'),mode=byId('eightapdfBgmMode'),all=byId('eightapdfBgmPlayAll');
 if(toggle)toggle.checked=prefs.enabled;
 if(vol){vol.value=String(prefs.volume);vol.disabled=!prefs.enabled}
 if(label)label.textContent=prefs.volume+'%';
 if(button){button.disabled=!prefs.enabled;button.textContent=playing?'❚❚ Pause music':'▶ Play music'}
 if(current)current.textContent=track().title;
 if(mode)mode.textContent=prefs.selectedTracks.length===1?'Repeat one — '+track().title:playlist().map(t=>t.title).join(' → ')+' → repeat';
 if(all)all.disabled=!prefs.enabled||prefs.selectedTracks.length===3;
 TRACKS.forEach(t=>{
  const cb=byId('eightapdfBgmChoice-'+t.id),solo=byId('eightapdfBgmSolo-'+t.id);
  if(cb){cb.checked=prefs.selectedTracks.includes(t.id);cb.disabled=!prefs.enabled}
  if(solo)solo.disabled=!prefs.enabled||(prefs.selectedTracks.length===1&&active===t.id);
 });
}
function play(){
 if(!audio||!prefs.enabled||pausedByUser||playing||pending||error)return;
 const id=generation;
 pending=true;blocked=false;status('Starting '+track().title+'…');
 try{
  const result=audio.play();
  if(result&&typeof result.catch==='function')result.catch(e=>{
   if(id!==generation||!prefs.enabled||pausedByUser)return;
   pending=false;playing=false;
   if(e?.name==='NotAllowedError'){blocked=true;status('Autoplay blocked. Tap the page once or press Play music.')}
   else{error=true;status('Cannot play '+track().title+'. Please retry.')}
   sync();
  });
 }catch(e){pending=false;error=true;status('Audio could not start. Please retry.');sync()}
}
function load(id){
 if(!TRACKS.some(t=>t.id===id))return;
 active=id;generation++;playing=false;pending=false;blocked=false;error=false;
 if(!audio){sync();return}
 audio.pause();
 audio.loop=prefs.selectedTracks.length===1;
 audio.src=track().url;audio.load();sync();
 if(prefs.enabled&&!pausedByUser)play();
}
function next(){
 if(!prefs.enabled||pausedByUser||prefs.selectedTracks.length<2)return;
 const list=playlist(),idx=list.findIndex(t=>t.id===active);
 load(list[(idx+1)%list.length].id);
}
function choose(ids,fromStart=false){
 const selected=normalize(ids),included=selected.includes(active);
 prefs.selectedTracks=selected;write();
 if(fromStart||!included){pausedByUser=false;load(selected[0]);return}
 if(audio)audio.loop=selected.length===1;
 sync();status(selected.length===1?'Repeating '+track().title:playlist().map(t=>t.title).join(' → ')+' → repeat');
}
function check(id,on){
 if(!ordered().includes(id))return;
 const set=new Set(prefs.selectedTracks);
 if(on)set.add(id);
 else if(set.size>1)set.delete(id);
 else{status('Choose at least one song.');sync();return}
 choose([...set]);
}
function only(id){if(ordered().includes(id))choose([id],true)}
function all(){choose(ordered(),true)}
function pause(){pausedByUser=true;generation++;audio?.pause();playing=false;pending=false;blocked=false;status('Paused. Your music selection is saved.');sync()}
function enable(v){
 prefs.enabled=!!v;write();
 if(!prefs.enabled){pause();status('Background music is off.');return}
 pausedByUser=false;error=false;
 if(audio?.error)load(active);else play();
 sync();
}
function volume(v){prefs.volume=Math.max(0,Math.min(100,Math.round(Number(v)||0)));if(audio)audio.volume=audioLevel(prefs.volume);write();sync()}
function toggle(){if(!prefs.enabled)return;if(playing){pause();return}pausedByUser=false;pending=false;blocked=false;error=false;if(audio?.error)load(active);else play()}
function mount(){
 const host=byId('eightapdfSettingsMusic');if(!host)return;
 host.innerHTML='<div class="eightapdf-bgm-heading"><span class="setting-label">♫ Background Music</span><small>3 ORIGINAL TRACKS</small></div>'+
 '<p class="setting-explainer">Select one song to repeat it forever, or select several for a continuous playlist in the order below. Saved even after refresh.</p>'+
 '<label class="setting-row"><span><strong>Enable background music</strong></span><input id="eightapdfBgmToggle" class="toggle" type="checkbox"></label>'+
 '<div class="eightapdf-bgm-list">'+TRACKS.map((t,i)=>'<div class="eightapdf-bgm-item"><label for="eightapdfBgmChoice-'+t.id+'"><input id="eightapdfBgmChoice-'+t.id+'" type="checkbox"><span class="eightapdf-bgm-number">'+(i+1)+'</span><span class="eightapdf-bgm-copy"><strong>'+t.title+'</strong><small>'+t.detail+'</small></span></label><button type="button" id="eightapdfBgmSolo-'+t.id+'">Only this</button></div>').join('')+'</div>'+
 '<p id="eightapdfBgmMode" class="eightapdf-bgm-mode"></p>'+
 '<p class="eightapdf-bgm-current">Now playing: <strong id="eightapdfBgmNow"></strong></p>'+
 '<div class="eightapdf-bgm-volume"><label for="eightapdfBgmVolume">Volume</label><strong id="eightapdfBgmVolumeLabel"></strong></div>'+
 '<input type="range" min="0" max="100" step="1" id="eightapdfBgmVolume" aria-label="Background music volume">'+
 '<div class="eightapdf-bgm-actions"><button id="eightapdfBgmTest" type="button">▶ Play music</button><button id="eightapdfBgmPlayAll" type="button">↺ Play all 3 in order</button></div>'+
 '<p id="eightapdfBgmStatus" role="status" aria-live="polite"></p>'+
 '<small class="eightapdf-bgm-note">Tum Hi Ho → Khairiyat → Saiyaara → repeat. Browsers may require a tap to allow audio.</small>';
 const style=document.createElement('style');style.textContent='.eightapdf-bgm-heading,.eightapdf-bgm-volume{display:flex;justify-content:space-between;align-items:center;gap:10px}.eightapdf-bgm-heading small,.eightapdf-bgm-note{color:var(--muted);font-size:.7rem}.eightapdf-bgm-list{display:grid;gap:9px;margin:16px 0}.eightapdf-bgm-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--surface-high);padding:10px;border-radius:12px}.eightapdf-bgm-item label{display:flex;align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer}.eightapdf-bgm-item input{width:17px;height:17px;accent-color:var(--button);flex:none}.eightapdf-bgm-number{border:1px solid var(--line-bold);border-radius:7px;padding:5px 8px;font-size:.7rem}.eightapdf-bgm-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.eightapdf-bgm-copy strong{font-size:.8rem}.eightapdf-bgm-copy small,.eightapdf-bgm-current{font-size:.7rem;color:var(--muted)}.eightapdf-bgm-item button{flex:none}.eightapdf-bgm-item button,.eightapdf-bgm-actions button{border:1px solid var(--line-bold);border-radius:10px;background:var(--surface-soft);color:var(--text);padding:9px 11px;cursor:pointer;font:inherit;font-size:.75rem}.eightapdf-bgm-item button:disabled,.eightapdf-bgm-actions button:disabled{opacity:.45;cursor:not-allowed}.eightapdf-bgm-mode{font-size:.77rem;color:var(--text-soft);font-weight:650;line-height:1.5}.eightapdf-bgm-current{margin-bottom:18px}.eightapdf-bgm-current strong{color:var(--text)}.eightapdf-bgm-volume{font-size:.8rem}.eightapdf-settings-music input[type=range]{width:100%;accent-color:var(--button);margin:12px 0 18px}.eightapdf-bgm-actions{display:flex;flex-wrap:wrap;gap:8px}.eightapdf-bgm-actions button:first-child{background:var(--button);color:var(--button-text)}#eightapdfBgmStatus{font-size:.76rem;color:var(--muted);margin:16px 0 8px}.eightapdf-bgm-note{display:block;line-height:1.5}@media(max-width:450px){.eightapdf-bgm-item{padding:8px}.eightapdf-bgm-item label{gap:6px}.eightapdf-bgm-item button{padding:8px}}';
 document.head.appendChild(style);
 byId('eightapdfBgmToggle').addEventListener('change',e=>enable(e.target.checked));
 byId('eightapdfBgmVolume').addEventListener('input',e=>volume(e.target.value));
 byId('eightapdfBgmTest').addEventListener('click',toggle);
 byId('eightapdfBgmPlayAll').addEventListener('click',all);
 TRACKS.forEach(t=>{
  byId('eightapdfBgmChoice-'+t.id).addEventListener('change',e=>check(t.id,e.target.checked));
  byId('eightapdfBgmSolo-'+t.id).addEventListener('click',()=>only(t.id));
 });
 sync();
}
function init(){
 mount();audio=document.createElement('audio');audio.id='eightapdfBgmEngine';audio.style.display='none';audio.preload='metadata';audio.volume=audioLevel(prefs.volume);audio.setAttribute('playsinline','');
 audio.addEventListener('playing',()=>{playing=true;pending=false;blocked=false;error=false;status('Playing '+track().title+' ✓');sync()});
 audio.addEventListener('pause',()=>{playing=false;pending=false;sync()});
 audio.addEventListener('ended',()=>{playing=false;pending=false;next()});
 audio.addEventListener('error',()=>{playing=false;pending=false;error=true;status('Failed to load '+track().title+'. Check the MP3 file.');sync()});
 document.body.appendChild(audio);load(active);
 for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,e=>{
  if(!e.isTrusted||!prefs.enabled||pausedByUser||playing||pending||!blocked||error)return;
  if(e.target?.closest?.('#eightapdfBgmTest,#eightapdfBgmToggle,#eightapdfBgmPlayAll,.eightapdf-bgm-item'))return;
  blocked=false;play();
 },{capture:true,passive:true});
 window.addEventListener('storage',e=>{
  if(e.key!==KEY)return;
  const n=read();if(!n)return;
  const songs=normalize(n.selectedTracks),changed=songs.join(',')!==prefs.selectedTracks.join(',');
  prefs.selectedTracks=songs;
  if(Number.isFinite(n.volume)){prefs.volume=Math.max(0,Math.min(100,Math.round(n.volume)));if(audio)audio.volume=audioLevel(prefs.volume)}
  if(typeof n.enabled==='boolean')prefs.enabled=n.enabled;
  if(!prefs.enabled){pausedByUser=true;audio?.pause();playing=false;pending=false;status('Background music is off.')}
  else if(changed){pausedByUser=false;load(songs[0])}
  else{if(audio)audio.loop=songs.length===1;if(!pausedByUser)play()}
  sync();
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.__8apdfBackgroundAudio={play:()=>enable(true),stop:()=>enable(false),pause,setVolume:volume,select:only,setSongs:choose,playAll:all,next,retry:toggle,getState:()=>({...prefs,selectedTracks:[...prefs.selectedTracks],current:active,playing,pending,blocked,loop:audio?.loop,tracks:TRACKS.map(x=>({...x}))})};
})();