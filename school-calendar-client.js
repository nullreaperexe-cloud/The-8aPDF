(()=>{'use strict';
let core=null,config=null,serverDate='',lastSeenDate='',lastFetch=0,request=null;
const $=id=>document.getElementById(id);
const today=()=>core&&config?core.calendarDay(serverDate||core.dateKey(),config):null;
function show(){
 if(!core||!config)return;
 const current=today();
 if(!current)return;
 lastSeenDate=current.date;
 // The shared calendar controls the automatic timetable on every device.
 window.__8apdfStudyBridge?.setSchoolDay?.(current.schoolDay||current.nextDay);
 let line=$('schoolCycleInfo');
 if(!line){
   const list=$('todayList');
   if(!list)return;
   line=document.createElement('p');line.id='schoolCycleInfo';
   line.className='school-cycle-info';list.before(line);
 }
 line.textContent=current.holiday
  ?current.reason+' · Next school day: '+current.nextDate+' · Day '+current.nextDay
  :current.date+' · Today: Day '+current.schoolDay+' · Next: Day '+current.nextDay+' ('+current.nextDate+')';
 let button=$('schoolCycleCalendar');
 if(!button){
   button=document.createElement('button');button.id='schoolCycleCalendar';
   button.type='button';button.textContent='View school calendar';
   button.onclick=()=>window.__8apdfOpenPage?.('/school-calendar');
   line.after(button);
 }
 document.dispatchEvent(new Event('8apdf:school-calendar-ready'));
 document.dispatchEvent(new Event('8apdf:school-day-changed'));
}
async function refresh(){
 if(request)return request;
 request=(async()=>{
  let incoming=null;
  try{
    const response=await fetch('/api/school-calendar?date=current&v=20261103-authoritative',{cache:'no-store'});
    if(!response.ok)throw Error('Calendar API unavailable');
    incoming=await response.json();
    if(!incoming.config?.anchor?.date)throw Error('Calendar data incomplete');
  }catch(error){
    // Read-only fallback is identical for every device; never use user-entered dates.
    if(config)return;
    const response=await fetch('/data/school-calendar.json?v=20261103-authoritative',{cache:'no-store'});
    if(!response.ok)throw error;
    incoming={config:await response.json(),currentDate:core.dateKey()};
  }
  config=incoming.config;
  serverDate=/^\d{4}-\d{2}-\d{2}$/.test(incoming.currentDate||'')?incoming.currentDate:core.dateKey();
  lastFetch=Date.now();show();
 })().catch(error=>console.warn('School calendar sync:',error?.message||'unavailable')).finally(()=>{request=null});
 return request;
}
async function init(){
 core=await import('/shared/school-calendar-core.js');
 // Previously saved per-device holidays are deliberately ignored.
 window.__8apdfCalendar={
   today,
   getDay:key=>core.calendarDay(key,config),
   getConfig:()=>config,
   refresh
 };
 await refresh();
 const recheck=()=>{
   if(!config)return refresh();
   const deviceDay=core.dateKey();
   if(deviceDay!==lastSeenDate||Date.now()-lastFetch>120000)refresh();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)recheck()});
 window.addEventListener('focus',recheck);
 setInterval(recheck,60000);
}
init().catch(error=>console.warn('School calendar initialization:',error?.message));
})();