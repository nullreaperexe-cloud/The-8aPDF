/* 8aPDF Audio Studio — authorized, visible audio controls; no hidden video extraction. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const searchGroups=[
 ['Study','instrumental music filetype:audio'],
 ['Piano','piano music filetype:audio'],
 ['Classical','classical music filetype:audio'],
 ['Guitar','guitar music filetype:audio'],
 ['Relax','relaxing music filetype:audio'],
 ['Indian','Indian classical music filetype:audio'],
 ['Jazz','jazz music filetype:audio'],
 ['Ambient','ambient music filetype:audio'],
 ['Instrumental','instrumental filetype:audio'],
 ['Orchestral','orchestral music filetype:audio'],
 ['Acoustic','acoustic music filetype:audio'],
 ['Music','music filetype:audio']
];
const state={tracks:[],seen:new Set(),current:-1,loading:false,loaded:false,filter:'All',search:'',skipFailures:0};
const audio=new Audio();audio.preload='none';audio.volume=.65;
let lastStatus='',panel=null,dock=null,controller=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=x=>Number.isFinite(x)?Math.floor(x/60)+':'+String(Math.floor(x%60)).padStart(2,'0'):'0:00';
const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:''}catch{return ''}};
function status(msg){lastStatus=msg;const e=$('apmStatus');if(e)e.textContent=msg;}
function setup(){
 if(dock)return;
 dock=document.createElement('section');dock.id='apmDock';dock.className='apm-dock';dock.hidden=true;dock.setAttribute('aria-label','Music playback');
 dock.innerHTML='<div class="apm-art" aria-hidden="true"><div class="apm-art-orbit"></div><div class="apm-bars"><i></i><i></i><i></i><i></i><i></i></div></div>'+
 '<div class="apm-meta"><strong id="apmTitle">Music</strong><small id="apmArtist">Audio Studio</small></div>'+
 '<button type="button" class="apm-icon" id="apmPrev" aria-label="Previous track" title="Previous">⏮</button>'+
 '<button type="button" class="apm-main" id="apmPlay" aria-label="Play" title="Play">▶</button>'+
 '<button type="button" class="apm-icon" id="apmNext" aria-label="Next track" title="Next">⏭</button>'+
 '<button type="button" class="apm-icon apm-queue" id="apmQueue" aria-label="Open music library" title="Music library">☷</button>'+
 '<button type="button" class="apm-icon apm-close" id="apmClose" aria-label="Close music player" title="Close">×</button>'+
 '<div class="apm-timeline"><span id="apmElapsed">0:00</span><input id="apmSeek" type="range" min="0" max="1000" value="0" aria-label="Song position"><span id="apmLength">0:00</span></div>'+
 '<div class="apm-volume"><label for="apmVolume" aria-label="Volume">♫</label><input id="apmVolume" type="range" min="0" max="100" value="65" aria-label="Volume"></div>'+
 '<a id="apmCredit" target="_blank" rel="noopener noreferrer" title="Artist credits and license">Source ↗</a>';
 document.body.append(dock);
 $('apmPlay').onclick=()=>{if(!audio.src&&state.tracks.length)select(0);else if(audio.paused)audio.play().catch(playbackFailure);else audio.pause()};
 $('apmPrev').onclick=()=>step(-1);
 $('apmNext').onclick=()=>step(1);
 $('apmQueue').onclick=open;
 $('apmClose').onclick=()=>{audio.pause();audio.removeAttribute('src');audio.load();dock.hidden=true;dock.classList.remove('apm-playing');};
 $('apmSeek').oninput=e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*(Number(e.target.value)/1000)};
 $('apmVolume').oninput=e=>{audio.volume=Number(e.target.value)/100;try{localStorage.setItem('8apdf_audio_volume',String(audio.volume))}catch{}};
 try{const n=Number(localStorage.getItem('8apdf_audio_volume'));if(Number.isFinite(n)&&n>=0&&n<=1){audio.volume=n;$('apmVolume').value=String(Math.round(n*100))}}catch{}
 audio.addEventListener('play',sync);
 audio.addEventListener('pause',sync);
 audio.addEventListener('waiting',()=>{if(!audio.paused)status('Buffering audio…')});
 audio.addEventListener('playing',()=>{state.skipFailures=0;status('Playing');sync()});
 audio.addEventListener('loadedmetadata',progress);
 audio.addEventListener('durationchange',progress);
 audio.addEventListener('timeupdate',progress);
 audio.addEventListener('ended',()=>step(1));
 audio.addEventListener('error',()=>{if(state.current>=0){status('Track unavailable — finding the next playable track');recover()}});
}
function sync(){if(!dock)return;const playing=!audio.paused&&!audio.ended;dock.classList.toggle('apm-playing',playing);$('apmPlay').textContent=playing?'Ⅱ':'▶';$('apmPlay').setAttribute('aria-label',playing?'Pause':'Play');$('apmPlay').title=playing?'Pause':'Play'}
function progress(){if(!dock)return;const duration=Number.isFinite(audio.duration)?audio.duration:0;const current=Number.isFinite(audio.currentTime)?audio.currentTime:0;$('apmElapsed').textContent=time(current);$('apmLength').textContent=time(duration);$('apmSeek').value=duration?String(Math.round(current/duration*1000)):'0';$('apmSeek').style.setProperty('--apm-progress',duration?(current/duration*100)+'%':'0%')}
function playbackFailure(e){if(e?.name==='NotAllowedError'){status('Tap Play again to allow audio playback');sync();return}status('Could not play this track; trying the next one');recover()}
function recover(){if(state.skipFailures++>=Math.min(6,state.tracks.length)){audio.pause();sync();status('Several tracks unavailable. Choose another song from the library.');return}step(1)}
function select(i){
 setup();if(!state.tracks.length)return;
 const n=(i+state.tracks.length)%state.tracks.length,t=state.tracks[n];
 state.current=n;audio.pause();audio.src=t.src;audio.load();dock.hidden=false;
 dock.classList.remove('apm-appearing');void dock.offsetWidth;dock.classList.add('apm-appearing');
 $('apmTitle').textContent=t.title;$('apmArtist').textContent=t.artist+' · '+t.genre;
 $('apmCredit').href=t.source;$('apmCredit').textContent=t.license+' ↗';
 $('apmSeek').value='0';$('apmElapsed').textContent='0:00';$('apmLength').textContent='0:00';
 status('Loading '+t.title+'…');sync();audio.play().catch(err=>{if(state.current===n&&err?.name!=='AbortError')playbackFailure(err)});highlightPlaying();
 try{localStorage.setItem('8apdf_audio_last',t.id)}catch{}
}
function step(offset){if(!state.tracks.length){open();return}select(state.current<0?0:state.current+offset)}
function highlightPlaying(){panel?.querySelectorAll('[data-apm-index]').forEach(x=>{const on=Number(x.dataset.apmIndex)===state.current;x.classList.toggle('current',on);x.setAttribute('aria-current',on?'true':'false')})}
function ui(){
 if(panel)return;
 panel=document.createElement('div');panel.id='apmOverlay';panel.className='apm-overlay';panel.hidden=true;
 panel.innerHTML='<section class="apm-sheet" role="dialog" aria-modal="true" aria-labelledby="apmHeading">'+
 '<header class="apm-header"><div><span class="apm-kicker">8aPDF · FOCUS SOUNDTRACK</span><h2 id="apmHeading">Music Studio <span>♫</span></h2><p>Real music audio, no video. Auto-next when a track finishes.</p></div><button type="button" id="apmDismiss" aria-label="Close library">×</button></header>'+
 '<div class="apm-searchline"><input id="apmFind" type="search" placeholder="Search music or artist…" aria-label="Search songs"><span id="apmCount">Loading library…</span></div>'+
 '<div id="apmGenres" class="apm-genres" aria-label="Music category filters"></div>'+
 '<div id="apmStatus" class="apm-status" role="status"></div><div id="apmTracks" class="apm-tracks"></div>'+
 '<footer class="apm-foot">Music provided through openly licensed Wikimedia Commons audio files. Track credits and license information are linked in the player. Availability may vary by browser. Popular copyrighted YouTube songs cannot be played through a hidden player.</footer></section>';
 document.body.append(panel);
 $('apmDismiss').onclick=close;panel.addEventListener('click',e=>{if(e.target===panel)close();const b=e.target.closest('[data-apm-index]');if(b){select(Number(b.dataset.apmIndex));}});
 $('apmFind').oninput=e=>{state.search=e.target.value.toLowerCase().trim();render()};
 $('apmGenres').onclick=e=>{const b=e.target.closest('[data-apm-genre]');if(b){state.filter=b.dataset.apmGenre;render()}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden)close()});
}
function render(){
 if(!panel)return;
 const genres=['All',...new Set(state.tracks.map(t=>t.genre))];
 $('apmGenres').innerHTML=genres.map(g=>'<button type="button" data-apm-genre="'+esc(g)+'" class="'+(state.filter===g?'selected':'')+'">'+esc(g)+'</button>').join('');
 const visible=state.tracks.map((t,i)=>({...t,index:i})).filter(t=>(state.filter==='All'||t.genre===state.filter)&&(!state.search||(t.title+' '+t.artist+' '+t.genre).toLowerCase().includes(state.search)));
 const limit=visible.slice(0,240);
 $('apmCount').textContent=state.tracks.length+' discovered tracks';
 $('apmTracks').innerHTML=limit.map(t=>'<button type="button" class="apm-track'+(state.current===t.index?' current':'')+'" data-apm-index="'+t.index+'" aria-current="'+(state.current===t.index)+'"><span class="apm-trackmark">♫</span><span class="apm-trackwords"><strong>'+esc(t.title)+'</strong><small>'+esc(t.genre)+' · '+esc(t.artist)+'</small></span><span class="apm-trackplay">▶</span></button>').join('')||'<p class="apm-empty">No matching tracks yet. Try another search or wait for more music to load.</p>';
 status(lastStatus);
}
function close(){if(!panel)return;panel.hidden=true;document.body.classList.remove('apm-open')}
function open(){setup();ui();panel.hidden=false;document.body.classList.add('apm-open');render();if(!state.loaded&&!state.loading)loadLibrary();$('apmFind').focus({preventScroll:true})}
function readableTitle(t){return String(t||'').replace(/^File:/,'').replace(/\.(?:ogg|oga|mp3|wav|opus|flac)$/i,'').replace(/_/g,' ').replace(/\s*\([^)]*\)\s*$/,'').trim().slice(0,115)}
function validTrack(p,genre){
 const file=p?.imageinfo?.[0];if(!file)return;
 const src=safeUrl(file.url),source=safeUrl(file.descriptionurl);
 if(!src||!source||!/\.(ogg|oga|mp3|wav)(?:$|\?)/i.test(src))return;
 if(!['audio/ogg','application/ogg','audio/mpeg','audio/mp3','audio/x-wav','audio/wav','audio/wave'].includes(file.mime))return;
 if(audio.canPlayType(file.mime)==='')return;
 const ext=file.extmetadata||{},license=String(ext.LicenseShortName?.value||'');
 if(!/^(?:CC0|CC BY(?:-SA)?\b|Public domain|PD\b)/i.test(license))return;
 const title=readableTitle(p.title);if(!title||state.seen.has(src))return;
 state.seen.add(src);
 state.tracks.push({id:String(p.pageid),title,artist:'Wikimedia Commons',genre,src,source,license});
}
async function fetchPage(genre,term,continuation){
 const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:term,gsrnamespace:'6',gsrlimit:'80',prop:'imageinfo',iiprop:'url|mime|extmetadata',format:'json',formatversion:'2',origin:'*'});
 if(continuation)params.set('gsrcontinue',continuation);
 controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000);
 try{const r=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:controller.signal,referrerPolicy:'strict-origin-when-cross-origin'});if(!r.ok)throw Error('Commons returned '+r.status);const d=await r.json();if(d.error)throw Error(d.error.info||d.error.code);(d.query?.pages||[]).forEach(p=>validTrack(p,genre));return d.continue?.gsrcontinue||null}finally{clearTimeout(timeout)}
}
async function loadLibrary(){
 if(state.loading)return;state.loading=true;status('Discovering Creative Commons music…');
 let failures=0;
 for(const [genre,term] of searchGroups){
  if(state.tracks.length>=240)break;
  try{let next=await fetchPage(genre,term);render();if(state.tracks.length<200&&next){await fetchPage(genre,term,next);render();}}catch(e){failures++;status('Some music searches could not load: '+e.message)}
 }
 state.loading=false;state.loaded=true;
 if(state.tracks.length)status(state.tracks.length+' real, openly licensed sources found. Tracks are checked for playback when selected.');
 else status('Music discovery is unavailable right now. Check internet access or try again.');
 render();
}
window.__8apdfMusic={open,close,getDiscoveredCount:()=>state.tracks.length};
})();
