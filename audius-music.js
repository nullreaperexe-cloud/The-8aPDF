/* 8aPDF Music: original 8aPDF UI, streamed Audius tracks. No hosted audio or API secrets. */
(()=>{
'use strict';
const ROOT='/api/music-search';
const STORE='8apdf_audius_music_v1';
const byId=id=>document.getElementById(id);
const limited=(value,max)=>String(value||'').slice(0,max);
const format=sec=>{const n=Math.max(0,Math.floor(Number(sec)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
function read(){try{return JSON.parse(localStorage.getItem(STORE)||'null')||{}}catch{return {}}}
const stored=read();
const state={
  open:false,view:'trending',query:'',results:[],queue:Array.isArray(stored.queue)?stored.queue.filter(x=>x&&typeof x.id==='string').slice(0,100):[],
  favorites:Array.isArray(stored.favorites)?stored.favorites.filter(x=>x&&typeof x.id==='string').slice(0,100):[],
  current:null,loading:false,more:false,offset:0,repeat:stored.repeat!==false,request:0,
  playing:false
};
let elements=null, audio=null, searchTimer=null, pending=null, originalFocus=null, oldOverflow='';
const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify({queue:state.queue,favorites:state.favorites,repeat:state.repeat,volume:audio?.volume??0.35}))}catch{}};
function mount(){
 if(elements)return;
 const shade=document.createElement('div');shade.className='ap-music-backdrop';shade.hidden=true;
 const panel=document.createElement('section');panel.id='eightapdfAudiusMusic';panel.className='ap-music';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','8aPDF Music');
 panel.innerHTML='<header class="ap-music-top"><div class="ap-music-title"><div class="ap-music-eyebrow">8aPDF · MUSIC</div><h2>Your Music Space</h2><p>Discover and stream independent music, powered by Audius</p></div><button class="ap-music-icon-btn" id="apMusicClose" type="button" aria-label="Close music">✕</button></header>'+
 '<div class="ap-music-workspace"><main class="ap-music-catalog">'+
 '<form class="ap-music-search" id="apMusicSearchForm" role="search"><span aria-hidden="true">⌕</span><input id="apMusicSearchInput" type="search" placeholder="Search songs or artists..." aria-label="Search Audius songs" autocomplete="off" maxlength="100"><button type="submit">Search</button></form>'+
 '<div class="ap-music-heading"><strong id="apMusicResultTitle">Trending tracks</strong><span><button class="ap-music-cta" id="apMusicTrending" type="button">Explore</button> <button class="ap-music-cta" id="apMusicSaved" type="button">♥ Saved</button></span></div>'+
 '<div id="apMusicResults" class="ap-music-tracklist" aria-live="polite"></div><div class="ap-music-load"><button id="apMusicMore" class="ap-music-cta" type="button" hidden>Load more</button></div>'+
 '<p class="ap-music-toggle">♫ Tracks are streamed from Audius. Catalog and playback availability may vary.</p></main>'+
 '<aside class="ap-music-queue" aria-label="Playback queue"><div class="ap-music-queue-head"><strong>Up next · <span id="apMusicQueueCount">0</span></strong><button type="button" id="apMusicClearQueue">Clear queue</button></div><div class="ap-music-queue-list" id="apMusicQueue"></div></aside></div>'+
 '<footer class="ap-music-footer"><div class="ap-music-now"><span id="apMusicNowArt" class="ap-music-cover ap-music-cover-empty">♫</span><div class="ap-music-track-copy"><strong id="apMusicNowTitle">Choose a song</strong><small id="apMusicNowArtist">Audius Music</small></div></div>'+
 '<div class="ap-music-player"><div class="ap-music-buttons"><button id="apMusicPrev" type="button" aria-label="Previous song">⏮</button><button id="apMusicPlay" class="ap-music-primary" type="button" aria-label="Play music">▶</button><button id="apMusicNext" type="button" aria-label="Next song">⏭</button><button id="apMusicRepeat" type="button" aria-label="Toggle playlist repeat" aria-pressed="true">↻</button></div>'+
 '<div class="ap-music-seek"><time id="apMusicElapsed">0:00</time><input type="range" min="0" max="100" value="0" step="1" id="apMusicSeek" aria-label="Seek song"><time id="apMusicDuration">0:00</time></div></div>'+
 '<label class="ap-music-level">Volume<input type="range" id="apMusicVolume" min="0" max="100" value="35" aria-label="Music volume"></label></footer><p class="ap-music-status" id="apMusicStatus" role="status" aria-live="polite">Ready to discover music</p>';
 document.body.append(shade,panel);
 audio=document.createElement('audio');audio.id='eightapdfAudiusAudio';audio.preload='none';audio.playsInline=true;
 audio.volume=Number.isFinite(stored.volume)?Math.max(0,Math.min(1,stored.volume)):.35;
 document.body.appendChild(audio);
 elements={shade,panel,search:byId('apMusicSearchInput'),results:byId('apMusicResults'),queue:byId('apMusicQueue'),status:byId('apMusicStatus')};
 byId('apMusicVolume').value=String(Math.round(audio.volume*100));
 byId('apMusicClose').addEventListener('click',close);
 shade.addEventListener('click',close);
 byId('apMusicSearchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);search(elements.search.value)});
 elements.search.addEventListener('input',()=>{
   clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(elements.search.value),360);
 });
 byId('apMusicTrending').addEventListener('click',()=>{elements.search.value='';search('')});
 byId('apMusicSaved').addEventListener('click',()=>{if(pending)pending.abort();state.request++;state.view='saved';state.query='';elements.search.value='';state.loading=false;state.results=state.favorites.slice();state.more=false;render()});
 byId('apMusicMore').addEventListener('click',()=>fetchTracks(true));
 byId('apMusicClearQueue').addEventListener('click',()=>{state.queue=[];persist();renderQueue()});
 byId('apMusicPrev').addEventListener('click',previous);
 byId('apMusicNext').addEventListener('click',next);
 byId('apMusicPlay').addEventListener('click',toggle);
 byId('apMusicRepeat').addEventListener('click',()=>{state.repeat=!state.repeat;persist();updatePlayer()});
 byId('apMusicVolume').addEventListener('input',e=>{audio.volume=Number(e.target.value)/100;persist()});
 byId('apMusicSeek').addEventListener('input',e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/100});
 audio.addEventListener('playing',()=>{state.playing=true;setStatus('Playing '+(state.current?.title||'music'));updatePlayer()});
 audio.addEventListener('pause',()=>{state.playing=false;updatePlayer()});
 audio.addEventListener('timeupdate',updateProgress);
 audio.addEventListener('loadedmetadata',updateProgress);
 audio.addEventListener('ended',()=>{state.playing=false;if(state.repeat||state.queue.findIndex(t=>t.id===state.current?.id)<state.queue.length-1)next();else updatePlayer()});
 audio.addEventListener('error',()=>{state.playing=false;setStatus('That track could not be streamed. Try another song.');updatePlayer()});
 document.addEventListener('keydown',e=>{if(!state.open)return;if(e.key==='Escape')close()});
 updatePlayer();renderQueue();
}
function setStatus(message){if(elements)elements.status.textContent=message}
function artworkNode(track){
 if(track?.artwork&&/^https:\/\//.test(track.artwork)){
   const im=document.createElement('img');im.className='ap-music-cover';im.src=track.artwork;im.alt='';im.loading='lazy';im.referrerPolicy='no-referrer';im.onerror=()=>{const fallback=document.createElement('span');fallback.className='ap-music-cover ap-music-cover-empty';fallback.textContent='♫';im.replaceWith(fallback)};return im;
 }
 const blank=document.createElement('span');blank.className='ap-music-cover ap-music-cover-empty';blank.textContent='♫';return blank;
}
function isFavorite(id){return state.favorites.some(t=>t.id===id)}
function row(track,mode,index){
 const item=document.createElement('div');item.className='ap-music-track';
 item.dataset.active=String(state.current?.id===track.id);
 const play=document.createElement('button');play.type='button';play.className='ap-music-play-track';play.setAttribute('aria-label','Play '+track.title);
 play.appendChild(artworkNode(track));
 const name=document.createElement('span');name.className='ap-music-track-copy';
 const strong=document.createElement('strong');strong.textContent=track.title;
 const small=document.createElement('small');small.textContent=track.artist+(mode==='results'&&track.duration?' · '+format(track.duration):'');
 name.append(strong,small);play.appendChild(name);
 play.addEventListener('click',()=>playTrack(track,mode==='results'?'results':'queue'));
 item.appendChild(play);
 if(mode==='results'){
   const fav=document.createElement('button');fav.type='button';fav.className='ap-music-fav';fav.textContent=isFavorite(track.id)?'♥':'♡';
   fav.setAttribute('aria-label',(isFavorite(track.id)?'Remove saved ':'Save ')+track.title);
   fav.setAttribute('aria-pressed',String(isFavorite(track.id)));
   fav.addEventListener('click',()=>favorite(track));
   item.appendChild(fav);
 } else {
   for(const [step,symbol,desc] of [[-1,'↑','Move up'],[1,'↓','Move down']]){
     const move=document.createElement('button');move.type='button';move.className='ap-music-queue-move';move.textContent=symbol;
     move.disabled=(step<0&&index===0)||(step>0&&index===state.queue.length-1);
     move.setAttribute('aria-label',desc+' '+track.title);
     move.addEventListener('click',()=>{const at=state.queue.findIndex(t=>t.id===track.id),to=at+step;if(to<0||to>=state.queue.length)return;[state.queue[at],state.queue[to]]=[state.queue[to],state.queue[at]];persist();renderQueue()});
     item.appendChild(move);
   }
 }
 return item;
}
function renderResults(){
 if(!elements)return;
 const title=state.view==='saved'?'Saved songs':state.view==='search'?'Search results':'Trending on Audius';
 byId('apMusicResultTitle').textContent=title;
 elements.results.replaceChildren();
 if(state.loading&&state.offset===0){const p=document.createElement('p');p.className='ap-music-empty';p.textContent='Finding tracks…';elements.results.appendChild(p)}
 else if(!state.results.length){const p=document.createElement('p');p.className='ap-music-empty';p.textContent=state.view==='saved'?'Tap ♡ beside a song to save it here.':'No tracks found. Try another search.';elements.results.appendChild(p)}
 else state.results.forEach((t,i)=>elements.results.appendChild(row(t,'results',i)));
 const more=byId('apMusicMore');more.hidden=!state.more||state.view==='saved';more.disabled=state.loading;more.textContent=state.loading?'Loading…':'Load more';
}
function renderQueue(){
 if(!elements)return;
 byId('apMusicQueueCount').textContent=String(state.queue.length);
 elements.queue.replaceChildren();
 if(!state.queue.length){const p=document.createElement('p');p.className='ap-music-empty';p.textContent='Select any song to start a playlist. Use the arrows to change its order.';elements.queue.appendChild(p)}
 else state.queue.forEach((t,i)=>elements.queue.appendChild(row(t,'queue',i)));
}
function render(){renderResults();renderQueue();updatePlayer()}
function favorite(track){
 if(isFavorite(track.id))state.favorites=state.favorites.filter(x=>x.id!==track.id);
 else state.favorites=[track,...state.favorites].slice(0,100);
 persist();if(state.view==='saved')state.results=state.favorites.slice();renderResults();
}
async function fetchTracks(more=false){
 if(state.view==='saved')return;
 if(pending)pending.abort();
 const request=++state.request;
 const offset=more?state.offset:0;
 state.loading=true;if(!more){state.results=[];state.offset=0}
 if(elements)renderResults();
 const controller=new AbortController();pending=controller;
 const params=new URLSearchParams({provider:'audius',limit:'20',offset:String(offset)});
 if(state.query)params.set('q',state.query);
 try {
  const response=await fetch(ROOT+'?'+params.toString(),{signal:controller.signal,headers:{Accept:'application/json'}});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Music unavailable');
  if(request!==state.request)return;
  const tracks=(Array.isArray(body.tracks)?body.tracks:[]).filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string');
  const ids=new Set(more?state.results.map(t=>t.id):[]);
  state.results=(more?state.results:[]).concat(tracks.filter(t=>!ids.has(t.id)));
  state.offset=offset+20;state.more=Boolean(body.hasMore&&tracks.length);setStatus(state.results.length+' tracks found · Audius');
 }catch(err){
  if(err.name!=='AbortError'&&request===state.request)setStatus(err.message||'Could not load Audius tracks. Try again.');
 }finally{if(request===state.request){state.loading=false;renderResults()}}
}
function search(input){
 const term=limited(input,100).trim();
 state.query=term;
 if(term.length===1){if(pending)pending.abort();state.request++;state.results=[];state.more=false;state.loading=false;state.view='search';renderResults();setStatus('Enter at least 2 characters to search');return}
 state.view=term?'search':'trending';fetchTracks();
}
function chooseQueue(track,source){
 if(source==='results'){
   const src=state.results.length?state.results:[track];
   state.queue=src.slice(0,80);
 } else if(!state.queue.some(t=>t.id===track.id))state.queue=[...state.queue,track];
 if(!state.queue.some(t=>t.id===track.id))state.queue.unshift(track);
 persist();
}
function streamUrl(id){return 'https://api.audius.co/v1/tracks/'+encodeURIComponent(id)+'/stream?app_name=8apdf'}
function playTrack(track,source='queue'){
 if(!track||!(/^[\w-]{2,90}$/).test(track.id))return;
 chooseQueue(track,source);
 state.current=track;
 window.__8apdfBackgroundAudio?.pause?.();
 audio.pause();
 audio.src=streamUrl(track.id);
 audio.load();
 updatePlayer();renderQueue();renderResults();resume();
}
async function resume(){
 if(!state.current){const first=state.queue[0]||state.results[0];if(first)return playTrack(first,state.queue.length?'queue':'results');setStatus('Select a song first');return}
 window.__8apdfBackgroundAudio?.pause?.();
 try{setStatus('Loading '+state.current.title+'…');await audio.play()}catch(e){state.playing=false;setStatus(e?.name==='NotAllowedError'?'Tap Play to allow music on this device.':'Could not play this track. Try another song.');updatePlayer()}
}
function toggle(){if(!state.current){resume();return}if(!audio.paused){audio.pause();setStatus('Paused')}else resume()}
function next(){
 if(!state.queue.length){setStatus('Queue is empty');return}
 let index=state.queue.findIndex(t=>t.id===state.current?.id);if(index<0)index=-1;
 if(index===state.queue.length-1&&!state.repeat){audio.pause();return}
 playTrack(state.queue[(index+1)%state.queue.length],'queue');
}
function previous(){
 if(audio.currentTime>3){audio.currentTime=0;return}
 if(!state.queue.length)return;
 const index=state.queue.findIndex(t=>t.id===state.current?.id);
 playTrack(state.queue[(index-1+state.queue.length)%state.queue.length],'queue');
}
function updateProgress(){
 if(!elements)return;
 byId('apMusicElapsed').textContent=format(audio.currentTime);
 byId('apMusicDuration').textContent=format(Number.isFinite(audio.duration)?audio.duration:state.current?.duration||0);
 byId('apMusicSeek').value=String(Number.isFinite(audio.duration)&&audio.duration>0?Math.min(100,100*audio.currentTime/audio.duration):0);
}
function updatePlayer(){
 if(!elements)return;
 const btn=byId('apMusicPlay');btn.textContent=state.playing?'Ⅱ':'▶';btn.setAttribute('aria-label',state.playing?'Pause music':'Play music');
 byId('apMusicRepeat').setAttribute('aria-pressed',String(state.repeat));
 byId('apMusicRepeat').style.opacity=state.repeat?'1':'.4';
 byId('apMusicNowTitle').textContent=state.current?.title||'Choose a song';
 byId('apMusicNowArtist').textContent=state.current?.artist||'Audius Music';
 const art=byId('apMusicNowArt');if(art&&state.current&&art.dataset.track!==state.current.id){
   const nextArt=artworkNode(state.current);nextArt.id='apMusicNowArt';nextArt.dataset.track=state.current.id;art.replaceWith(nextArt);
 }
 updateProgress();
}
function open(){
 if(!document.body){document.addEventListener('DOMContentLoaded',open,{once:true});return}
 mount();
 if(state.open)return;
 originalFocus=document.activeElement;oldOverflow=document.body.style.overflow;
 state.open=true;elements.shade.hidden=false;elements.panel.hidden=false;document.body.style.overflow='hidden';
 elements.search.focus({preventScroll:true});
 if(!state.results.length&&!state.loading&&state.view!=='saved')fetchTracks();
}
function close(){
 if(!elements||!state.open)return;
 state.open=false;elements.shade.hidden=true;elements.panel.hidden=true;
 document.body.style.overflow=oldOverflow;
 if(originalFocus?.isConnected)originalFocus.focus({preventScroll:true});
}
window.__8apdfMusic={open,close,getState:()=>({open:state.open,results:state.results.length,queue:state.queue.map(t=>t.id),current:state.current?.id||null,playing:state.playing})};
document.addEventListener('click',e=>{if(e.target.closest('#studioAudiusMusicLink,#studioMobileAudiusMusic')){e.preventDefault();open()}});
})();
