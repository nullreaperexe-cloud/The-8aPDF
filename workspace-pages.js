/* Keep one app/music document alive while independent HTML tools change. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let layer=null,frames=new Map(),current='',previous='/',firstFocus=null;
const pageFor=path=>/^\/chat(?:\/|$)/.test(path)?'chat':path.startsWith('/pdf-explorer')?'pdf-explorer':path.startsWith('/school-calendar')?'school-calendar':'';
function build(){if(layer)return;layer=document.createElement('section');layer.id='workspacePage';layer.className='workspace-page';layer.hidden=true;layer.innerHTML='<header class="workspace-page-header"><button type="button" id="workspacePageBack">← Back to 8aPDF</button><strong id="workspacePageTitle"></strong><button type="button" id="workspacePageMusic">♫ Music</button></header><div id="workspacePageFrames"></div>';document.body.append(layer);$('workspacePageBack').onclick=()=>{if(history.state?.eightapdfTool)history.back();else openPage('/',true)};$('workspacePageMusic').onclick=()=>window.__8apdfMusic?.show();}
function activate(path){
 build();const kind=pageFor(path);current=kind;window.__8apdfPersistentPage=kind;
 frames.forEach((frame,key)=>{frame.hidden=key!==kind;frame.contentWindow?.postMessage({type:'8apdf:tool-visible',visible:key===kind},location.origin)});
 if(!kind){layer.hidden=true;document.body.classList.remove('tool-page-open');firstFocus?.focus?.({preventScroll:true});return;}
 firstFocus=document.activeElement;layer.hidden=false;document.body.classList.add('tool-page-open');
 const title=kind==='chat'?'Friends Chat':kind==='pdf-explorer'?'PDF Explorer':'School Calendar';$('workspacePageTitle').textContent=title;document.title=title+' · 8aPDF';
 let frame=frames.get(kind);
 const invite=new URL(path,location.origin).searchParams.get('invite');
 const room=path.match(/^\/chat\/([^/?]+)/)?.[1]||'general';
 if(!frame){frame=document.createElement('iframe');frame.title=title;frame.id='workspace-'+kind;frame.setAttribute('allow','autoplay; encrypted-media; clipboard-write');frame.src=kind==='chat'?'/chat-frame.html?embedded=1&room='+encodeURIComponent(room)+(invite?'&invite='+encodeURIComponent(invite):''):kind==='pdf-explorer'?'/pdf-explorer.html?embedded=1':'/school-calendar.html?embedded=1';frames.set(kind,frame);$('workspacePageFrames').append(frame);frame.onload=()=>{frame.contentWindow?.postMessage({type:'8apdf:tool-visible',visible:current===kind},location.origin);syncTheme();};}
 frame.hidden=false;if(kind==='chat')frame.contentWindow?.postMessage({type:'8apdf:open-chat-room',room,invite},location.origin);
 $('workspacePageBack').focus({preventScroll:true});syncTheme();
}
function syncTheme(){const root=document.documentElement,style=getComputedStyle(root),vars={};for(const key of ['--bg','--bg-alt','--surface','--surface-high','--surface-soft','--text','--text-soft','--muted','--line','--line-bold','--button','--button-text','--hover'])vars[key]=style.getPropertyValue(key);for(const frame of frames.values())frame.contentWindow?.postMessage({type:'8apdf:theme',vars,font:getComputedStyle(document.body).fontFamily,tone:root.dataset.tone},location.origin)}
function openPage(path,replace=false){const kind=pageFor(path);if(!kind&&path!=='/')return;previous=pageFor(location.pathname)?previous:location.pathname;if(path!==location.pathname||location.hash){const state={...history.state,eightapdfTool:!!kind,toolPrevious:previous};if(replace)history.replaceState(state,'',path);else history.pushState(state,'',path);}activate(path);if(!kind)window.__8apdfStudyBridge?.navigate?.('home')}
window.__8apdfOpenPage=openPage;
function init(){
 const group=document.querySelector('.studio-nav-secondary');
 for(const [id,label,path,icon] of [['pdfExplorerLink','PDF Explorer','/pdf-explorer','file'],['schoolCalendarLink','School Calendar','/school-calendar','calendar']]){const b=document.createElement('button');b.id=id;b.type='button';b.className='studio-side-link';b.innerHTML='<svg><use href="#i-'+icon+'"/></svg><span>'+label+'</span>';b.onclick=()=>openPage(path);group?.prepend(b);const more=document.createElement('button');more.type='button';more.textContent=label;more.onclick=()=>{$('studioMorePanel').hidden=true;openPage(path)};$('studioMorePanel')?.append(more)}
 document.addEventListener('click',e=>{const target=e.target.closest('a[href], [data-open-friends-chat], [data-open-pdf-explorer]');if(!target)return;const href=target.matches('[data-open-friends-chat]')?'/chat':target.matches('[data-open-pdf-explorer]')?'/pdf-explorer':target.getAttribute('href');if(!href)return;const url=new URL(href,location.href);if(url.origin!==location.origin||!pageFor(url.pathname)||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();$('studioMorePanel').hidden=true;openPage(url.pathname+url.search);},true);
 window.addEventListener('popstate',()=>activate(location.pathname));
 window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='8apdf:home')openPage('/');if(event.data?.type==='8apdf:chat-route'&&current==='chat'){history.replaceState({...history.state,eightapdfTool:true},'',event.data.path);window.__8apdfActiveChatRoom=event.data.roomId;}});
 new MutationObserver(syncTheme).observe(document.documentElement,{attributes:true,attributeFilter:['style','data-theme','data-tone']});
 activate(location.pathname);mountMusic();
}
function mountMusic(){
 if($('eightapdfMusicPlayerFrame'))return;
 const holder=document.createElement('aside');holder.className='persistent-music';holder.innerHTML='<button type="button" id="persistentMusicToggle" aria-expanded="false">♫ Music</button><div id="persistentMusicPanel" class="persistent-music-panel" aria-hidden="true"><button type="button" id="persistentMusicClose" aria-label="Close music controls">×</button><iframe id="eightapdfMusicPlayerFrame" title="Background Music - Elfsight" src="/music-player.html?v=20261013-autostart" allow="autoplay; encrypted-media" loading="eager"></iframe><small id="persistentMusicStatus">Music loads once and stays with your workspace.</small></div>';document.body.append(holder);
 const show=()=>{$('persistentMusicPanel').classList.add('open');$('persistentMusicPanel').setAttribute('aria-hidden','false');$('persistentMusicToggle').setAttribute('aria-expanded','true')};
 $('persistentMusicToggle').onclick=()=>{if($('persistentMusicPanel').classList.contains('open'))close();else show()};$('persistentMusicClose').onclick=close;
 function close(){$('persistentMusicPanel').classList.remove('open');$('persistentMusicPanel').setAttribute('aria-hidden','true');$('persistentMusicToggle').setAttribute('aria-expanded','false')}
 const start=()=>{try{$('eightapdfMusicPlayerFrame').contentWindow.__8apdfStartMusic?.()}catch{}};
 window.__8apdfMusic={show,start};$('eightapdfMusicPlayerFrame').addEventListener('load',start);document.addEventListener('pointerdown',start,{passive:true});document.addEventListener('keydown',start);
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('eightapdfMusicPlayerFrame').contentWindow)return;if(e.data?.type==='8apdf:music-state')$('persistentMusicStatus').textContent=e.data.playing?'Playing · continues across your pages':e.data.blocked?'Tap Play in the player to start music.':'Ready · autoplay starts when your browser allows it.'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
