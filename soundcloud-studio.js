/* 8aPDF SoundCloud Studio — official, audio-only widget. No audio extraction. */
(()=>{'use strict';
const SOURCE={title:'Tum Hi Ho Meri Ashiqui Ashiqui 2 (2013)',artist:'Radhi14891',url:'https://soundcloud.com/radhi14891/tum-hi-ho-meri-ashiqui-ashiqui',source:'featured'};
const KEY='8apdf_soundcloud_saved_v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=ms=>{const n=Math.max(0,Math.floor((Number(ms)||0)/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
function validUrl(raw){
 try{const u=new URL(raw.trim());const domain=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||!['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(domain))return null;
  const parts=u.pathname.split('/').filter(Boolean);
  if(parts.length<2||['discover','search','you','stream','upload','settings'].includes(parts[0]))return null;
  return 'https://soundcloud.com/'+parts.map(encodeURIComponent).join('/');
 }catch{return null}
}
function readSaved(){
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&validUrl(x.url)).slice(0,150):[]}catch{return[]}
}
let saved=readSaved();
const songs=()=>[SOURCE,...saved];
let overlay=null,dock=null,iframe=null,widget=null,ready=false,scriptLoading=null,current=0,pending=null,playing=false,position=0,duration=0,previousFocus=null;
let status='Choose a track. Your SoundCloud widget will play audio without a video.';
const embedUrl='https://w.soundcloud.com/player/?'+new URLSearchParams({
 url:'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A85728261',
 color:'#ff5500',auto_play:'false',hide_related:'false',show_comments:'false',show_user:'true',show_reposts:'false',show_teaser:'true',show_artwork:'false'
});
function makeUI(){
 if(dock)return;
 overlay=document.createElement('div');overlay.id='scmOverlay';overlay.className='scm-overlay';overlay.hidden=true;
 overlay.innerHTML='<section class="scm-sheet" role="dialog" aria-modal="true" aria-labelledby="scmHeading">'+
 '<header class="scm-top"><div><span class="scm-eyebrow">8aPDF · AUDIO STUDIO</span><h2 id="scmHeading">Your music, no video. <span>♪</span></h2><p>Real SoundCloud embeds · no Spotify Premium required.</p></div><button type="button" id="scmDismiss" aria-label="Close music library">×</button></header>'+
 '<div class="scm-tabs"><span class="scm-tab active">SoundCloud</span><span class="scm-tab muted">Audio-only</span></div>'+
 '<div class="scm-list" id="scmSongs"></div>'+
 '<form id="scmAddForm" class="scm-form"><label for="scmLink">Add a SoundCloud song</label><div class="scm-add-row"><input id="scmLink" type="url" placeholder="https://soundcloud.com/artist/song" required autocomplete="off"><button type="submit">+ Add</button></div><small>Paste a public track link, not the iframe code. Added songs are saved only in this browser.</small></form>'+
 '<p id="scmMessage" class="scm-message" role="status"></p>'+
 '<footer class="scm-disclaimer">Artist/uploader credit stays visible in SoundCloud’s player. Availability depends on the uploader and SoundCloud restrictions; some tracks provide previews only.</footer></section>';
 dock=document.createElement('section');dock.className='scm-dock';dock.id='scmDock';dock.hidden=true;dock.setAttribute('aria-label','SoundCloud audio player');
 dock.innerHTML='<div class="scm-dock-head"><div class="scm-eq" id="scmEq" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="scm-now"><strong id="scmNowTitle"></strong><small id="scmNowArtist"></small></div><button id="scmExpand" aria-label="Open SoundCloud library" title="Music library" type="button">☷</button><button id="scmStop" aria-label="Stop music and close player" title="Stop music" type="button">×</button></div>'+
 '<div class="scm-widget"><iframe id="scmOfficialWidget" title="Official SoundCloud audio player" width="100%" height="166" scrolling="no" frameborder="0" allow="autoplay; encrypted-media" loading="eager"></iframe></div>'+
 '<div class="scm-controls"><button id="scmPrev" aria-label="Previous song" type="button">⏮</button><button id="scmPlay" class="scm-main" aria-label="Play song" type="button">▶</button><button id="scmNext" aria-label="Next song" type="button">⏭</button><span id="scmTime">0:00 / 0:00</span></div>';
 document.body.append(overlay,dock);iframe=$('scmOfficialWidget');iframe.src=embedUrl;
 $('scmDismiss').onclick=close;$('scmExpand').onclick=open;
 $('scmStop').onclick=()=>{try{widget?.pause()}catch{};playing=false;dock.hidden=true;document.body.classList.remove('scm-playing');sync()};
 $('scmPlay').onclick=()=>{if(!widget||!ready){pending=current;ensureScript();message('Loading SoundCloud player…');return}if(playing)widget.pause();else widget.play()};
 $('scmPrev').onclick=()=>jump(-1);$('scmNext').onclick=()=>jump(1);
 $('scmSongs').onclick=e=>{const b=e.target.closest('[data-scm-index]');if(b){choose(Number(b.dataset.scmIndex));return}const del=e.target.closest('[data-scm-remove]');if(del){removeTrack(Number(del.dataset.scmRemove))}};
 overlay.onclick=e=>{if(e.target===overlay)close()};
 $('scmAddForm').onsubmit=e=>{e.preventDefault();addTrack($('scmLink').value)};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay&&!overlay.hidden)close()});
 paint();sync();
 ensureScript();
}
function message(msg){status=msg;if($('scmMessage'))$('scmMessage').textContent=msg}
function paint(){
 if(!overlay)return;
 const arr=songs();
 $('scmSongs').innerHTML=arr.map((x,i)=>'<div class="scm-song '+(i===current&&!dock.hidden?'selected':'')+'"><button type="button" class="scm-song-play" data-scm-index="'+i+'"><span class="scm-song-note">♫</span><span class="scm-song-details"><strong>'+esc(x.title)+'</strong><small>'+esc(x.artist||'SoundCloud upload')+'</small></span><span class="scm-song-arrow">▶</span></button>'+(i>0?'<button class="scm-song-delete" type="button" data-scm-remove="'+i+'" aria-label="Remove '+esc(x.title)+'">×</button>':'<span class="scm-original">Featured</span>')+'</div>').join('');
 message(status);
}
function sync(){
 if(!dock)return;
 const x=songs()[current]||SOURCE;
 $('scmNowTitle').textContent=x.title;$('scmNowArtist').textContent=x.artist||'SoundCloud upload';
 $('scmPlay').textContent=playing?'Ⅱ':'▶';$('scmPlay').setAttribute('aria-label',playing?'Pause song':'Play song');
 $('scmEq').classList.toggle('active',playing);
 $('scmTime').textContent=fmt(position)+' / '+fmt(duration);
 $('scmPrev').disabled=songs().length<2;$('scmNext').disabled=songs().length<2;
}
function ensureScript(){
 if(window.SC?.Widget){initWidget();return Promise.resolve()}
 if(scriptLoading)return scriptLoading;
 scriptLoading=new Promise((resolve,reject)=>{
  const sc=document.createElement('script');sc.src='https://w.soundcloud.com/player/api.js';sc.async=true;
  sc.onload=()=>{initWidget();resolve()};sc.onerror=()=>{scriptLoading=null;message('SoundCloud controls could not load. Use the play button on the official audio widget.');reject(Error('SoundCloud Widget API unavailable'))};
  document.head.append(sc)
 });scriptLoading.catch(()=>{});return scriptLoading;
}
function initWidget(){
 if(widget||!window.SC?.Widget||!iframe)return;
 widget=SC.Widget(iframe);
 const E=SC.Widget.Events;
 widget.bind(E.READY,()=>{
  ready=true;
  widget.setVolume(80);
  if(pending!==null){const i=pending;pending=null;choose(i)}
  else message('SoundCloud audio player ready. Tap ▶ to listen.');
 });
 widget.bind(E.PLAY,()=>{playing=true;dock.hidden=false;document.body.classList.add('scm-playing');sync()});
 widget.bind(E.PAUSE,()=>{playing=false;sync()});
 widget.bind(E.FINISH,()=>{playing=false;sync();if(songs().length>1)jump(1,true);else message('Song finished. Add another SoundCloud link to enable auto-next.')});
 widget.bind(E.PLAY_PROGRESS,e=>{position=e.currentPosition||0;widget.getDuration(ms=>{duration=ms||0;sync()})});
 widget.bind(E.ERROR,()=>{playing=false;sync();message('This uploader/track cannot be played here. Please check the SoundCloud embed.')});
}
function choose(i){
 if(!Number.isInteger(i)||i<0||i>=songs().length)return;
 makeUI();
 const x=songs()[i];const changed=current!==i;
 current=i;position=0;duration=0;
 dock.hidden=false;document.body.classList.add('scm-playing');sync();paint();
 if(!ready||!widget){pending=i;message('Loading official SoundCloud player…');ensureScript();return}
 if(changed){
  playing=false;sync();
  widget.load(x.url,{auto_play:true,show_artwork:false,show_comments:false,show_user:true,callback:()=>{message('Selected: '+x.title+'. Tap play if your browser blocks autoplay.')}});
 }else{
  widget.play();message('Playing '+x.title+'…');
 }
}
function jump(dir,automatic=false){
 if(songs().length<2)return;
 const idx=(current+dir+songs().length)%songs().length;
 choose(idx);
 if(automatic)message('Next SoundCloud song: '+songs()[idx].title);
}
function addTrack(raw){
 const url=validUrl(raw);
 if(!url){message('Please paste a public SoundCloud track link like https://soundcloud.com/artist/song');return}
 if(songs().some(x=>x.url.toLowerCase()===url.toLowerCase())){message('This song is already in your library.');return}
 if(saved.length>=150){message('This browser has reached the 150 saved-track limit.');return}
 const slug=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop()).replace(/[-_]+/g,' ');
 const x={title:slug.replace(/\b\w/g,m=>m.toUpperCase()),artist:'SoundCloud upload',url};
 saved.push(x);try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{message('Song added for this session, but browser storage is unavailable.')}
 $('scmLink').value='';paint();message('Song added on this device. Tap it to play using SoundCloud.');
 // Friendly metadata improves display, but lack of oEmbed should not block playback.
 fetch('https://soundcloud.com/oembed?format=json&url='+encodeURIComponent(url),{mode:'cors'})
 .then(r=>r.ok?r.json():null).then(data=>{if(!data||!saved.includes(x))return;if(data.title&&typeof data.title==='string'){x.title=data.title.slice(0,125);try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{};paint();sync()}}).catch(()=>{});
}
function removeTrack(index){
 const i=index-1;if(i<0||i>=saved.length)return;
 if(index===current){try{widget?.pause()}catch{};current=0;playing=false;sync()}
 else if(index<current)current--;
 saved.splice(i,1);try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{};paint();sync();
 message('Saved track removed.');
}
function open(){
 makeUI();
 // Stop the separate YouTube player if it was active: avoid two streams.
 try{window.__8apdfMusic?.close?.()}catch{}
 previousFocus=document.activeElement;
 overlay.hidden=false;document.body.classList.add('scm-open');
 paint();$('scmDismiss').focus({preventScroll:true});
}
function close(){
 if(!overlay||overlay.hidden)return;
 overlay.hidden=true;document.body.classList.remove('scm-open');
 // IMPORTANT: official SoundCloud iframe stays in the same visible dock.
 // Closing only the song library must not pause or remount playback.
 if(previousFocus&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});
}
window.__8apdfSoundCloud={open,close,featuredTrack:SOURCE.url,trackCount:()=>songs().length};
})();
