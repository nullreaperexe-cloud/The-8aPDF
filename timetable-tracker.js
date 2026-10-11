/* 8aPDF timetable upgrades only. Existing theme/header/layout stay unchanged. */
(()=>{'use strict';
const KEY='8apdf_subject_marks_v1';
const $=s=>document.querySelector(s);
const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const subjects=['Science','Hindi','English','Games','Maths','SSP','Social Science','Computer','Punjabi','Drawing'];
const abbr={'Science':'Sci','Hindi':'Hindi','English':'Eng','Games':'Games','Maths':'Math','SSP':'SSP','Social Science':'S.St','Computer':'Comp','Punjabi':'Punj','Drawing':'Art'};
const base=s=>String(s||'').replace(/\s*\([^)]*\)/g,'').trim();
const record=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'?x:{}}catch{return {}}};
let marks=record(),zoomDay=0,zoomFont=0,selected=null;
let days=[];
const status=n=>marks[n]||'none';
const setStatus=(name,next)=>{if(!subjects.includes(name))return;marks[name]=next;try{localStorage.setItem(KEY,JSON.stringify(marks))}catch{};render()};
function fetchDays(){const value=window.__8apdfStudyBridge?.timetable?.();days=Array.isArray(value)?value.map(v=>Array.isArray(v.periods)?v.periods:[]):[];return days.length===6&&days.every(d=>d.length===9)}
function control(){
 const container=$('#modalContent'),existing=container?.querySelector('.timetable-scroll');
 if(!existing||!fetchDays())return;
 if($('#ttEnhancement'))return;
 const box=document.createElement('div');box.id='ttEnhancement';box.className='tt-enhancement';
 box.innerHTML='<div class="tt-tools"><div class="tt-tools-left"><button type="button" id="ttZoomOpen" aria-label="Enlarge timetable">⤢ Zoom</button><button type="button" id="ttTextMinus" aria-label="Reduce timetable font">A−</button><button type="button" id="ttTextPlus" aria-label="Increase timetable font">A+</button><button type="button" id="ttTextFit">Fit</button></div><span class="tt-mark-caption" id="ttStatusSummary">Tap subject to mark</span></div>'+
  '<details class="tt-tracker" id="ttTracker"><summary>Subject marks <span id="ttProgress">0/10 green</span></summary><div class="tt-subject-grid" id="ttSubjects"></div><div class="tt-bulk"><button type="button" data-tt-bulk="green">✓ Mark all green</button><button type="button" data-tt-bulk="red">× Mark all red</button><button type="button" data-tt-bulk="none">↺ Clear marks</button></div><small>Tap a subject: unmarked → green → red → unmarked. Changes save on this device.</small></details>'+
  '<div id="ttMobileFit" class="tt-mobile-fit" aria-label="Full timetable, fitted to phone screen"></div>'+
  '<p class="tt-picked" id="ttPicked" aria-live="polite">Tap a period to see the complete subject name.</p>'+
  '<div id="ttZoomLayer" class="tt-zoom-layer" hidden role="dialog" aria-modal="true" aria-label="Enlarged school timetable"><div class="tt-zoom-panel"><div class="tt-zoom-header"><strong id="ttZoomTitle">Timetable · Zoom</strong><button type="button" id="ttZoomClose" aria-label="Close enlarged timetable">×</button></div><label class="tt-zoom-choose">Day <select id="ttZoomSelect"><option value="0">Day 1</option><option value="1">Day 2</option><option value="2">Day 3</option><option value="3">Day 4</option><option value="4">Day 5</option><option value="5">Day 6</option></select></label><div class="tt-zoom-periods" id="ttZoomPeriods"></div></div></div>';
 existing.before(box);
 const a=$('#ttEnhancement');
 a.addEventListener('click',e=>{
  const target=e.target.closest('button,[data-tt-status]');
  if(!target)return;
  if(target.dataset.ttSubject){const n=target.dataset.ttSubject;setStatus(n,['none','green','red'][(['none','green','red'].indexOf(status(n))+1)%3]);return}
  if(target.dataset.ttBulk){const v=target.dataset.ttBulk;marks=v==='none'?{}:Object.fromEntries(subjects.map(s=>[s,v]));try{localStorage.setItem(KEY,JSON.stringify(marks))}catch{};render();return}
  if(target.dataset.ttDay!=null){const d=Number(target.dataset.ttDay),p=Number(target.dataset.ttPeriod);select(d,p);return}
  if(target.dataset.ttZoomPeriod!=null){select(zoomDay,Number(target.dataset.ttZoomPeriod));$('#ttZoomLayer').hidden=true;return}
  if(target.id==='ttZoomOpen'){openZoom();return}
  if(target.id==='ttZoomClose'){$('#ttZoomLayer').hidden=true;return}
  if(target.id==='ttTextMinus'){zoomFont=Math.max(-2,zoomFont-1);renderMobile();return}
  if(target.id==='ttTextPlus'){zoomFont=Math.min(3,zoomFont+1);renderMobile();return}
  if(target.id==='ttTextFit'){zoomFont=0;renderMobile();return}
 });
 $('#ttZoomSelect').onchange=e=>{zoomDay=Number(e.target.value);renderZoom()};
 $('#ttZoomLayer').addEventListener('click',e=>{if(e.target.id==='ttZoomLayer')e.target.hidden=true});
 a.addEventListener('keydown',e=>{if(e.key==='Escape')$('#ttZoomLayer').hidden=true});
 existing.addEventListener('click',e=>{
  const td=e.target.closest('td');if(!td)return;
  const tr=td.parentElement,rows=[...tr.parentElement.children],d=rows.indexOf(tr);
  const cells=[...tr.querySelectorAll('td')],p=cells.indexOf(td);
  if(d>=0&&p>=0)select(d,p);
 });
 render();
}
function select(d,p){
 if(!days[d]||!days[d][p])return;
 selected={d,p};zoomDay=d;
 const subject=days[d][p];
 const msg=$('#ttPicked');if(msg)msg.textContent='Day '+(d+1)+' · P'+p+' — '+subject+(status(base(subject))==='green'?' ✓ Completed':status(base(subject))==='red'?' × Pending':'');
 renderMobile();renderZoom();
}
function renderSubjects(){
 const root=$('#ttSubjects');if(!root)return;
 const count=subjects.filter(n=>status(n)==='green').length;
 $('#ttProgress').textContent=count+' / '+subjects.length+' green';
 $('#ttStatusSummary').textContent=count+' subject'+(count===1?'':'s')+' completed';
 root.innerHTML=subjects.map(n=>'<button type="button" class="tt-subject-button" data-tt-subject="'+safe(n)+'" data-state="'+status(n)+'" aria-label="'+safe(n)+': '+status(n)+'. Tap to change"><span>'+safe(n)+'</span><b>'+(status(n)==='green'?'✓':status(n)==='red'?'×':'·')+'</b></button>').join('');
}
function renderDesktop(){
 const table=$('#modalContent .timetable-scroll .timetable-table');
 if(!table)return;
 table.querySelectorAll('tbody tr').forEach((tr,d)=>{
  tr.querySelectorAll('td').forEach((td,p)=>{
   const name=days[d]?.[p]||'',mark=status(base(name));
   td.classList.toggle('tt-complete',mark==='green');
   td.classList.toggle('tt-pending',mark==='red');
   td.dataset.ttFull=name;
   td.title='Day '+(d+1)+' · P'+p+': '+name+' (tap for full subject)';
  });
 });
}
function renderMobile(){
 const host=$('#ttMobileFit');if(!host)return;
 const td=(d,p)=>{
  const name=days[d][p],sub=base(name),mark=status(sub),label=name==='—'?'—':abbr[sub]||sub;
  return '<td><button type="button" class="tt-period-button" data-tt-day="'+d+'" data-tt-period="'+p+'" data-state="'+mark+'" title="'+safe(name)+'" aria-label="Day '+(d+1)+' period '+p+' '+safe(name)+'"><span>'+safe(label)+'</span><i aria-hidden="true"></i></button></td>';
 };
 host.style.setProperty('--tt-fit-font',(8+zoomFont)+'px');
 host.innerHTML='<table class="tt-fit-table"><thead><tr><th scope="col">P</th>'+days.map((_,d)=>'<th scope="col">D'+(d+1)+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:9},(_,p)=>'<tr><th scope="row">P'+p+'</th>'+days.map((_,d)=>td(d,p)).join('')+'</tr>').join('')+'</tbody></table>';
}
function renderZoom(){
 const host=$('#ttZoomPeriods');if(!host||!days[zoomDay])return;
 $('#ttZoomTitle').textContent='Day '+(zoomDay+1)+' · All periods';
 host.innerHTML=days[zoomDay].map((name,p)=>{
  const mark=status(base(name));
  return '<button type="button" data-tt-zoom-period="'+p+'" data-state="'+mark+'"><small>P'+p+'</small><strong>'+safe(name)+'</strong><span>'+({green:'✓ Done',red:'× Pending',none:'Not marked'}[mark])+'</span></button>';
 }).join('');
}
function openZoom(){
 const layer=$('#ttZoomLayer');if(!layer)return;
 zoomDay=selected?.d??Math.max(0,Math.min(5,(window.__8apdfStudyBridge?.schoolDay?.()||1)-1));
 $('#ttZoomSelect').value=String(zoomDay);renderZoom();layer.hidden=false;
 $('#ttZoomClose').focus({preventScroll:true});
}
function render(){renderSubjects();renderDesktop();renderMobile();renderZoom()}
document.addEventListener('8apdf:timetable-open',control);
})();