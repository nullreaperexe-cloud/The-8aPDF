/* 8aPDF SoundCloud Music. Official embedded widget + persistent floating dock.
   No scraping, stream extraction, Spotify credentials, or audio file uploads. */
(()=>{'use strict';
const STORE='8apdf_soundcloud_library_v1';
const ID=id=>document.getElementById(id);
const BY='https://soundcloud.com/';
const format=ms=>{let s=Math.floor(Math.max(0,Number(ms)||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const escapeTitle=s=>String(s||'').trim().slice(0,140);
const saved=(()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')||{}}catch{return {}}})();
function cleanUrl(input){
 try{
  const u=new URL(String(input||'').trim());
  if(u.protocol!=='https:'||!/(^|\.)soundcloud\.com$/i.test(u.hostname))return null;
  const path=u.pathname.replace(/\/+$/,'');
  if(path.split('/').filter(Boolean).length<2)return null;
  if(path.length>290)return null;
  return 'https://soundcloud.com'+path;
 }catch{return null}
}
const validTrack=x=>x&&typeof x==='object'&&cleanUrl(x.url)&&typeof x.title==='string';
const uniqueTracks=arr=>{
 const known=new Set();return (Array.isArray(arr)?arr:[]).filter(x=>{
  if(!validTrack(x)||known.has(x.url))return false;known.add(x.url);return true
 }).slice(0,240).map(x=>({url:cleanUrl(x.url),title:escapeTitle(x.title),artist:escapeTitle(x.artist||'SoundCloud'),category:['hindi','punjabi','english'].includes(x.category)?x.category:'custom',art:typeof x.art==='string'&&/^https:\/\//i.test(x.art)?x.art:''}));
};
const CATALOG_VERSION='featured-20261018-54';
const catalog=uniqueTracks(window.__8apdfSoundCloudCatalog||[]);
const existing=uniqueTracks(saved.queue);
const initialQueue=saved.curatedVersion===CATALOG_VERSION?existing:uniqueTracks([...catalog,...existing]);
const state={
 opened:false,queue:initialQueue,filter:'all',current:cleanUrl(saved.current)||'',
 playing:false,ready:false,loading:false,volume:Math.max(0,Math.min(100,Number.isFinite(saved.volume)?saved.volume:55)),
 query:'',position:0,duration:0
};
let overlay, panel, dock, frame,widget,widgetPromise,prevFocus,prevOverflow='',mounted=false;
const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify({queue:state.queue,current:state.current,volume:state.volume,curatedVersion:CATALOG_VERSION}))}catch{}};
function status(value){const e=ID('scMusicStatus');if(e)e.textContent=value}
function button(text,cls,click,label){
 const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls||'';
 if(label)b.setAttribute('aria-label',label);if(click)b.addEventListener('click',click);return b;
}
const currentTrack=()=>state.queue.find(x=>x.url===state.current)||null;
const metadataTitle=url=>{
 const parts=new URL(url).pathname.split('/').filter(Boolean);
 return parts.at(-1).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).slice(0,140);
};
function build(){
 if(mounted)return;mounted=true;
 overlay=document.createElement('div');overlay.id='scMusicOverlay';overlay.className='sc-overlay';overlay.hidden=true;
 panel=document.createElement('section');panel.className='sc-panel';panel.id='scMusicPanel';panel.hidden=true;panel.setAttribute('role','dialog');
 panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','8aPDF SoundCloud music workspace');
 panel.innerHTML=
 '<header class="sc-header"><div><span class="sc-overline">8aPDF · MUSIC</span><h2>Your Music Space</h2><p>Discover on SoundCloud · save tracks · keep listening while you study</p></div><button id="scMusicMinimize" type="button" class="sc-icon" aria-label="Minimize music">↙</button></header>'+
 '<div class="sc-layout"><aside class="sc-aside"><strong>YOUR LIBRARY</strong><button class="sc-side-btn active" id="scShowSaved" type="button">♫ Saved music</button><button class="sc-side-btn" id="scExploreSoundcloud" type="button">↗ Explore SoundCloud</button><div class="sc-section-caption">DISCOVER</div><button class="sc-side-btn" type="button" data-sc-search="Hindi original music">Hindi hits ↗</button><button class="sc-side-btn" type="button" data-sc-search="Punjabi music">Punjabi hits ↗</button><button class="sc-side-btn" type="button" data-sc-search="English pop">English hits ↗</button><small>Browse on SoundCloud, then copy a public track or playlist link here.</small></aside>'+
 '<main class="sc-content"><div class="sc-section-heading"><div><small>YOUR COLLECTION</small><h3>Listen while you study</h3></div><span id="scTrackCount">0 saved</span></div>'+
 '<form id="scAddForm" class="sc-add-form"><label for="scUrlInput">Add a public SoundCloud song or playlist URL</label><div class="sc-add-field"><input id="scUrlInput" type="url" inputmode="url" placeholder="https://soundcloud.com/artist/song" autocomplete="off" required><button type="submit">＋ Add</button></div></form>'+
 '<form class="sc-find-form" id="scFindForm"><label for="scFindQuery">Find songs</label><div class="sc-add-field"><input id="scFindQuery" type="search" placeholder="Arijit Singh, AP Dhillon, English hits…" autocomplete="off"><button type="submit">Search SoundCloud ↗</button></div><small>Free widget access needs no login. SoundCloud search opens in a new tab; copy a song link to add it here.</small></form>'+
 '<div class="sc-section-heading sc-section-heading-sub"><div><small>QUEUE / PLAYLIST</small><h3>Saved tracks</h3></div><span class="sc-track-tools"><button id="scRestoreFeatured" type="button" class="sc-clear-btn">Restore popular songs</button><button id="scClearQueue" type="button" class="sc-clear-btn">Clear</button></span></div>'+
 '<div class="sc-category-tabs" id="scCategoryTabs" role="group" aria-label="Music language"><button type="button" data-sc-category="all" aria-pressed="true">All music</button><button type="button" data-sc-category="punjabi">Punjabi</button><button type="button" data-sc-category="hindi">Hindi / Indie</button><button type="button" data-sc-category="english">English</button><button type="button" data-sc-category="custom">My adds</button></div><div id="scTrackList" class="sc-track-list" aria-live="polite"></div>'+
 '<p id="scMusicStatus" class="sc-status" role="status" aria-live="polite">Ready to add music.</p>'+
 '<p class="sc-note">Tracks are hosted by their creators on SoundCloud. Availability and playback restrictions depend on the creator and region.</p>'+
 '</main></div>';
 dock=document.createElement('section');dock.className='sc-dock';dock.id='scMusicDock';dock.hidden=true;
 dock.setAttribute('aria-label','SoundCloud music floating player');
 dock.innerHTML=
 '<div class="sc-dock-top"><button type="button" id="scExpand" class="sc-icon sc-expand" aria-label="Expand music library">♫</button><div class="sc-now"><strong id="scNowTitle">No song selected</strong><small id="scNowArtist">SoundCloud</small></div>'+
 '<div class="sc-actions"><button type="button" id="scPrevious" aria-label="Previous song">⏮</button><button type="button" id="scToggle" class="sc-main-play" aria-label="Play">▶</button><button type="button" id="scNext" aria-label="Next song">⏭</button></div>'+
 '<button type="button" id="scStop" class="sc-icon sc-stop" aria-label="Stop music and hide floating player">✕</button></div>'+
 '<div class="sc-widget-wrap"><iframe id="scOfficialWidget" title="Official SoundCloud music player" allow="autoplay" loading="eager" scrolling="no" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'+
 '<div class="sc-dock-footer"><time id="scElapsed">0:00</time><input id="scSeek" aria-label="Seek within song" type="range" min="0" max="100" value="0" step="1"><time id="scDuration">0:00</time><span class="sc-volume-icon">◖</span><input id="scVolume" aria-label="Volume" type="range" min="0" max="100" value="55" step="1"></div>';
 document.body.append(overlay,panel,dock);
 frame=ID('scOfficialWidget');frame.src='about:blank';
 ID('scVolume').value=String(state.volume);
 overlay.addEventListener('click',minimize);
 ID('scMusicMinimize').addEventListener('click',minimize);
 ID('scExpand').addEventListener('click',open);
 ID('scStop').addEventListener('click',stopAndHide);
 ID('scShowSaved').addEventListener('click',()=>{state.filter='all';ID('scFindQuery').value='';renderList()});
 ID('scCategoryTabs').addEventListener('click',event=>{const btn=event.target.closest('[data-sc-category]');if(!btn)return;state.filter=btn.dataset.scCategory;renderList()});
 ID('scRestoreFeatured').addEventListener('click',()=>{state.queue=uniqueTracks([...catalog,...state.queue]);persist();renderList();renderDock();status('Popular songs restored to your collection.')});
 ID('scExploreSoundcloud').addEventListener('click',()=>openBrowse(''));
 panel.querySelectorAll('[data-sc-search]').forEach(b=>b.addEventListener('click',()=>openBrowse(b.dataset.scSearch)));
 ID('scFindForm').addEventListener('submit',e=>{e.preventDefault();openBrowse(ID('scFindQuery').value)});
 ID('scAddForm').addEventListener('submit',async e=>{e.preventDefault();await add(ID('scUrlInput').value)});
 ID('scFindQuery').addEventListener('input',()=>renderList());
 ID('scClearQueue').addEventListener('click',()=>{state.queue=[];state.current='';persist();widget?.pause();state.playing=false;renderList();renderDock();status('Saved collection cleared.')});
 ID('scPrevious').addEventListener('click',previous);
 ID('scNext').addEventListener('click',next);
 ID('scToggle').addEventListener('click',toggle);
 ID('scVolume').addEventListener('input',e=>{state.volume=Number(e.target.value);persist();widget?.setVolume(state.volume)});
 ID('scSeek').addEventListener('change',e=>{if(state.duration>0)widget?.seekTo(state.duration*Number(e.target.value)/100)});
 document.addEventListener('keydown',e=>{if(state.opened&&e.key==='Escape')minimize()});
 persist();renderList();renderDock();
}
function openBrowse(query){
 const q=String(query||'').trim().slice(0,110);
 const url=q?'https://soundcloud.com/search?q='+encodeURIComponent(q):'https://soundcloud.com/charts/top';
 const anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 status('Find a track on SoundCloud, copy its link, then paste it into the Add field.');
}
async function oembed(url){
 try{
  const endpoint='https://soundcloud.com/oembed?format=json&url='+encodeURIComponent(url);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7500);
  try{
   const response=await fetch(endpoint,{signal:controller.signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('not found');
   const data=await response.json();
   return {title:escapeTitle(data.title)||metadataTitle(url),artist:'SoundCloud',art:typeof data.thumbnail_url==='string'&&data.thumbnail_url.startsWith('https:')?data.thumbnail_url:''};
  }finally{clearTimeout(timer)}
 }catch{return {title:metadataTitle(url),artist:'SoundCloud',art:''}}
}
async function add(value){
 const url=cleanUrl(value);
 if(!url){status('Enter a public SoundCloud track or playlist link, such as soundcloud.com/artist/song.');return}
 const old=state.queue.find(x=>x.url===url);
 if(old){ID('scUrlInput').value='';return play(url)}
 status('Adding track…');
 const info=await oembed(url);
 const track={url,...info,category:'custom'};
 state.queue.unshift(track);state.queue=state.queue.slice(0,240);
 ID('scUrlInput').value='';persist();renderList();
 play(url);
}
function newRow(track,index){
 const item=document.createElement('div');item.className='sc-track';item.dataset.active=String(track.url===state.current);
 const idx=document.createElement('span');idx.className='sc-track-number';idx.textContent=String(index+1).padStart(2,'0');
 const info=document.createElement('button');info.type='button';info.className='sc-track-name';info.addEventListener('click',()=>play(track.url));
 const strong=document.createElement('strong');strong.textContent=track.title;
 const small=document.createElement('small');small.textContent=track.artist+(track.category&&track.category!=='custom'?' · '+track.category.charAt(0).toUpperCase()+track.category.slice(1):'');
 info.append(strong,small);item.append(idx,info);
 const link=document.createElement('a');link.href=track.url;link.target='_blank';link.rel='noopener noreferrer';link.className='sc-track-external';link.textContent='↗';link.setAttribute('aria-label','View '+track.title+' on SoundCloud');item.append(link);
 for(const [delta,symbol,label] of [[-1,'↑','Move up'],[1,'↓','Move down']]){
  const b=button(symbol,'sc-track-move',()=>{
   const at=state.queue.findIndex(x=>x.url===track.url);const to=at+delta;
   if(to<0||to>=state.queue.length)return;
   [state.queue[at],state.queue[to]]=[state.queue[to],state.queue[at]];persist();renderList();
  },label+' '+track.title);
  b.disabled=(delta<0&&index===0)||(delta>0&&index===state.queue.length-1);
  item.append(b);
 }
 const del=button('×','sc-track-remove',()=>{
  state.queue=state.queue.filter(x=>x.url!==track.url);
  if(state.current===track.url){widget?.pause();state.playing=false;state.current='';}
  persist();renderList();renderDock();
 },'Remove '+track.title);item.append(del);
 return item;
}
function renderList(){
 if(!mounted)return;
 const parent=ID('scTrackList');parent.replaceChildren();
 const q=ID('scFindQuery')?.value.trim().toLowerCase()||'';
 const tracks=state.queue.filter(x=>(state.filter==='all'||x.category===state.filter)&&(!q||(x.title+' '+x.artist).toLowerCase().includes(q)));
 ID('scCategoryTabs').querySelectorAll('[data-sc-category]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.scCategory===state.filter)));
 ID('scTrackCount').textContent=tracks.length+' shown / '+state.queue.length+' total';
 if(!tracks.length){
  const msg=document.createElement('p');msg.className='sc-empty';
  msg.textContent=q||state.filter!=='all'?'No matching songs in this category. Try All music.':'Your collection is empty. Restore popular songs or add a SoundCloud link.';
  parent.append(msg);
 }else tracks.forEach(t=>parent.append(newRow(t,state.queue.indexOf(t))));
}
function renderDock(){
 if(!mounted)return;
 const t=currentTrack();
 ID('scNowTitle').textContent=t?.title||'No song selected';
 ID('scNowArtist').textContent=t?.artist||'SoundCloud';
 ID('scToggle').textContent=state.playing?'❚❚':'▶';
 ID('scToggle').setAttribute('aria-label',state.playing?'Pause song':'Play song');
 ID('scElapsed').textContent=format(state.position);
 ID('scDuration').textContent=format(state.duration);
 ID('scSeek').value=String(state.duration>0?Math.min(100,Math.round(state.position/state.duration*100)):0);
}
function loadSDK(){
 if(window.SC?.Widget)return Promise.resolve(window.SC.Widget);
 if(widgetPromise)return widgetPromise;
 widgetPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.async=true;
  script.onload=()=>window.SC?.Widget?resolve(window.SC.Widget):reject(Error('SoundCloud widget API unavailable'));
  script.onerror=()=>reject(Error('SoundCloud widget could not load'));
  document.head.append(script);
 });
 return widgetPromise;
}
function widgetUrl(url){
 const params=new URLSearchParams({
  url,color:'#d7b46c',auto_play:'true',visual:'false',sharing:'true',
  show_artwork:'true',show_user:'true',show_comments:'false',
  hide_related:'true',show_reposts:'false'
 });
 return 'https://w.soundcloud.com/player/?'+params;
}
async function ensureWidget(url){
 const Widget=await loadSDK();
 if(!widget){
  widget=Widget(frame);
  widget.bind(Widget.Events.READY,()=>{
    state.ready=true;widget.setVolume(state.volume);
    widget.getDuration(ms=>{state.duration=ms||0;renderDock()});
    widget.getCurrentSound(x=>{
      if(x&&typeof x.title==='string'&&currentTrack()){
       ID('scNowTitle').textContent=x.title.slice(0,130);
       if(x.user?.username)ID('scNowArtist').textContent=x.user.username.slice(0,90);
      }
    });
    renderDock();
  });
  widget.bind(Widget.Events.PLAY,()=>{state.playing=true;renderDock();status('Playing via SoundCloud ✓')});
  widget.bind(Widget.Events.PAUSE,()=>{state.playing=false;renderDock()});
  widget.bind(Widget.Events.PLAY_PROGRESS,e=>{state.position=e.currentPosition||0;renderDock()});
  widget.bind(Widget.Events.FINISH,()=>next());
  widget.bind(Widget.Events.ERROR,()=>status('Track could not be played. Try another public song.'));
  frame.src=widgetUrl(url);
 }else{
  state.ready=false;state.position=0;state.duration=0;
  widget.load(url,{auto_play:true,visual:false,color:'#d7b46c',show_artwork:true,show_user:true,sharing:true,show_comments:false});
 }
}
async function play(url){
 if(!cleanUrl(url))return;
 build();
 const changed=state.current!==url;state.current=url;state.position=0;state.duration=0;persist();
 dock.hidden=false;
 window.__8apdfBackgroundAudio?.pause?.();
 renderList();renderDock();status('Opening '+(currentTrack()?.title||'song')+' on SoundCloud…');
 try{
  if(changed||!widget)await ensureWidget(url);
  else widget.play();
 }catch(e){status(e?.message||'Could not load SoundCloud player. Please retry.')}
}
function toggle(){
 if(!widget){const first=state.current||state.queue[0]?.url;if(first)play(first);else open();return}
 if(state.playing)widget.pause();else widget.play();
}
function next(){
 const current=state.queue.findIndex(x=>x.url===state.current);
 if(current===-1||!state.queue.length)return;
 play(state.queue[(current+1)%state.queue.length].url);
}
function previous(){
 const current=state.queue.findIndex(x=>x.url===state.current);
 if(current===-1||!state.queue.length)return;
 play(state.queue[(current-1+state.queue.length)%state.queue.length].url);
}
function open(){
 if(!document.body){document.addEventListener('DOMContentLoaded',open,{once:true});return}
 build();if(state.opened)return;
 state.opened=true;prevFocus=document.activeElement;prevOverflow=document.body.style.overflow;
 overlay.hidden=false;panel.hidden=false;document.body.style.overflow='hidden';document.body.classList.add('sc-music-expanded');
 if(state.current)dock.hidden=false;
 ID('scUrlInput').focus({preventScroll:true});
}
function minimize(){
 if(!state.opened)return;
 state.opened=false;overlay.hidden=true;panel.hidden=true;document.body.style.overflow=prevOverflow;
 document.body.classList.remove('sc-music-expanded');
 if(state.current)dock.hidden=false;
 if(prevFocus?.isConnected)prevFocus.focus({preventScroll:true});
 // Do not pause or unload the iframe. SoundCloud playback keeps running.
}
function stopAndHide(){
 widget?.pause();state.playing=false;dock.hidden=true;renderDock();
}
document.addEventListener('click',e=>{
 if(e.target.closest('#studioSoundCloudMusic,#studioOpenTuneMusic,#studioAudiusMusicLink,#studioMobileAudiusMusic')){e.preventDefault();open()}
});
window.__8apdfSoundCloudMusic={open,minimize,play,add,getState:()=>({opened:state.opened,playing:state.playing,queue:state.queue.map(t=>t.url),current:state.current})};
})();