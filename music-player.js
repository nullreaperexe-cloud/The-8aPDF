/* 8aPDF Music Studio: YouTube songs with official IFrame playback (visible video required by provider). */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const tracks=Array.isArray(window.__8apdfMusicCatalog)?window.__8apdfMusicCatalog:[];
const state={index:-1,status:'',filter:'All',search:'',loading:false,playToken:0,errorCount:0,searchUnavailable:false,playerReady:false,player:null,apiPromise:null,interval:0,previousFocus:null};
let overlay=null,dock=null,playerShown=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const mm=x=>{let n=Number(x);if(!Number.isFinite(n)||n<0)n=0;n=Math.floor(n);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const item=i=>tracks[i];
const active=()=>item(state.index);
const ytSearch=x=>'https://www.youtube.com/results?search_query='+encodeURIComponent(x.title+' '+x.artist+' official music video');
const ytLink=x=>x.videoId?'https://www.youtube.com/watch?v='+encodeURIComponent(x.videoId):ytSearch(x);
function notice(message){state.status=message;const e=$('apmStatus');if(e)e.textContent=message}
function playerSafe(name,fallback=0){try{return state.playerReady&&typeof state.player?.[name]==='function'?state.player[name]():fallback}catch{return fallback}}
function bindDock(){
 if(dock)return;
 dock=document.createElement('section');dock.id='apmDock';dock.className='apm-dock';dock.hidden=true;dock.setAttribute('aria-label','YouTube music controls');
 dock.innerHTML='<div class="apm-art" aria-hidden="true"><div class="apm-art-orbit"></div><div class="apm-bars"><i></i><i></i><i></i><i></i><i></i></div></div>'+
 '<div class="apm-meta"><strong id="apmTitle">Music Studio</strong><small id="apmArtist">Hindi · Punjabi · English</small></div>'+
 '<button type="button" class="apm-icon" id="apmPrev" aria-label="Previous song" title="Previous">⏮</button>'+
 '<button type="button" class="apm-main" id="apmPlay" aria-label="Play song" title="Play">▶</button>'+
 '<button type="button" class="apm-icon" id="apmNext" aria-label="Next song" title="Next">⏭</button>'+
 '<button type="button" class="apm-icon apm-queue" id="apmQueue" aria-label="Open song library" title="Song library">☷</button>'+
 '<button type="button" class="apm-icon apm-close" id="apmClose" aria-label="Close music" title="Close">×</button>'+
 '<div class="apm-timeline"><span id="apmElapsed">0:00</span><input id="apmSeek" type="range" min="0" max="1000" value="0" aria-label="Song position"><span id="apmLength">0:00</span></div>'+
 '<div class="apm-volume"><label for="apmVolume">♫</label><input id="apmVolume" aria-label="Music volume" type="range" min="0" max="100" value="65"></div>'+
 '<a id="apmCredit" href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" title="Open current song on YouTube">YouTube ↗</a>';
 document.body.append(dock);
 $('apmPlay').onclick=()=>{if(!visible()){open();notice('Keep the YouTube player visible to continue playback.');return;}if(state.index<0){play(0);return}const ps=playerSafe('getPlayerState',-1);if(ps===1)state.player.pauseVideo();else if(state.playerReady)state.player.playVideo();else play(state.index)};
 $('apmPrev').onclick=()=>jump(-1);$('apmNext').onclick=()=>jump(1);$('apmQueue').onclick=open;
 $('apmClose').onclick=()=>{pause();if(overlay){overlay.hidden=true;overlay.classList.remove('apm-minimized')}document.body.classList.remove('apm-open');hideDock()};
 $('apmSeek').oninput=e=>{const d=playerSafe('getDuration',0);if(d>0&&state.playerReady)state.player.seekTo(d*Number(e.target.value)/1000,true)};
 $('apmVolume').oninput=e=>{const n=Number(e.target.value);try{sessionStorage.setItem('8apdf_yt_volume',String(n))}catch{};if(state.playerReady)state.player.setVolume(n)};
 try{const v=Number(sessionStorage.getItem('8apdf_yt_volume'));if(Number.isFinite(v)&&v>=0&&v<=100)$('apmVolume').value=String(v)}catch{}
}
function hideDock(){dock.hidden=true;dock.classList.remove('apm-playing');document.body.classList.remove('apm-docked')}
function showDock(){bindDock();dock.hidden=false;dock.classList.add('apm-appearing');document.body.classList.add('apm-docked')}
function sync(playing){if(!dock)return;dock.classList.toggle('apm-playing',playing);$('apmPlay').textContent=playing?'Ⅱ':'▶';$('apmPlay').setAttribute('aria-label',playing?'Pause song':'Play song');$('apmPlay').title=playing?'Pause':'Play'}
function progress(){if(!dock||dock.hidden)return;const d=playerSafe('getDuration',0),t=playerSafe('getCurrentTime',0);$('apmElapsed').textContent=mm(t);$('apmLength').textContent=mm(d);const pct=d>0?Math.max(0,Math.min(100,t/d*100)):0;$('apmSeek').value=String(Math.round(pct*10));$('apmSeek').style.setProperty('--apm-progress',pct+'%')}
function clock(stop=false){clearInterval(state.interval);state.interval=0;if(!stop)state.interval=setInterval(progress,400);progress()}
function pause(){if(state.playerReady)try{state.player.pauseVideo()}catch{}sync(false);clock(true)}
function visible(){return !!overlay&&!overlay.hidden&&!!$('apmVideoFrame')&&!$('apmVideoFrame').hidden}
function buildOverlay(){
 if(overlay)return;
 overlay=document.createElement('div');overlay.id='apmOverlay';overlay.className='apm-overlay';overlay.hidden=true;
 overlay.innerHTML='<section class="apm-sheet" role="dialog" aria-modal="true" aria-labelledby="apmHeading">'+
 '<header class="apm-header"><div><span class="apm-kicker">8aPDF · YOUTUBE MUSIC</span><h2 id="apmHeading">Viral Music <span>♫</span></h2><p>Hindi, Punjabi & English hits · '+tracks.length+' curated songs</p></div><button id="apmDismiss" aria-label="Close music library" type="button">×</button></header>'+
 '<div class="apm-video-frame" id="apmVideoFrame" hidden><div id="apmYTMount"></div><p>Official YouTube player · keep this video visible during playback.</p></div>'+
 '<div class="apm-searchline"><input id="apmFind" type="search" placeholder="Search your favourite songs…" aria-label="Search music library"><span id="apmCount"></span></div>'+
 '<div class="apm-genres" id="apmGenres" aria-label="Music categories"></div>'+
 '<div class="apm-status" id="apmStatus" role="status"></div><div class="apm-tracks" id="apmTracks"></div>'+
 '<footer class="apm-foot">Play opens an official YouTube embed when available. Songs play inside 8aPDF when their official video IDs are available and embedding is permitted. An external YouTube video lookup key is needed for unlinked titles.</footer></section>';
 document.body.append(overlay);
 $('apmDismiss').onclick=close;
 overlay.onclick=e=>{if(e.target===overlay&&!overlay.classList.contains('apm-minimized'))close();const b=e.target.closest('[data-apm-index]');if(b)play(Number(b.dataset.apmIndex));};
 $('apmFind').oninput=e=>{state.search=e.target.value.toLowerCase().trim();render()};
 $('apmGenres').onclick=e=>{const b=e.target.closest('[data-apm-genre]');if(b){state.filter=b.dataset.apmGenre;render()}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden&&!overlay.classList.contains('apm-minimized'))close()});
}
function render(){
 if(!overlay)return;
 const genres=['All','Hindi','Punjabi','English'];
 $('apmGenres').innerHTML=genres.map(g=>'<button type="button" data-apm-genre="'+g+'" class="'+(state.filter===g?'selected':'')+'" aria-pressed="'+(state.filter===g)+'">'+g+'</button>').join('');
 const visibleTracks=tracks.map((x,i)=>({...x,index:i})).filter(x=>(state.filter==='All'||x.genre===state.filter)&&(!state.search||(x.title+' '+x.artist).toLowerCase().includes(state.search))).sort((a,b)=>Number(!!b.videoId)-Number(!!a.videoId));
 $('apmCount').textContent=visibleTracks.filter(x=>x.videoId).length+' linked / '+visibleTracks.length+' listed';
 $('apmTracks').innerHTML=visibleTracks.map(x=>'<div class="apm-track'+(x.index===state.index?' current':'')+'">'+
 '<button type="button" class="apm-trackchoice" data-apm-index="'+x.index+'" aria-label="Play '+esc(x.title)+'">'+
 '<span class="apm-trackmark">♫</span><span class="apm-trackwords"><strong>'+esc(x.title)+'</strong><small>'+esc(x.artist)+' · '+esc(x.genre)+'</small></span><span class="apm-trackplay">▶</span></button>'+
 '<span class="apm-direct apm-source-state" aria-label="'+(x.videoId?'YouTube video linked':'Video ID lookup required')+'">'+(x.videoId?'Ready ✓':'Lookup needed')+'</span></div>').join('')||'<p class="apm-empty">No matching songs found.</p>';
 $('apmStatus').textContent=state.status||'Select a linked track. Unlinked tracks require a configured YouTube video lookup.';
}
function open(){
 bindDock();buildOverlay();state.previousFocus=document.activeElement;
 overlay.hidden=false;overlay.classList.remove('apm-minimized');overlay.setAttribute('aria-label','Music library');document.body.classList.add('apm-open');render();
 $('apmFind').focus({preventScroll:true});
}
function close(){
 if(!overlay||overlay.hidden||overlay.classList.contains('apm-minimized'))return;
 document.body.classList.remove('apm-open');
 const frame=$('apmVideoFrame');
 // Keep original YouTube iframe mounted, visible, and playing.
 if(frame&&!frame.hidden&&state.playerReady){
  overlay.classList.add('apm-minimized');
  overlay.setAttribute('aria-label','Visible floating YouTube player');
  notice('Music continues in the visible floating YouTube player.');
 }else{overlay.hidden=true;pause()}
 state.previousFocus?.focus?.({preventScroll:true});
}
function ensureYouTube(){
 if(window.YT?.Player)return Promise.resolve();
 if(state.apiPromise)return state.apiPromise;
 state.apiPromise=new Promise((resolve,reject)=>{
  let done=false;const before=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{try{if(typeof before==='function')before()}catch{};if(!done){done=true;clearTimeout(timeout);resolve()}};
  const timeout=setTimeout(()=>{if(!done){done=true;state.apiPromise=null;reject(Error('YouTube player could not load'))}},15000);
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{if(!done){done=true;clearTimeout(timeout);state.apiPromise=null;reject(Error('YouTube is blocked by your connection'))}};document.head.append(script);
 });return state.apiPromise;
}
function onPlayerState(ev){
 if(!window.YT)return;
 const p=YT.PlayerState;
 if(ev.data===p.PLAYING){state.errorCount=0;sync(true);clock();notice('Playing via YouTube · Next song plays automatically.')}
 else if(ev.data===p.PAUSED){sync(false);clock(true)}
 else if(ev.data===p.ENDED){sync(false);clock(true);jump(1,true)}
 else if(ev.data===p.BUFFERING){notice('Buffering song…');clock(true)}
 else if(ev.data===p.CUED){notice('Ready to play.')}
}
function onPlayerError(ev){
 sync(false);clock(true);
 const msg=ev.data===101||ev.data===150?'This song does not allow embedding.':ev.data===100?'This video is unavailable.':'YouTube could not play this video.';
 notice(msg+' Trying the next embedded track.');
 if(state.errorCount++<3&&visible())setTimeout(()=>jump(1,true),500);
}
async function resolve(x){
 if(x.videoId)return x.videoId;
 if(state.searchUnavailable)throw Error('Video lookup unavailable (YouTube API key missing or quota exceeded). A verified video ID is required.');
 const key='8apdf_yt_song_'+encodeURIComponent(x.title+'-'+x.artist).slice(0,150);
 try{const cache=JSON.parse(localStorage.getItem(key)||'null');if(cache?.videoId&&/^[\w-]{11}$/.test(cache.videoId)&&Date.now()-cache.savedAt<7*86400000){x.videoId=cache.videoId;return x.videoId}}catch{}
 const response=await fetch('/api/music-search?q='+encodeURIComponent(x.title+' '+x.artist+' official music video'),{headers:{Accept:'application/json'}});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===503)state.searchUnavailable=true;throw Error(result.error||'YouTube video lookup unavailable')}
 const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const queryWords=norm(x.title).split(' ').filter(z=>z.length>2);const artistWords=norm(x.artist).split(' ').filter(z=>z.length>3);
 const ranked=(result.items||[]).filter(v=>/^[\w-]{11}$/.test(v.videoId)).map(v=>{
  const t=norm(v.title),ch=norm(v.channel);
  let score=queryWords.reduce((n,w)=>n+(t.includes(w)?3:-4),0)+artistWords.reduce((n,w)=>n+(t.includes(w)||ch.includes(w)?1:0),0);
  if(/official video|official music|official audio|lyric video/.test(t))score+=4;
  if(/reaction|cover song|slowed|nightcore|karaoke|tutorial|shorts|remix/.test(t))score-=12;
  return {...v,score};
 }).sort((a,b)=>b.score-a.score);
 if(!ranked.length||ranked[0].score<2)throw Error('No suitable embeddable video found.');
 x.videoId=ranked[0].videoId;
 try{localStorage.setItem(key,JSON.stringify({videoId:x.videoId,savedAt:Date.now()}))}catch{}
 return x.videoId;
}
async function play(i,fromAutonext=false){
 if(!tracks.length){notice('Music library failed to load. Please refresh.');return}
 const token=++state.playToken;
 const n=((i%tracks.length)+tracks.length)%tracks.length,x=item(n);
 state.index=n;state.loading=true;
 pause();
 if(!overlay||overlay.hidden)open();
 showDock();$('apmTitle').textContent=x.title;$('apmArtist').textContent=x.artist+' · '+x.genre;
 $('apmCredit').href=ytLink(x);
 $('apmCredit').textContent='YouTube ↗';
 $('apmElapsed').textContent='0:00';$('apmLength').textContent='0:00';$('apmSeek').value='0';
 sync(false);clock(true);notice('Finding official YouTube video for '+x.title+'…');
 if(fromAutonext&&state.searchUnavailable&&!x.videoId){if(state.errorCount++>6){notice('No other linked playable tracks. Please retry later.');return}jump(1,true);return}
 try{
  const id=await resolve(x);
  if(token!==state.playToken)return;
  const frame=$('apmVideoFrame');frame.hidden=false;playerShown=true;
  render();
  await ensureYouTube();
  if(token!==state.playToken||!visible())return;
  if(!state.player){
   state.playerReady=false;
   state.player=new YT.Player('apmYTMount',{width:'480',height:'270',videoId:id,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},
    events:{onReady:e=>{state.playerReady=true;const v=Number($('apmVolume').value);e.target.setVolume(v);if(visible())e.target.playVideo()},
            onStateChange:onPlayerState,onError:onPlayerError}});
  }else if(state.playerReady){state.player.loadVideoById(id)}
  else{notice('YouTube is still preparing playback. Try Play in a moment.')}
  state.loading=false;
 }catch(e){
  if(token!==state.playToken)return;
  state.loading=false;sync(false);clock(true);
  $('apmVideoFrame').hidden=!state.playerReady;
  notice(e.message+' · Could not play this track inside 8aPDF yet.');
  if(fromAutonext&&state.errorCount++<3)setTimeout(()=>jump(1,true),400);
 }
}
function jump(n,autonext=false){
 if(!tracks.length)return;
 let next=state.index<0?0:state.index+n;
 if(autonext&&state.searchUnavailable){
  const dir=n<0?-1:1;let j=0;
  while(j<tracks.length&&!item((next+tracks.length)%tracks.length).videoId){next+=dir;j++;}
  if(j===tracks.length){notice('No more playable embedded songs. Browse on YouTube for more.');return}
 }
 play(next,autonext);
}
window.__8apdfMusic={open,close,catalogCount:()=>tracks.length};
})();
