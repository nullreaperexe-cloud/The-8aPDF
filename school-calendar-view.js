(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>parent.__8apdfCalendar;
const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
const parts=Object.fromEntries(format.formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
let month=parts.year+'-'+parts.month,touchX=null,touchY=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const c=api(),today=c?.today(),config=c?.getConfig();
 if(!today||!config)return;
 const first=new Date(month+'-01T00:00:00Z');
 $('calendarMonth').textContent=first.toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'});
 $('calendarSummary').innerHTML='<strong>'+esc(today.date)+' · '+(today.holiday?esc(today.reason):'Day '+today.schoolDay)+'</strong><p>Next school day: '+esc(today.nextDate)+' · Day '+today.nextDay+'</p>';
 const offset=(first.getUTCDay()+6)%7,start=new Date(first.getTime()-offset*86400000);
 $('calendarGrid').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<span>'+d+'</span>').join('')+
  Array.from({length:42},(_,i)=>{
   const key=new Date(start.getTime()+i*86400000).toISOString().slice(0,10);
   const day=c.getDay(key);
   return '<button type="button" class="calendar-date '+(day.holiday?'off ':'')+(key===today.date?'today ':'')+(key.slice(0,7)!==month?'faded':'')+'" data-date="'+key+'" aria-label="'+key+' '+esc(day.holiday?day.reason:'Day '+day.schoolDay)+'"><strong>'+Number(key.slice(-2))+'</strong><small>'+(day.holiday?'Off':'Day '+day.schoolDay)+'</small></button>';
  }).join('');
 const sync=config.holidaySync||{};
 let status='EduSecure sync awaiting a successful check.';
 if(sync.status==='synced'&&sync.checkedAt){
  const checked=new Date(sync.checkedAt);
  const time=Number.isFinite(checked.getTime())?checked.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'unknown';
  status='EduSecure checked: '+time+' IST. '+(sync.bannersFound===0?'No holiday cards found.':(sync.bannersFound??0)+' holiday card(s) found.');
 }
 $('calendarSources').textContent='Sunday and 2nd/4th Saturdays are always off. Other closures come only from verified EduSecure holiday cards. '+status+' School days follow the centrally confirmed six-day cycle.';
}
function advance(n){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);month=d.toISOString().slice(0,7);render()}
$('calendarPrevious').onclick=()=>advance(-1);
$('calendarNext').onclick=()=>advance(1);
$('calendarGrid').onclick=e=>{const b=e.target.closest('[data-date]');if(!b||!api()?.today())return;const d=api().getDay(b.dataset.date);$('calendarSelection').textContent=d.date+' · '+(d.holiday?d.reason:'School Day '+d.schoolDay)+' · Next: '+d.nextDate+' / Day '+d.nextDay};
const grid=$('calendarGrid');
grid.addEventListener('touchstart',e=>{if(e.touches.length===1){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY}},{passive:true});
grid.addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;touchX=null;touchY=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.25)advance(dx<0?1:-1)},{passive:true});
parent.document.addEventListener('8apdf:school-calendar-ready',render);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='8apdf:tool-visible'&&e.data.visible)render()});
render();
})();