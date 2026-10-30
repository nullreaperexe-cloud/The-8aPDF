(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],bridge=()=>window.__8apdfStudyBridge;
const K='8apdf_experience_hub_v1';
const defaults={showHub:false,autoBreak:false,sound:true,shortcuts:true,focusMinutes:25,goalMinutes:60};
const get=(key,fall)=>{try{const v=localStorage.getItem(key);return v===null?fall:JSON.parse(v)}catch{return fall}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const config={...defaults,...get(K,{})};
const records=Array.isArray(get('8apdf_completed_sessions_v1',[]))?get('8apdf_completed_sessions_v1',[]):[];
const modes={work:'Focus',short:'Short Break',long:'Long Break'};
let mode='work',remaining=config.focusMinutes*60,running=false,deadline=0,ticker=0;
const timerStored=get('8apdf_focus_timer_v1',null);
if(timerStored&&modes[timerStored.mode]){
 mode=timerStored.mode;running=!!timerStored.running;
 remaining=running?Math.max(0,Math.ceil((Number(timerStored.deadline)-Date.now())/1000)):Math.max(0,Number(timerStored.remaining)||0);
 deadline=Number(timerStored.deadline)||0;
}
let soundContext=null;
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const todayMinutes=()=>records.filter(r=>r.date===todayKey()&&r.mode==='work').reduce((sum,r)=>sum+Number(r.minutes||0),0);
const todaySessions=()=>records.filter(r=>r.date===todayKey()&&r.mode==='work').length;
function streak(){const dates=new Set(records.filter(r=>r.mode==='work').map(r=>r.date));let d=new Date(),count=0;
 if(!dates.has(todayKey()))d.setDate(d.getDate()-1);
 for(let i=0;i<366;i++){const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(!dates.has(key))break;count++;d.setDate(d.getDate()-1)}return count;
}
const mmss=secs=>`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(Math.floor(secs%60)).padStart(2,'0')}`;
const duration=()=>mode==='work'?config.focusMinutes*60:mode==='short'?5*60:15*60;
function persistTimer(){save('8apdf_focus_timer_v1',{mode,remaining,running,deadline})}
function ping(){if(!config.sound)return;try{soundContext=soundContext||new (window.AudioContext||window.webkitAudioContext)();soundContext.resume?.();const o=soundContext.createOscillator(),g=soundContext.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.0001,soundContext.currentTime);g.gain.exponentialRampToValueAtTime(.06,soundContext.currentTime+.04);g.gain.exponentialRampToValueAtTime(.0001,soundContext.currentTime+.37);o.connect(g);g.connect(soundContext.destination);o.start();o.stop(soundContext.currentTime+.38)}catch{}}
function completed(){running=false;remaining=0;
 if(mode==='work'){
  records.push({date:todayKey(),minutes:config.focusMinutes,mode:'work',completedAt:new Date().toISOString()});if(records.length>500)records.splice(0,records.length-500);save('8apdf_completed_sessions_v1',records);
  if(config.autoBreak){mode=todaySessions()%4===0?'long':'short';remaining=duration();}else remaining=duration();
 }else{mode='work';remaining=duration()}
 ping();persistTimer();refresh();showMessage('Session complete! Your study progress has been saved.');
}
function refresh(){if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(remaining===0)completed()}
 $('#focusClock').textContent=mmss(remaining);$('#expTimerLabel').textContent=mmss(remaining);
 const status=running?'Session in progress':mode==='work'?'Ready for deep work':'Take a mindful break';
 $('#focusStatus').textContent=status;$('#expTimerCaption').textContent=running?`${modes[mode]} · in progress`:status;
 $('#focusToggle').textContent=running?'Pause':'Start '+modes[mode];
 $('#quickFocusStart').textContent=running?'Continue timer ↗':'Start focusing ↗';
 $('#focusSessionCount').textContent=`${todaySessions()} session${todaySessions()===1?'':'s'} today`;
 const used=todayMinutes();$('#expGoalLabel').textContent=`${used} / ${config.goalMinutes}m`;
 $('#expGoalFill').style.width=`${Math.min(100,Math.round(used/config.goalMinutes*100))}%`;
 $('#expGoalCaption').textContent=used>=config.goalMinutes?'Daily goal reached ✨':`${Math.max(0,config.goalMinutes-used)} minutes until your goal`;
 const run=streak();$('#expStreakLabel').textContent=`${run} day${run===1?'':'s'}`;
 $('#expStreakCaption').textContent=run?'Keep your momentum going.':'Complete a focus session to begin.';
 $('#focusGoalInfo').textContent=`Goal: ${config.goalMinutes} minutes`;
 $$('[data-focus-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.focusMode===mode));
 document.title=running?`${mmss(remaining)} · Focus · 8aPDF`:'8aPDF | Study Material Vault';
}
function timerTick(){if(running){refresh();persistTimer()}}
function setMode(next){if(!modes[next])return;mode=next;running=false;remaining=duration();persistTimer();refresh()}
function toggleTimer(){if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));running=false}
 else{if(remaining<=0)remaining=duration();running=true;deadline=Date.now()+remaining*1000;if(config.sound){try{soundContext=soundContext||new (window.AudioContext||window.webkitAudioContext)();soundContext.resume?.()}catch{}}}
 persistTimer();refresh();
}
function openFocus(){const o=$('#focusOverlay');o.classList.add('open');o.setAttribute('aria-hidden','false');$('#closeFocusStudio').focus();refresh()}
function closeFocus(){const o=$('#focusOverlay');o.classList.remove('open');o.setAttribute('aria-hidden','true')}
function showMessage(m){const n=document.createElement('div');n.textContent=m;n.style.cssText='position:fixed;bottom:18px;right:18px;z-index:9999;padding:12px 16px;border-radius:12px;background:var(--button);color:var(--button-text);font-weight:700;box-shadow:0 10px 30px #0007';document.body.append(n);setTimeout(()=>n.remove(),3500)}
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function docs(){return bridge()?.documents()||[]}
function renderLibraryExtras(){const all=docs();const index=new Map(all.map(x=>[x.id,x]));const recent=(bridge()?.recents()||[]).map(id=>index.get(id)).filter(Boolean)[0];
 $('#expRecentLabel').textContent=recent?.title||'No PDFs opened yet';$('#expRecentCaption').textContent=recent?recent.subject:'Your most recent reading';$('#expRecentOpen').disabled=!recent;
 const subjects=new Set(all.map(x=>x.subject).filter(Boolean));$('#expSubjectLabel').textContent=subjects.size?String(subjects.size):'—';
}
let selectedRandomId='';
function pickRevision(){const all=docs();if(!all.length){showMessage('School PDF library is still connecting.');return}const options=all.filter(x=>x.id!==selectedRandomId);const pool=options.length?options:all;const pick=pool[Math.floor(Math.random()*pool.length)];selectedRandomId=pick.id;$('#expRandomLabel').textContent=pick.title;$('#expRandomCaption').textContent=pick.subject+' · Click to preview';$('#expRandomPick').textContent='Open revision PDF ↗';}
function subjectBreakdown(){const counts={};for(const x of docs())counts[x.subject]=(counts[x.subject]||0)+1;const keys=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);if(!keys.length){showMessage('PDFs are still loading.');return}
 showSimpleDialog('Explore Subjects',keys.map(k=>`<button class="experience-outline" data-exp-subject="${safe(k)}" style="display:flex;justify-content:space-between;align-items:center;text-align:left;width:100%;margin:7px 0"><span>${safe(k)}</span><strong>${counts[k]} PDFs →</strong></button>`).join(''));
}
function showSimpleDialog(title,html){const overlay=$('#focusOverlay');openFocus();$('#focusHistoryContent')?.remove();let b=document.createElement('div');b.id='focusHistoryContent';b.innerHTML=`<h3 style="margin:22px 0 10px;font-size:1.15rem">${safe(title)}</h3>`+html+'<button class="experience-outline" id="expCloseDetails" type="button" style="width:100%;margin-top:12px">Back to timer</button>';$('#focusOverlay .experience-dialog').append(b);$('#focusOverlay .focus-modes').style.display='none';$('#focusOverlay .focus-time-ring').style.display='none';$('#focusOverlay .focus-actions').style.display='none';$('#focusOverlay .focus-info').style.display='none';$('#focusOverlay .focus-tools').style.display='none';$('#expCloseDetails').onclick=restoreFocus;}
function restoreFocus(){document.querySelector('#focusHistoryContent')?.remove();for(const x of $$('#focusOverlay .focus-modes,#focusOverlay .focus-time-ring,#focusOverlay .focus-actions,#focusOverlay .focus-info,#focusOverlay .focus-tools'))x.style.display='';refresh()}
function historyView(){const keys=[...new Set(records.map(r=>r.date))].sort().reverse().slice(0,28);const list=keys.length?keys.map(d=>{const a=records.filter(r=>r.date===d&&r.mode==='work');const total=a.reduce((s,r)=>s+Number(r.minutes||0),0);return `<div style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line)"><span>${safe(d)}</span><strong>${total} min · ${a.length} sessions</strong></div>`}).join(''):'<p style="color:var(--muted)">Finish a focus session to start your real study history.</p>';
 showSimpleDialog('Study History',`<p style="color:var(--muted);font-size:.8rem">Completed focus sessions only · stored privately on this browser.</p>`+list);
}
function shortcutsView(){showSimpleDialog('Keyboard Shortcuts','<p style="color:var(--muted)">Ctrl/⌘ + K — Search PDFs</p><p>F — Open Focus Studio</p><p>G — Jump to Study Hub</p><p>R — Random revision PDF</p><p>? — View these shortcuts</p><p>Esc — Close a panel</p>')}
function exportActivity(){const content={exportedAt:new Date().toISOString(),sessions:records,preferences:config,recentPdfIds:bridge()?.recents()||[],bookmarkedPdfIds:bridge()?.bookmarks()||[]};const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='8apdf-study-activity.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function connectSettings(){const map={experienceShowHub:'showHub',experienceAutoBreak:'autoBreak',experienceSound:'sound',experienceShortcuts:'shortcuts'};
 for(const [id,k] of Object.entries(map)){const el=$('#'+id);el.checked=!!config[k];el.addEventListener('change',()=>{config[k]=el.checked;settingsChanged()})}
 $('#experienceFocusDuration').value=config.focusMinutes;$('#experienceGoalDuration').value=config.goalMinutes;$('#experienceFocusDurationValue').textContent=config.focusMinutes+' min';$('#experienceGoalDurationValue').textContent=config.goalMinutes+' min';
 $('#experienceFocusDuration').addEventListener('input',e=>{config.focusMinutes=Number(e.target.value);if(mode==='work'&&!running){remaining=config.focusMinutes*60;persistTimer()}settingsChanged()});
 $('#experienceGoalDuration').addEventListener('input',e=>{config.goalMinutes=Number(e.target.value);settingsChanged()});
 $('#experienceExport').onclick=exportActivity;
 $('#experienceClear').onclick=()=>{if(!confirm('Clear your completed Focus Studio session history? This cannot be undone.'))return;records.splice(0);save('8apdf_completed_sessions_v1',records);refresh();showMessage('Study session history cleared. Bookmarks are preserved.')};
}
function settingsChanged(){save(K,config);$('#experienceHub').hidden=!config.showHub;$('#experienceFocusDurationValue').textContent=config.focusMinutes+' min';$('#experienceGoalDurationValue').textContent=config.goalMinutes+' min';refresh()}
function setup(){connectSettings();settingsChanged();renderLibraryExtras();refresh();
 $('#openFocusStudio').onclick=openFocus;$('#quickFocusStart').onclick=openFocus;$('#closeFocusStudio').onclick=()=>{restoreFocus();closeFocus()};$('#focusOverlay').addEventListener('click',e=>{if(e.target===$('#focusOverlay')){restoreFocus();closeFocus()}const b=e.target.closest('[data-exp-subject]');if(b){restoreFocus();closeFocus();bridge()?.subject(b.dataset.expSubject)}});
 $('#focusToggle').onclick=toggleTimer;$('#focusReset').onclick=()=>setMode(mode);$('#focusSkip').onclick=()=>setMode(mode==='work'?'short':'work');$$('[data-focus-mode]').forEach(el=>el.onclick=()=>setMode(el.dataset.focusMode));
 $('#focusHistory').onclick=historyView;$('#studyHistoryButton').onclick=historyView;$('#focusHelp').onclick=shortcutsView;$('#focusFullscreen').onclick=()=>{const el=$('#focusOverlay .experience-dialog');if(document.fullscreenElement)document.exitFullscreen?.();else el.requestFullscreen?.().catch(()=>showMessage('Fullscreen not supported by this browser'))};
 $('#expSubjectsOpen').onclick=subjectBreakdown;$('#expRandomPick').onclick=()=>{if(!selectedRandomId){pickRevision()}else{bridge()?.openDocument(selectedRandomId);selectedRandomId='';$('#expRandomPick').textContent='Surprise me ↗'}};
 $('#expRecentOpen').onclick=()=>{const id=(bridge()?.recents()||[])[0];if(id)bridge()?.openDocument(id)};
 document.addEventListener('8apdf:library-updated',renderLibraryExtras);document.addEventListener('8apdf:document-opened',renderLibraryExtras);
 document.addEventListener('click',e=>{if(e.target.closest('[data-bookmark]'))requestAnimationFrame(renderLibraryExtras)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#focusOverlay').classList.contains('open')){restoreFocus();closeFocus();return}if(!config.shortcuts||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable]'))return;
 const k=e.key.toLowerCase();if(k==='f'){e.preventDefault();openFocus()}if(k==='g'){e.preventDefault();$('#experienceHub').scrollIntoView({behavior:'smooth',block:'center'})}if(k==='r'){e.preventDefault();pickRevision();$('#experienceHub').scrollIntoView({behavior:'smooth'})}if(e.key==='?'){e.preventDefault();shortcutsView()}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.addEventListener('beforeunload',persistTimer);
 ticker=setInterval(timerTick,1000); if(running)refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
