import {readUI} from './preferences.js';
import {downloadTrack} from './downloads.js';
import {mountSettings} from './settings.js';
let ready=false;
function notify(message){
 let t=document.getElementById('mlToast');
 if(!t){t=document.createElement('div');t.id='mlToast';t.className='ml-toast';t.setAttribute('role','status');document.body.append(t)}
 t.textContent=message;t.hidden=false;
 clearTimeout(notify.timer);notify.timer=setTimeout(()=>{t.hidden=true},3300);
}
function setBackground(track){
 const bg=window.__8apdfBackgroundAudio;
 if(!bg?.setDriveTrack){notify('Background player is not ready. Try refreshing the page.');return}
 const applied=bg.setDriveTrack({id:track.id,title:track.title});
 if(applied){window.__8apdfDriveMusic?.pause?.();notify('Saved as device background music: '+track.title)}
 else notify('Could not save this track.');
}
function clearBackground(){window.__8apdfBackgroundAudio?.clearDriveTrack?.();notify('Original background playlist restored.')}
function menu(){
 let m=document.getElementById('mlSongMenu');
 if(!m){m=document.createElement('div');m.id='mlSongMenu';m.className='ml-menu';m.hidden=true;m.setAttribute('role','menu');document.body.append(m)}
 return m;
}
export function attach(){
 if(ready)return;ready=true;
 const api=window.__8apdfDriveMusic;
 if(!api)return;
 const p=readUI();api.setCompact?.(p.compact);api.setQueueVisible?.(p.queue);
 mountSettings({notify,setBackground,clearBackground});
 const m=menu();
 let currentId=null,lastTrigger=null;
 function dismiss(){m.hidden=true;currentId=null;lastTrigger?.setAttribute('aria-expanded','false')}
 document.addEventListener('8apdf:music-menu',event=>{
  const track=api.getTracks?.().find(t=>t.id===event.detail?.id);
  if(!track)return;
  if(currentId===track.id&&!m.hidden){dismiss();return}
  currentId=track.id;lastTrigger=event.detail?.anchor||null;
  const currentBg=window.__8apdfBackgroundAudio?.getState?.()?.customTrack;
  m.replaceChildren();
  const heading=document.createElement('small');heading.textContent=track.title;m.append(heading);
  for(const [symbol,label,handler] of [
   ['♫','Set as background music',()=>setBackground(track)],
   ['↓','Download MP3',()=>{try{downloadTrack(track);notify('Starting download…')}catch{notify('Cannot download this song.')}}],
   ['⟳','Refresh music library',()=>api.reload?.()]
  ]){
   const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=symbol+'  '+label;
   b.addEventListener('click',()=>{dismiss();handler()});m.append(b);
  }
  if(currentBg?.id===track.id){const hint=document.createElement('small');hint.textContent='✓ Current background song';m.append(hint)}
  m.hidden=false;lastTrigger?.setAttribute('aria-expanded','true');
  const rect=lastTrigger?.getBoundingClientRect?.()||{left:20,bottom:20,top:20};
  const width=250;
  m.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left-width+24))+'px';
  m.style.top=Math.max(8,Math.min(window.innerHeight-180,rect.bottom+5))+'px';
  m.querySelector('button')?.focus({preventScroll:true});
 });
 document.addEventListener('pointerdown',e=>{if(!m.hidden&&!m.contains(e.target)&&e.target!==lastTrigger)dismiss()},{capture:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.hidden){dismiss();lastTrigger?.focus({preventScroll:true})}},true);
 document.getElementById('dmMinimize')?.addEventListener('click',dismiss);
}
