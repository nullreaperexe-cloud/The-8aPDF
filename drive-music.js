/* 8aPDF Drive Music — responsive library + persistent player.
 * Files remain on Google Drive; the secret service account is only used server-side.
 * The same <audio> element remains mounted while the workspace is minimized.
 */
(()=>{'use strict';
const API='/api/music-search';
const STORE='8apdf_drive_music_v1';
const $=id=>document.getElementById(id);
const seconds=v=>{const s=Math.max(0,Math.floor(Number(v)||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const key=id=>typeof id==='string'&&/^[\w-]{10,180}$/.test(id);
function loadPrefs(){try{return JSON.parse(localStorage.getItem(STORE)||'null')||{}}catch{return {}}}
const saved=loadPrefs();
const state={
 open:false,loading:false,tracks:[],queue:[],filter:'all',query:'',current:null,
 shuffle:Boolean(saved.shuffle),repeat:['off','one','all'].includes(saved.repeat)?saved.repeat:'all',
 favorites:new Set(Array.isArray(saved.favorites)?saved.favorites.filter(key):[]),
 savedOrder:Array.isArray(saved.order)?saved.order.filter(key):[],
 volume:Number.isFinite(saved.volume)?Math.max(0,Math.min(100,saved.volume)):45,
 playing:false,requested:false,error:'',hasLoaded:false
};
let overlay,panel,dock,audio,focusBefore,scrollBefore='',mounted=false,requestToken=0;
const persist=()=>{
 try{localStorage.setItem(STORE,JSON.stringify({
  favorites:[...state.favorites].slice(0,400),order:state.queue.map(t=>t.id),
  repeat:state.repeat,shuffle:state.shuffle,volume:state.volume
 }))}catch{}
};
function element(tag,cls,text){
 const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e
}
function button(text,cls,action,label){
 const el=element('button',cls,text);el.type='button';if(label)el.setAttribute('aria-label',label);
 if(action)el.addEventListener('click',action);return el
}
function status(message){const el=$('dmStatus');if(el)el.textContent=message}
function renderQueueOrder(tracks){
 const positions=new Map(state.savedOrder.map((x,i)=>[x,i]));
 return [...tracks].sort((a,b)=>{
  const x=positions.has(a.id)?positions.get(a.id):10000;
  const y=positions.has(b.id)?positions.get(b.id):10000;
  return x!==y?x-y:a.title.localeCompare(b.title,undefined,{numeric:true,sensitivity:'base'});
 });
}
function mount(){
 if(mounted)return;
 if(!document.body)return;mounted=true;
 overlay=element('div','dm-shade');overlay.id='dmShade';overlay.hidden=true;
 panel=element('section','dm-workspace');panel.id='dmWorkspace';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','8aPDF Music');
 panel.innerHTML=
 '<header class="dm-head"><div><div class="dm-eyebrow">8aPDF / MUSIC</div><h2>YOUR MUSIC SPACE</h2><p>Your private collection · Powered by Google Drive</p></div><div class="dm-head-actions"><button id="dmReload" class="dm-icon" type="button" title="Refresh songs from Google Drive" aria-label="Refresh songs">↻</button><button id="dmMinimize" class="dm-icon" type="button" aria-label="Minimize music">↙</button></div></header>'+
 '<div class="dm-body"><aside class="dm-side"><h3>YOUR LIBRARY</h3><button data-dm-view="all" class="dm-side-item" type="button">♫ All songs <span id="dmTotalCount">0</span></button><button data-dm-view="favorites" class="dm-side-item" type="button">♥ Liked songs</button><div class="dm-side-caption">QUICK LINKS</div><p>Music plays from your connected Google Drive. Nothing is saved to Supabase or GitHub.</p><p class="dm-side-note">MP3s added to the shared Drive folder appear after refresh.</p></aside>'+
 '<main class="dm-main"><div class="dm-greeting"><div><small>YOUR COLLECTION</small><h3>Find your next song.</h3><p>Enjoy uninterrupted music while studying.</p></div><span id="dmCount" class="dm-count">0 tracks</span></div>'+
 '<label class="dm-search"><span aria-hidden="true">⌕</span><input id="dmSearch" type="search" placeholder="Search your songs…" autocomplete="off" maxlength="100" aria-label="Search Drive songs"></label>'+
 '<div class="dm-row-head"><h4 id="dmListHeading">All Songs</h4><button id="dmSort" type="button" title="Sort songs by name">A–Z</button></div>'+
 '<div class="dm-list" id="dmList" aria-live="polite"></div><p id="dmStatus" class="dm-status" role="status">Connecting to Google Drive…</p></main>'+
 '<aside class="dm-queue-panel"><h3>UP NEXT <span id="dmQueueCount">0</span></h3><div class="dm-queue" id="dmQueue"></div><small>Use ↑ ↓ to change song order. Playlist order stays saved in this browser.</small></aside></div>';
 dock=element('section','dm-dock');dock.id='dmDock';dock.hidden=true;dock.setAttribute('aria-label','Music controls');
 dock.innerHTML=
 '<button id="dmExpand" type="button" class="dm-cover-btn" title="Expand Music" aria-label="Expand music"><span>♫</span></button>'+
 '<div class="dm-now"><strong id="dmNowTitle">No song selected</strong><small id="dmNowSub">Google Drive</small></div>'+
 '<div class="dm-control-center"><div class="dm-actions"><button id="dmShuffle" type="button" title="Shuffle" aria-label="Shuffle">⤨</button><button id="dmPrev" type="button" title="Previous" aria-label="Previous song">⏮</button><button id="dmPlayPause" class="dm-main-play" type="button" aria-label="Play">▶</button><button id="dmNext" type="button" title="Next" aria-label="Next song">⏭</button><button id="dmRepeat" type="button" title="Repeat all" aria-label="Repeat">↻</button></div>'+
 '<div class="dm-progress"><time id="dmTime">0:00</time><input type="range" id="dmSeek" min="0" max="100" value="0" aria-label="Seek"><time id="dmDuration">0:00</time></div></div>'+
 '<div class="dm-volume"><span aria-hidden="true">◖</span><input type="range" id="dmVolume" min="0" max="100" value="45" aria-label="Volume"></div>'+
 '<button id="dmCloseDock" class="dm-close-dock" type="button" aria-label="Close floating controls and pause music">×</button>';
 audio=document.createElement('audio');audio.id='dmAudio';audio.preload='metadata';audio.setAttribute('playsinline','');audio.volume=state.volume/100;
 document.body.append(overlay,panel,dock,audio);
 $('dmVolume').value=String(state.volume);
 overlay.addEventListener('click',minimize);
 $('dmMinimize').addEventListener('click',minimize);
 $('dmExpand').addEventListener('click',open);
 $('dmCloseDock').addEventListener('click',()=>{audio.pause();dock.hidden=true});
 $('dmReload').addEventListener('click',()=>fetchSongs(true));
 $('dmSearch').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();renderList()});
 $('dmSort').addEventListener('click',()=>{state.queue.sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true,sensitivity:'base'}));persist();renderAll()});
 panel.querySelectorAll('[data-dm-view]').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.dmView;renderList()}));
 $('dmPlayPause').addEventListener('click',toggle);
 $('dmPrev').addEventListener('click',previous);
 $('dmNext').addEventListener('click',()=>next(true));
 $('dmShuffle').addEventListener('click',()=>{state.shuffle=!state.shuffle;persist();renderPlayer()});
 $('dmRepeat').addEventListener('click',()=>{
  const modes=['off','all','one'];state.repeat=modes[(modes.indexOf(state.repeat)+1)%3];persist();renderPlayer();
 });
 $('dmVolume').addEventListener('input',e=>{state.volume=Number(e.target.value);audio.volume=state.volume/100;persist()});
 $('dmSeek').addEventListener('change',e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/100});
 audio.addEventListener('play',()=>{state.playing=true;dock.hidden=false;window.__8apdfBackgroundAudio?.pause?.();renderPlayer();setMediaState('playing')});
 audio.addEventListener('pause',()=>{state.playing=false;renderPlayer();setMediaState('paused')});
 audio.addEventListener('ended',()=>next(false));
 audio.addEventListener('timeupdate',renderProgress);
 audio.addEventListener('durationchange',renderProgress);
 audio.addEventListener('loadedmetadata',()=>{status('Now playing: '+(state.current?.title||'song'));renderProgress()});
 audio.addEventListener('waiting',()=>status('Buffering audio from Google Drive…'));
 audio.addEventListener('error',()=>{
  const code=audio.error?.code;state.playing=false;
  status('Audio streaming failed'+(code?' (error '+code+')':'')+'. Check Drive permissions and file format, then try again.');
  renderPlayer();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)minimize()});
 setupMediaSession();renderAll();
}
function setMediaState(type){
 if('mediaSession' in navigator)try{navigator.mediaSession.playbackState=type}catch{}
}
function setupMediaSession(){
 if(!('mediaSession' in navigator))return;
 const session=navigator.mediaSession;
 const actions={
  play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),
  previoustrack:previous,nexttrack:()=>next(true),
  seekto:details=>{if(Number.isFinite(details.seekTime))audio.currentTime=details.seekTime},
  seekbackward:()=>{audio.currentTime=Math.max(0,audio.currentTime-10)},
  seekforward:()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+10)}
 };
 for(const [action,handler] of Object.entries(actions))try{session.setActionHandler(action,handler)}catch{}
}
function setMediaMetadata(track){
 if(!('mediaSession' in navigator)||!('MediaMetadata' in window))return;
 try{navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:'8aPDF Music · Google Drive',album:'Your Music'})}catch{}
}
async function fetchSongs(refresh=false){
 if(state.loading)return;
 state.loading=true;state.error='';status(refresh?'Refreshing your Google Drive music…':'Loading your Google Drive songs…');renderList();
 const currentRequest=++requestToken;
 try{
  const response=await fetch(API+'?provider=drive&action=tracks'+(refresh?'&refresh=1':''),{headers:{Accept:'application/json'},cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||'Google Drive request failed ('+response.status+')');
  if(currentRequest!==requestToken)return;
  const tracks=(Array.isArray(payload.tracks)?payload.tracks:[]).filter(x=>key(x.id)&&typeof x.title==='string'&&Number(x.size)>0);
  state.tracks=tracks;state.queue=renderQueueOrder(tracks);state.savedOrder=state.queue.map(t=>t.id);
  state.hasLoaded=true;persist();
  if(state.current){
   const fresh=state.queue.find(t=>t.id===state.current.id);
   if(fresh)state.current=fresh;
   else if(!audio.paused){audio.pause();audio.removeAttribute('src');audio.load();state.current=null}
  }
  status(tracks.length?tracks.length+' songs found in your Google Drive folder.':'Folder connected! No MP3s found yet. Upload songs to your shared Google Drive music folder and tap Refresh.');
 }catch(e){
  if(currentRequest===requestToken){
   state.error=e?.message||'Could not connect to Google Drive';
   status(state.error);
  }
 }finally{
  if(currentRequest===requestToken){state.loading=false;renderAll()}
 }
}
function row(track,index){
 const item=element('div','dm-track');item.dataset.active=String(state.current?.id===track.id);
 const i=element('span','dm-track-index',String(index+1).padStart(2,'0'));
 const btn=button('','dm-track-info',()=>play(track));btn.append(element('span','dm-small-cover','♫'));
 const meta=element('span','dm-track-meta');meta.append(element('strong','',track.title),element('small','','MP3 · Google Drive'));
 btn.append(meta);item.append(i,btn);
 const fav=button(state.favorites.has(track.id)?'♥':'♡','dm-like',()=>{
  if(state.favorites.has(track.id))state.favorites.delete(track.id);else state.favorites.add(track.id);
  persist();renderList();
 },'Like '+track.title);fav.setAttribute('aria-pressed',String(state.favorites.has(track.id)));item.append(fav);
 return item;
}
function queueRow(track,index){
 const item=element('div','dm-queue-track');item.dataset.active=String(state.current?.id===track.id);
 const btn=button(track.title,'dm-queue-name',()=>play(track),'Play '+track.title);item.append(btn);
 for(const [delta,sign,label] of [[-1,'↑','Move up'],[1,'↓','Move down']]){
  const ctrl=button(sign,'dm-order',()=>{const i=state.queue.findIndex(t=>t.id===track.id),j=i+delta;if(j<0||j>=state.queue.length)return;[state.queue[i],state.queue[j]]=[state.queue[j],state.queue[i]];persist();renderAll()},label);
  ctrl.disabled=delta===-1?index===0:index===state.queue.length-1;item.append(ctrl);
 }
 return item;
}
function renderList(){
 if(!mounted)return;
 const list=$('dmList');list.replaceChildren();
 panel.querySelectorAll('[data-dm-view]').forEach(btn=>{
  const active=btn.dataset.dmView===state.filter;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))
 });
 const visible=state.queue.filter(t=>(state.filter!=='favorites'||state.favorites.has(t.id))&&
   (!state.query||t.title.toLowerCase().includes(state.query)));
 $('dmListHeading').textContent=state.filter==='favorites'?'Liked Songs':'All Songs';
 $('dmTotalCount').textContent=String(state.queue.length);
 $('dmCount').textContent=visible.length+' songs';
 if(state.loading){list.append(element('p','dm-empty','Connecting to your Google Drive folder…'))}
 else if(state.error){list.append(element('p','dm-empty','Cannot load songs: '+state.error))}
 else if(visible.length){for(const t of visible)list.append(row(t,state.queue.indexOf(t)))}
 else list.append(element('p','dm-empty',
  state.query?'No matches. Try another song title.':state.filter==='favorites'?'No liked songs yet. Tap ♡ beside a song.':
  'No MP3 files found. Upload songs to your Google Drive folder and tap the ↻ Refresh button.'));
}
function renderQueue(){
 const list=$('dmQueue');list.replaceChildren();$('dmQueueCount').textContent=String(state.queue.length);
 state.queue.forEach((t,i)=>list.append(queueRow(t,i)));
}
function renderProgress(){
 if(!mounted)return;
 const pos=Number(audio.currentTime)||0,dur=Number.isFinite(audio.duration)?audio.duration:0;
 $('dmTime').textContent=seconds(pos);$('dmDuration').textContent=seconds(dur);
 $('dmSeek').value=String(dur?Math.max(0,Math.min(100,Math.round(pos/dur*100))):0);
}
function renderPlayer(){
 if(!mounted)return;
 $('dmNowTitle').textContent=state.current?.title||'Choose a song';
 $('dmNowSub').textContent=state.current?'Google Drive · Original audio':'8aPDF Music';
 $('dmPlayPause').textContent=state.playing?'Ⅱ':'▶';
 $('dmPlayPause').setAttribute('aria-label',state.playing?'Pause song':'Play song');
 $('dmShuffle').setAttribute('aria-pressed',String(state.shuffle));
 $('dmRepeat').textContent=state.repeat==='one'?'↻₁':'↻';
 $('dmRepeat').title='Repeat '+state.repeat;
 $('dmRepeat').setAttribute('aria-label','Repeat '+state.repeat);
 $('dmRepeat').setAttribute('aria-pressed',String(state.repeat!=='off'));
 renderProgress();
}
function renderAll(){renderList();renderQueue();renderPlayer()}
function play(track){
 if(!track||!key(track.id))return;
 mount();
 window.__8apdfBackgroundAudio?.pause?.();
 const url=API+'?provider=drive&action=stream&id='+encodeURIComponent(track.id);
 if(state.current?.id!==track.id||audio.getAttribute('src')!==url){
  state.current=track;audio.src=url;audio.load();
 }else state.current=track;
 dock.hidden=false;setMediaMetadata(track);renderAll();
 audio.play().catch(e=>{status(e?.name==='NotAllowedError'?'Tap ▶ to start playback (browser autoplay restriction).':'Unable to start song. Verify Drive folder sharing and MP3 access.');renderPlayer()});
}
function next(manual){
 const tracks=state.queue;
 if(!tracks.length)return;
 if(!manual&&state.repeat==='one'&&state.current){audio.currentTime=0;audio.play().catch(()=>{});return}
 const i=tracks.findIndex(t=>t.id===state.current?.id);
 if(!manual&&state.repeat==='off'&&i===tracks.length-1){audio.pause();return}
 const idx=state.shuffle&&tracks.length>1?randomOther(i,tracks.length):(i+1)%tracks.length;
 play(tracks[idx]);
}
function randomOther(i,len){let j=Math.floor(Math.random()*(len-1));if(j>=i&&i>=0)j++;return j}
function previous(){
 const t=state.queue;
 if(!t.length)return;
 if(audio.currentTime>3){audio.currentTime=0;return}
 const i=t.findIndex(x=>x.id===state.current?.id);
 play(t[(i<=0?t.length:i)-1]);
}
function toggle(){
 if(!state.current){if(state.queue.length)play(state.queue[0]);else open();return}
 if(!audio.paused)audio.pause();else audio.play().catch(()=>status('Tap ▶ again to play. Browser may require interaction.'));
}
function open(){
 if(!document.body){document.addEventListener('DOMContentLoaded',open,{once:true});return}
 mount();if(state.open)return;
 // Prevent the legacy 3-track background player from mixing with Drive music.
 window.__8apdfBackgroundAudio?.pause?.();
 focusBefore=document.activeElement;scrollBefore=document.body.style.overflow;
 state.open=true;panel.hidden=false;overlay.hidden=false;document.body.style.overflow='hidden';
 if(state.current)dock.hidden=false;
 if(!state.hasLoaded)fetchSongs();
 else renderAll();
 $('dmSearch').focus({preventScroll:true});
}
function minimize(){
 if(!state.open)return;
 state.open=false;panel.hidden=true;overlay.hidden=true;document.body.style.overflow=scrollBefore;
 if(state.current)dock.hidden=false;
 if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
 // Do not call pause/remove/src here. Audio must continue while minimized.
}
document.addEventListener('click',e=>{
 const target=e.target.closest('#studioDriveMusic,#studioMobileDriveMusic');
 if(target){e.preventDefault();open()}
});
window.__8apdfDriveMusic={open,minimize,reload:()=>fetchSongs(true),getState:()=>({
 opened:state.open,playing:state.playing,tracks:state.queue.length,current:state.current?.id,error:state.error
})};
})();