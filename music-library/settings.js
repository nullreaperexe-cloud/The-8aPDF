import {readUI,saveUI,clearUI} from './preferences.js';
export function mountSettings({notify,setBackground,clearBackground}){
 const api=()=>window.__8apdfDriveMusic;
 const shell=document.getElementById('dmWorkspace');
 if(!shell||document.getElementById('mlSettings'))return;
 const section=document.createElement('section');section.id='mlSettings';section.className='ml-settings';section.hidden=true;
 section.setAttribute('aria-label','Music library settings');
 section.innerHTML=`
 <header><div><h2>Music Settings</h2><p>Personalize playback, layout and your background soundtrack.</p></div><button id="mlSettingsBack" type="button">← Back to music</button></header>
 <div class="ml-settings-body">
 <fieldset><legend>Playback</legend>
 <label><span>Shuffle songs<small>Play songs in random order.</small></span><input id="mlShuffle" type="checkbox"></label>
 <label><span>Repeat mode<small>Choose continuous playback or a single song.</small></span><select id="mlRepeat"><option value="all">Repeat all</option><option value="one">Repeat one</option><option value="off">Off</option></select></label>
 <label><span>Music volume<small>Separate volume for the Drive library player.</small></span><input id="mlVol" type="range" min="0" max="100" value="45"></label>
 </fieldset>
 <fieldset><legend>Appearance</legend>
 <label><span>Compact song rows<small>Fit more songs on smaller displays.</small></span><input id="mlCompact" type="checkbox"></label>
 <label><span>Show Up Next panel<small>On smaller screens the queue automatically collapses.</small></span><input id="mlShowQueue" type="checkbox"></label>
 <p class="ml-muted">Music inherits 8aPDF's exact theme, accent and Space Grotesk font. Change the website theme in its main settings to change this page too.</p>
 </fieldset>
 <fieldset><legend>Low-end phone optimization</legend>
 <label><span>Data-saver mode<small>Load metadata only until a song is played; optimized for mobile connections.</small></span><input id="mlLowData" type="checkbox"></label>
 <p class="ml-muted">The UI loads on demand and shows 48 songs at once to avoid rendering the whole collection. Your existing website Ultra Low Mode remains supported.</p>
 </fieldset>
 <fieldset><legend>Background music</legend>
 <p class="ml-muted">Set any Google Drive song as your permanent device-local background track. It repeats when 8aPDF opens (subject to music consent and browser autoplay permission).</p>
 <p id="mlBackgroundInfo" class="ml-muted">No Drive background song selected.</p>
 <div class="ml-settings-actions"><button type="button" id="mlSetCurrent" class="ml-secondary">Set current song as background</button><button type="button" id="mlResetBg">Use original background playlist</button></div>
 </fieldset>
 <fieldset><legend>Privacy & storage</legend><p class="ml-muted">Likes, queue order, song selection and layout preferences are saved only in this browser. MP3 audio stays in Google Drive.</p>
 <button id="mlResetPrefs" type="button">Reset music layout preferences</button>
 </fieldset></div>`;
 shell.append(section);
 const $=id=>document.getElementById(id),save=(key,value)=>{const s=readUI();s[key]=value;saveUI(s)};
 function refresh(){
  const state=api()?.getState?.()||{},p=readUI();
  $('mlShuffle').checked=!!state.shuffle;$('mlRepeat').value=state.repeat||'all';$('mlVol').value=String(state.volume??45);
  $('mlCompact').checked=p.compact;$('mlShowQueue').checked=p.queue;$('mlLowData').checked=p.lowData;
  const current=window.__8apdfBackgroundAudio?.getState?.()?.customTrack;
  $('mlBackgroundInfo').textContent=current?'Saved background: '+current.title:'Background: original 8aPDF playlist';
 }
 function hide(){section.hidden=true;$('dmSettings')?.focus({preventScroll:true})}
 function show(){refresh();section.hidden=false;$('mlSettingsBack')?.focus({preventScroll:true})}
 $('dmSettings')?.addEventListener('click',show);
 $('dmSideSettings')?.addEventListener('click',show);
 $('mlSettingsBack').addEventListener('click',hide);
 $('mlShuffle').addEventListener('change',e=>api()?.setShuffle(e.target.checked));
 $('mlRepeat').addEventListener('change',e=>api()?.setRepeat(e.target.value));
 $('mlVol').addEventListener('input',e=>api()?.setVolume(e.target.value));
 $('mlCompact').addEventListener('change',e=>{save('compact',e.target.checked);api()?.setCompact(e.target.checked)});
 $('mlShowQueue').addEventListener('change',e=>{save('queue',e.target.checked);api()?.setQueueVisible(e.target.checked)});
 $('mlLowData').addEventListener('change',e=>{save('lowData',e.target.checked);if(api()?.getAudio())api().getAudio().preload=e.target.checked?'metadata':'auto'});
 $('mlSetCurrent').addEventListener('click',()=>{const t=api()?.getCurrent?.();if(!t){notify('Play or select a song first.');return}setBackground(t);refresh()});
 $('mlResetBg').addEventListener('click',()=>{clearBackground();refresh()});
 $('mlResetPrefs').addEventListener('click',()=>{clearUI();api()?.setCompact(false);api()?.setQueueVisible(true);refresh();notify('Music layout preferences reset.')});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!section.hidden){e.stopImmediatePropagation();hide()}},true);
 const p=readUI();api()?.setCompact(p.compact);api()?.setQueueVisible(p.queue);
 if(api()?.getAudio())api().getAudio().preload=p.lowData?'metadata':'auto';
}
