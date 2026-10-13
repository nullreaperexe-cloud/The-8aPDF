(()=>{'use strict';let core=null,config=null,auto=true,shownDate='',lastDate='';
const $=id=>document.getElementById(id),extraKey='8apdf_my_school_holidays_v1';
const extra=()=>{try{return JSON.parse(localStorage.getItem(extraKey)||'[]')}catch{return[]}};
const merged=()=>({...config,holidays:[...(config?.holidays||[]),...extra()]});
const today=()=>core&&config?core.calendarDay(core.dateKey(),merged()):null;
function update(){
 if(!core||!config)return;const current=today();lastDate=current.date;
 if(auto)window.__8apdfStudyBridge?.setSchoolDay?.(current.schoolDay||current.nextDay);
 let line=$('schoolCycleInfo');if(!line){line=document.createElement('p');line.id='schoolCycleInfo';line.className='school-cycle-info';$('todayList').before(line)}
 line.textContent=current.holiday?current.reason+' · Next school day: '+current.nextDate+' · Day '+current.nextDay:current.date+' · Today: Day '+current.schoolDay+' · Next: Day '+current.nextDay+' ('+current.nextDate+')';
 const button=$('schoolCycleCalendar')||document.createElement('button');if(!button.id){button.id='schoolCycleCalendar';button.type='button';button.textContent='View school calendar';button.onclick=()=>window.__8apdfOpenPage?.('/school-calendar');line.after(button)}
 document.dispatchEvent(new Event('8apdf:school-calendar-ready'));document.dispatchEvent(new Event('8apdf:school-day-changed'));
}
async function init(){
 core=await import('/shared/school-calendar-core.js');config=await fetch('/data/school-calendar.json').then(r=>r.json());
 window.__8apdfCalendar={today,getDay:d=>core.calendarDay(d,merged()),getConfig:()=>merged(),addHoliday:(start,end,reason)=>{core.dateMs(start);core.dateMs(end);if(end<start)throw Error('End date must follow start date');const list=extra();list.push({start,end,reason:reason||'School holiday',source:'my-calendar'});localStorage.setItem(extraKey,JSON.stringify(list));auto=true;update()},removeMyHoliday:index=>{const list=extra();list.splice(index,1);localStorage.setItem(extraKey,JSON.stringify(list));auto=true;update()},myHolidays:extra};
 $('daySelect').addEventListener('change',()=>{auto=false;document.documentElement.dataset.schoolDayMode='manual'});
 update();
 try{const response=await fetch('/api/school-calendar?date='+core.dateKey());if(response.ok){const data=await response.json();config=data.config;update()}}catch{}
 document.addEventListener('8apdf:teacher-data',e=>{if(!config||!core)return;const imported=core.holidaysFromNotices(e.detail||[]),byDate=new Map([...config.holidays,...imported].map(h=>[h.date||h.start,h]));config={...config,holidays:[...byDate.values()]};update()});
 setInterval(()=>{if(core.dateKey()!==lastDate){auto=true;update()}},60000);
}
init().catch(error=>console.warn('School calendar:',error.message));
})();
