/* Local-first 8aPDF teacher announcements and dated reminders. */
(()=>{'use strict';
const $=id=>document.getElementById(id),K='8apdf_events_v2',SEEN='8apdf_events_seen_v2';
const str=(x,n=500)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const lower=x=>str(x,2000).toLocaleLowerCase();
const fromStore=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}};
const localDate=(y,m,d)=>{const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null};
const keyDate=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
function parseDate(source){
 if(!source)return null;
 if(typeof source==='number')return new Date(source<1e11?source*1000:source);
 if(typeof source==='object'){
  if(source instanceof Date)return source;
  if(typeof source.toDate==='function')try{return source.toDate()}catch{}
  if(Number.isFinite(source.seconds))return new Date(source.seconds*1000);
 }
 const s=str(source,120),m=s.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/);
 if(m)return localDate(+m[1],+m[2],+m[3]);
 const d=s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d\d)\b/);
 if(d)return localDate(+d[3],+d[2],+d[1]);
 const p=Date.parse(s);return Number.isFinite(p)?new Date(p):null;
}
function dateInText(text,base){
 const s=str(text,3000);
 let m=s.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/);if(m)return localDate(+m[1],+m[2],+m[3]);
 m=s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d\d)\b/);if(m)return localDate(+m[3],+m[2],+m[1]);
 const mm={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
 m=s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(20\d\d))?\b/i);
 if(m)return localDate(+(m[3]||(base?base.getFullYear():new Date().getFullYear())),mm[m[2].slice(0,3).toLowerCase()],+m[1]);
 m=s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d\d))?\b/i);
 if(m)return localDate(+(m[3]||(base?base.getFullYear():new Date().getFullYear())),mm[m[1].slice(0,3).toLowerCase()],+m[2]);
 if(base&&/\b(?:tomorrow|next day)\b/i.test(s))return localDate(base.getFullYear(),base.getMonth()+1,base.getDate()+1);
 return null;
}
function typeOf(a){
 const t=lower([a.title,a.description,a.message,a.fullMessage,a.category].join(' '));
 if(/\b(?:test|exam|quiz|assessment|class test|unit test)\b|परीक्षा|ਟੈਸਟ/i.test(t))return'test';
 if(/\b(?:submit|submission|hand.in|notebook check|notebook submission|notebook checking|copy checking|copy submit|bring your notebook|bring the notebook)\b|नोटबुक|जमा|ਕਾਪੀ/i.test(t))return'submission';
 return'';
}
let announcements=[],events=(fromStore(K,[])||[]).filter(x=>x&&x.date&&x.id).slice(-120),ready=false;
function toEvent(a){
 const type=typeOf(a);if(!type)return null;
 const base=parseDate(a.messageDate)||parseDate(a.createdAt);
 const when=parseDate(a.eventDate)||dateInText([a.title,a.description,a.message,a.fullMessage].join(' '),base);
 if(!when||!Number.isFinite(when.getTime()))return null;
 return {id:str(a.id,100),title:str(a.title||a.description,180),kind:type,date:keyDate(when),subject:str(a.subject,75),excerpt:str(a.description||a.message,240)};
}
function upcoming(){
 const today=keyDate(new Date()),until=keyDate(new Date(Date.now()+60*86400000));
 return events.filter(x=>x.date>=today&&x.date<=until).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
}
function dayName(date){
 const today=keyDate(new Date()),next=keyDate(new Date(Date.now()+86400000));
 if(date===today)return'Today';if(date===next)return'Tomorrow';
 return new Date(date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
function ingest(raw){
 if(!Array.isArray(raw)||!raw.length)return;
 announcements=raw.filter(x=>x&&x.id).slice(0,180).map(a=>({id:str(a.id,110),title:str(a.title,180),description:str(a.description,700),message:str(a.message,500),fullMessage:str(a.fullMessage,700),category:str(a.category,75),subject:str(a.subject,65),eventDate:a.eventDate,messageDate:a.messageDate,createdAt:a.createdAt}));
 const activeIds=new Set(announcements.map(a=>a.id));
 const map=new Map(events.filter(x=>!activeIds.has(x.id)).map(x=>[x.id+'|'+x.date,x]));
 for(const a of announcements){const e=toEvent(a);if(e)map.set(e.id+'|'+e.date,e)}
 events=[...map.values()].filter(e=>e.date>=keyDate(new Date(Date.now()-86400000))).slice(-120);
 try{localStorage.setItem(K,JSON.stringify(events))}catch{}
 updateButton();remind();
}
function answer(query){
 const n=lower(query);
 const test=/\b(?:test|exam|quiz|assessment)\b|परीक्षा|ਟੈਸਟ/.test(n);
 const submission=/\b(?:notebook|copy submission|submit|submission|homework|assignment|project)\b|नोटबुक|ਜਮ੍ਹਾਂ/.test(n);
 const notice=/\b(?:teacher message|teacher notice|announcement|circular|school notice)\b|सूचना/.test(n);
 if(!test&&!submission&&!notice)return null;
 const kind=test?'test':submission?'submission':'';
 const terms=['science','english','hindi','punjabi','maths','mathematics','computer','history','geography','sst'];
 const subject=terms.find(x=>n.includes(x));
 const eventHits=upcoming().filter(x=>(!kind||x.kind===kind)&&(!subject||lower(x.title+' '+x.subject+' '+x.excerpt).includes(subject))).slice(0,4);
 const wantFuture=/\b(?:upcoming|next|tomorrow|when|when is|date|coming|kab|aane|kal|due)\b/.test(n)||test;
 if(wantFuture&&eventHits.length){
  return {message:eventHits.map(e=>(e.kind==='test'?'Test: ':'Submission: ')+e.title+' — '+dayName(e.date)+' ('+e.date+').').join('\n')+'\nConfirmed from dated teacher messages. Check with your teacher if plans change.',announcements:eventHits.map(e=>announcements.find(a=>a.id===e.id)).filter(Boolean)};
 }
 const list=announcements.filter(a=>(!kind||typeOf(a)===kind)&&(!subject||lower([a.title,a.subject,a.description,a.message].join(' ')).includes(subject))).sort((a,b)=>(parseDate(b.messageDate||b.createdAt)?.getTime()||0)-(parseDate(a.messageDate||a.createdAt)?.getTime()||0)).slice(0,3);
 if(list.length){
  return {message:list.map((a,i)=>String(i+1)+'. '+a.title+' — '+str(a.description||a.message,200)+(toEvent(a)?' [Date: '+toEvent(a).date+']':' [Upcoming date not confirmed]')).join('\n')+'\nSource: teacher announcements.',announcements:list};
 }
 return {message:'No matching confirmed '+(test?'test':submission?'notebook submission':'announcement')+' found in the announcements loaded so far.',announcements:[]};
}
function remind(){
 if(!ready)return;
 const soon=upcoming().slice(0,3);
 const notices=window.__8apdfNotices;if(!notices)return;
 for(const e of soon)notices.publish({source:'school',id:e.id+'#'+e.date,fingerprint:e.date+'|'+e.title+'|'+e.excerpt,title:dayName(e.date)+' · '+(e.kind==='test'?'Test':'Submission'),body:e.title,open:()=>document.querySelector('#studioSidebar [data-go="announcements"]')?.click()});
}
function updateButton(){
 const b=$('wsUpcomingBtn');if(!b)return;const n=upcoming().length;b.hidden=n===0;b.textContent='◷ '+n+' upcoming '+(n===1?'reminder':'reminders');
}
function customKey(){return ''} // AI uses the server-side GROQ_API_KEY only.
function addBadge(){
 const root=$('workspaceHomeActions');if(!root||$('wsUpcomingBtn'))return;
 const b=document.createElement('button');b.type='button';b.id='wsUpcomingBtn';b.hidden=true;b.className='ws-upcoming-btn';b.onclick=()=>{try{localStorage.removeItem(SEEN)}catch{}remind()};root.append(b);updateButton();
}
window.__8apdfStudyIntel={getAnnouncements:()=>announcements.slice(),upcoming,answer,customKey,mountBadge:addBadge,refresh:()=>ingest(window.__8apdfStudyBridge?.announcements?.()||[])};
document.addEventListener('8apdf:teacher-data',e=>ingest(e.detail));
function init(){addBadge();ingest(window.__8apdfStudyBridge?.announcements?.()||[]);ready=true;remind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
