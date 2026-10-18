/* 8aPDF Music — OpenTune-inspired discovery with a visible, official YouTube IFrame player.
   Uses OpenTune's ytmusicapi search approach (MIT): https://github.com/harshitethic/OpenTune
   Does not copy the OpenTune UI, extract audio, or hide the YouTube player. */
(()=>{
'use strict';
const SEARCH='/api/music-search';
const KEY='8apdf_opentune_music_v1';
const $=id=>document.getElementById(id);
const LANGS={hindi:'Hindi',punjabi:'Punjabi',english:'English'};
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id);
const short=(x,max=180)=>String(x||'').trim().slice(0,max);
const clock=x=>{const s=Math.max(0,Math.floor(Number(x)||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function restore(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch{return {}}}
const saved=restore();
const normalize=arr=>Array.isArray(arr)?arr.filter(x=>x&&validId(x.id)&&typeof x.title==='string').slice(0,100):[];
const state={
  opened:false,lang:Object.hasOwn(LANGS,saved.lang)?saved.lang:'hindi',query:'',view:'discover',
  results:[],favorites:normalize(saved.favorites),queue:normalize(saved.queue),
  current:null,playing:false,repeat:saved.repeat!==false,loading:false,
  seq:0,playerReady:false,request:0
};
let root,shade,results,queue,yt,playerPromise,controller,searchTimer,oldFocus,oldOverflow;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify({lang:state.lang,favorites:state.favorites,queue:state.queue,repeat:state.repeat,volume:Number(saved.volume)||60}))}catch{}};
function message(text){const e=$('apMusicStatus');if(e)e.textContent=text}
function button(text,cls,click,aria){
 const b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=text;
 if(aria)b.setAttribute('aria-label',aria);if(click)b.addEventListener('click',click);return b;
}
function art(track,size='regular'){
 if(track?.artwork&&/^https:\/\//.test(track.artwork)){
  const img=document.createElement('img');img.className='ap-music-cover';img.loading='lazy';img.alt='';img.referrerPolicy='strict-origin-when-cross-origin';
  img.src=track.artwork;img.addEventListener('error',()=>img.replaceWith(art(null)));return img;
 }
 const e=document.createElement('span');e.className='ap-music-cover ap-music-cover-empty';e.textContent='♫';return e;
}
function mount(){
 if(root)return;
 shade=document.createElement('div');shade.className='ap-music-backdrop';shade.hidden=true;
 root=document.createElement('section');root.className='ap-music';root.id='eightapdfOpenTuneMusic';root.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','8aPDF Music Library');
 root.innerHTML=
 '<header class="ap-music-top"><div class="ap-music-title"><div class="ap-music-eyebrow">8aPDF · MUSIC</div><h2>Your Music Library</h2><p>Hindi, Punjabi &amp; English songs · YouTube Music discovery</p></div><button id="apMusicClose" class="ap-music-icon-btn" type="button" aria-label="Close Music Library">✕</button></header>'+
 '<div id="apMusicYTRegion" class="ap-music-video" hidden><div class="ap-music-video-label"><strong>Official YouTube player</strong><small>Video stays visible while music plays</small></div><div id="apMusicYoutubePlayer" class="ap-music-video-box"></div></div>'+
 '<div class="ap-music-workspace"><main class="ap-music-catalog">'+
 '<div id="apMusicLanguages" class="ap-music-languages" role="group" aria-label="Select music language">'+
 '<button type="button" data-music-lang="hindi">🇮🇳 Hindi</button><button type="button" data-music-lang="punjabi">🎶 Punjabi</button><button type="button" data-music-lang="english">🌍 English</button></div>'+
 '<form id="apMusicSearchForm" class="ap-music-search" role="search"><span aria-hidden="true">⌕</span><input id="apMusicSearchInput" type="search" placeholder="Search original songs, singers, albums..." autocomplete="off" maxlength="110" aria-label="Search music"><button type="submit">Search</button></form>'+
 '<div class="ap-music-heading"><strong id="apMusicResultTitle">Discover music</strong><span><button id="apMusicBrowse" class="ap-music-cta" type="button">Explore</button> <button id="apMusicFaves" class="ap-music-cta" type="button">♥ Saved</button></span></div>'+
 '<div id="apMusicResults" class="ap-music-tracklist" aria-live="polite"></div>'+
 '<p class="ap-music-toggle">Songs from YouTube Music discovery via OpenTune-inspired search. Results may vary; only playable videos work in the embed.</p>'+
 '</main><aside class="ap-music-queue" aria-label="Playback queue"><div class="ap-music-queue-head"><strong>Playlist · <span id="apMusicQueueCount">0</span></strong><button id="apMusicClearQueue" type="button">Clear</button></div><div id="apMusicQueue" class="ap-music-queue-list"></div></aside></div>'+
 '<footer class="ap-music-footer"><div id="apMusicNow" class="ap-music-now"><span class="ap-music-cover ap-music-cover-empty">♫</span><span class="ap-music-track-copy"><strong>Pick a song</strong><small>Choose Hindi, Punjabi or English</small></span></div>'+
 '<div class="ap-music-player"><div class="ap-music-buttons"><button id="apMusicPrev" type="button" aria-label="Previous song">⏮</button><button id="apMusicPlay" class="ap-music-primary" type="button" aria-label="Play song">▶</button><button id="apMusicNext" type="button" aria-label="Next song">⏭</button><button id="apMusicRepeat" type="button" aria-label="Repeat playlist">↻</button></div>'+
 '<div class="ap-music-seek"><time id="apMusicElapsed">0:00</time><input type="range" min="0" max="100" step="1" id="apMusicSeek" aria-label="Seek within song"><time id="apMusicDuration">0:00</time></div></div>'+
 '<label class="ap-music-level">Volume<input type="range" min="0" max="100" id="apMusicVolume" value="60" aria-label="Music volume"></label></footer>'+
 '<p class="ap-music-status" id="apMusicStatus" role="status" aria-live="polite">Search for a song or explore a language.</p>';
 document.body.append(shade,root);
 results=$('apMusicResults');queue=$('apMusicQueue');
 $('apMusicVolume').value=String(Math.min(100,Math.max(0,Number(saved.volume)||60)));
 $('apMusicClose').addEventListener('click',close);
 shade.addEventListener('click',close);
 $('apMusicSearchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);search($('apMusicSearchInput').value)});
 $('apMusicSearchInput').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(e.target.value),450)});
 $('apMusicBrowse').addEventListener('click',()=>{$('apMusicSearchInput').value='';search('')});
 $('apMusicFaves').addEventListener('click',()=>{controller?.abort();state.request++;state.view='saved';state.query='';state.results=state.favorites.slice();state.loading=false;render()});
 $('apMusicLanguages').addEventListener('click',e=>{const btn=e.target.closest('[data-music-lang]');if(!btn)return;state.lang=btn.dataset.musicLang;persist();search($('apMusicSearchInput').value)});
 $('apMusicClearQueue').addEventListener('click',()=>{state.queue=[];persist();renderQueue()});
 $('apMusicPrev').addEventListener('click',previous);
 $('apMusicNext').addEventListener('click',()=>next(true));
 $('apMusicPlay').addEventListener('click',toggle);
 $('apMusicRepeat').addEventListener('click',()=>{state.repeat=!state.repeat;persist();renderNow()});
 $('apMusicSeek').addEventListener('input',e=>{if(state.playerReady&&yt?.getDuration){const d=yt.getDuration();if(d>0)yt.seekTo(d*(Number(e.target.value)/100),true)}});
 $('apMusicVolume').addEventListener('input',e=>{saved.volume=Number(e.target.value);persist();if(state.playerReady)yt.setVolume(saved.volume)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.opened)close()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.opened)yt?.pauseVideo?.()});
 render();
}
function fav(id){return state.favorites.some(t=>t.id===id)}
function trackRow(track,where,index){
 const wrap=document.createElement('div');wrap.className='ap-music-track';wrap.dataset.active=String(track.id===state.current?.id);
 const pick=button('', 'ap-music-play-track',()=>selectTrack(track,where), 'Play '+track.title);pick.append(art(track));
 const cp=document.createElement('span');cp.className='ap-music-track-copy';
 const title=document.createElement('strong');title.textContent=track.title;
 const artist=document.createElement('small');artist.textContent=track.artist+(where==='results'&&track.duration?' · '+clock(track.duration):'');
 cp.append(title,artist);pick.append(cp);wrap.append(pick);
 if(where==='results'){
   const save=button(fav(track.id)?'♥':'♡','ap-music-fav',()=>{
    state.favorites=fav(track.id)?state.favorites.filter(t=>t.id!==track.id):[track,...state.favorites].slice(0,100);
    persist();if(state.view==='saved')state.results=state.favorites.slice();renderResults();
   },'Save '+track.title);
   save.setAttribute('aria-pressed',String(fav(track.id)));wrap.append(save);
 }else{
   for(const [delta,label,text] of [[-1,'↑','Move up'],[1,'↓','Move down']]){
     const move=button(label,'ap-music-queue-move',()=>{
      const i=state.queue.findIndex(t=>t.id===track.id);if(i<0||i+delta<0||i+delta>=state.queue.length)return;
      [state.queue[i],state.queue[i+delta]]=[state.queue[i+delta],state.queue[i]];persist();renderQueue();
     },text+' '+track.title);
     move.disabled=delta<0?index===0:index===state.queue.length-1;
     wrap.append(move);
   }
 }
 return wrap;
}
function renderResults(){
 if(!results)return;
 $('apMusicResultTitle').textContent=state.view==='saved'?'Saved songs':state.view==='search'?'Song search':'Explore '+LANGS[state.lang]+' music';
 results.replaceChildren();
 if(state.loading){const e=document.createElement('p');e.className='ap-music-empty';e.textContent='Finding songs…';results.append(e)}
 else if(state.results.length)state.results.forEach((t,i)=>results.append(trackRow(t,'results',i)));
 else{const e=document.createElement('p');e.className='ap-music-empty';e.textContent=state.view==='saved'?'Save songs with ♡ to find them here.':'No songs found. Try an artist or song name.';results.append(e)}
 [...$('apMusicLanguages').querySelectorAll('button')].forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.musicLang===state.lang))});
}
function renderQueue(){
 if(!queue)return;
 $('apMusicQueueCount').textContent=String(state.queue.length);
 queue.replaceChildren();
 if(!state.queue.length){const empty=document.createElement('p');empty.className='ap-music-empty';empty.textContent='Pick a song. The queue can be reordered with ↑ and ↓.';queue.append(empty)}
 else state.queue.forEach((t,i)=>queue.append(trackRow(t,'queue',i)));
}
function renderNow(){
 if(!root)return;
 const e=$('apMusicNow');e.replaceChildren();
 e.append(art(state.current));
 const cp=document.createElement('span');cp.className='ap-music-track-copy';
 const title=document.createElement('strong');title.textContent=state.current?.title||'Pick a song';
 const artist=document.createElement('small');artist.textContent=state.current?.artist||'YouTube Music';
 cp.append(title,artist);e.append(cp);
 const play=$('apMusicPlay');play.textContent=state.playing?'Ⅱ':'▶';play.setAttribute('aria-label',state.playing?'Pause music':'Play music');
 $('apMusicRepeat').setAttribute('aria-pressed',String(state.repeat));$('apMusicRepeat').style.opacity=state.repeat?'1':'.4';
 renderProgress();
}
function render(){if(!root)return;renderResults();renderQueue();renderNow()}
function renderProgress(){
 if(!root)return;
 let current=0,duration=state.current?.duration||0;
 try{if(state.playerReady){current=yt.getCurrentTime()||0;duration=yt.getDuration()||duration}}catch{}
 $('apMusicElapsed').textContent=clock(current);$('apMusicDuration').textContent=clock(duration);
 $('apMusicSeek').value=String(duration>0?Math.min(100,Math.round(current/duration*100)):0);
}
async function search(raw){
 const query=short(raw,110);state.query=query;
 if(query.length===1){controller?.abort();state.request++;state.view='search';state.loading=false;state.results=[];renderResults();message('Enter at least 2 letters to search');return}
 state.view=query?'search':'discover';
 const id=++state.request;controller?.abort();controller=new AbortController();
 state.loading=true;state.results=[];renderResults();
 const params=new URLSearchParams({provider:'opentune',lang:state.lang,limit:'24'});if(query)params.set('q',query);
 try{
  const response=await fetch(SEARCH+'?'+params,{signal:controller.signal,headers:{Accept:'application/json'}});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Search failed');
  if(id!==state.request)return;
  state.results=(Array.isArray(data.tracks)?data.tracks:[]).filter(t=>validId(t.id)&&typeof t.title==='string').slice(0,30);
  message(state.results.length+' '+LANGS[state.lang]+' results · YouTube Music');
 }catch(err){if(err.name!=='AbortError'&&id===state.request)message(err.message||'Search unavailable. Try again.')}
 finally{if(id===state.request){state.loading=false;renderResults()}}
}
let tick=null;
function setupProgressTicker(){if(tick)return;tick=setInterval(()=>{if(state.opened&&state.playerReady&&state.playing)renderProgress()},850)}
function loadSDK(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(playerPromise)return playerPromise;
 playerPromise=new Promise((resolve,reject)=>{
  let completed=false;
  const prior=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{
   try{if(typeof prior==='function')prior()}catch{}
   if(!completed){completed=true;resolve(window.YT)}
  };
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{if(!completed){completed=true;reject(Error('YouTube player unavailable'))}};
  document.head.appendChild(script);
  setTimeout(()=>{if(!completed&&!window.YT?.Player){completed=true;reject(Error('YouTube player timed out'))}},15000);
 });
 return playerPromise;
}
async function setupYT(track){
 const frameRegion=$('apMusicYTRegion');frameRegion.hidden=false;
 const target=$('apMusicYoutubePlayer');
 try{
  await loadSDK();
  if(!state.opened)return;
  if(yt?.loadVideoById){yt.loadVideoById(track.id);return}
  state.playerReady=false;
  yt=new window.YT.Player(target,{
   height:'224',width:'100%',videoId:track.id,
   playerVars:{playsinline:1,controls:1,origin:location.origin,rel:0},
   events:{
    onReady:evt=>{state.playerReady=true;evt.target.setVolume(Number(saved.volume)||60);setupProgressTicker();if(state.current?.id===track.id)evt.target.playVideo()},
    onStateChange:evt=>{
     state.playing=evt.data===window.YT.PlayerState.PLAYING;
     if(evt.data===window.YT.PlayerState.ENDED)next(false);
     renderNow();
    },
    onError:evt=>{state.playing=false;message('This video cannot be embedded (code '+evt.data+'). Choose another song.');renderNow()},
    onAutoplayBlocked:()=>{message('Autoplay was blocked. Tap Play on the visible YouTube player.');state.playing=false;renderNow()}
   }
  });
 }catch(err){message(err.message||'Unable to load YouTube player')}
}
function selectTrack(track,source='queue'){
 if(!track||!validId(track.id))return;
 if(!state.queue.some(x=>x.id===track.id))state.queue.push(track);
 state.current=track;state.playing=false;persist();
 window.__8apdfBackgroundAudio?.pause?.();
 renderQueue();renderResults();renderNow();
 message('Opening '+track.title+' in the official YouTube player…');
 setupYT(track);
}
function next(manual){
 const list=state.queue;
 if(!list.length){message('Add a song to the queue first.');return}
 const index=list.findIndex(t=>t.id===state.current?.id);
 if(!manual&&!state.repeat&&index>=list.length-1){state.playing=false;renderNow();return}
 selectTrack(list[(index+1+list.length)%list.length],'queue');
}
function previous(){
 if(state.playerReady&&yt?.getCurrentTime?.()>3){yt.seekTo(0,true);return}
 const list=state.queue;if(!list.length)return;
 const index=list.findIndex(t=>t.id===state.current?.id);
 selectTrack(list[(index<=0?list.length:index)-1],'queue');
}
function toggle(){
 if(!state.current){if(state.queue.length)selectTrack(state.queue[0],'queue');else message('Select a song first');return}
 if(!state.playerReady){setupYT(state.current);return}
 if(state.playing)yt.pauseVideo();else{window.__8apdfBackgroundAudio?.pause?.();yt.playVideo()}
}
function open(){
 if(!document.body){document.addEventListener('DOMContentLoaded',open,{once:true});return}
 mount();if(state.opened)return;
 state.opened=true;oldFocus=document.activeElement;oldOverflow=document.body.style.overflow;
 shade.hidden=false;root.hidden=false;document.body.style.overflow='hidden';
 $('apMusicSearchInput').focus({preventScroll:true});
 if(!state.results.length&&state.view!=='saved')search(state.query);
 else render();
}
function close(){
 if(!state.opened)return;
 yt?.pauseVideo?.();state.playing=false;state.opened=false;
 root.hidden=true;shade.hidden=true;document.body.style.overflow=oldOverflow;
 renderNow();if(oldFocus?.isConnected)oldFocus.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 if(event.target.closest('#studioAudiusMusicLink,#studioMobileAudiusMusic,#studioOpenTuneMusic')){event.preventDefault();open()}
});
window.__8apdfMusic={open,close,search,selectLanguage:lang=>{if(Object.hasOwn(LANGS,lang)){state.lang=lang;persist();search('')}},getState:()=>({opened:state.opened,lang:state.lang,queue:state.queue.map(x=>x.id),current:state.current?.id,playing:state.playing})};
})();