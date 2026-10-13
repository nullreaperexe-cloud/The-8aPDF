const DAY=86400000;
export const dateKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function dateMs(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw Error('Use YYYY-MM-DD');const t=Date.parse(key+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==key)throw Error('Invalid calendar date');return t;}
export const addDays=(key,n)=>new Date(dateMs(key)+n*DAY).toISOString().slice(0,10);
export function closure(key,config){
 const date=new Date(dateMs(key)),weekday=date.getUTCDay(),week=Math.ceil(date.getUTCDate()/7);
 const extra=(config.holidays||[]).find(h=>h.date===key||(h.start&&key>=h.start&&key<=h.end));if(extra)return extra.reason||'School holiday';
 if((config.weeklyOff||[0]).includes(weekday))return'Sunday';
 if(weekday===6&&(config.saturdayOff||[2,4]).includes(week))return week===2?'Second Saturday':'Fourth Saturday';
 return'';
}
export function cycleNumber(key,config){
 const anchor=dateMs(config.anchor.date),target=dateMs(key);let n=Number(config.anchor.day)-1;
 if(target>=anchor){for(let t=anchor+DAY;t<=target;t+=DAY)if(!closure(new Date(t).toISOString().slice(0,10),config))n++;}
 else{for(let t=anchor;t>target;t-=DAY)if(!closure(new Date(t).toISOString().slice(0,10),config))n--;}
 return((n%6)+6)%6+1;
}
export function calendarDay(key,config){
 const reason=closure(key,config);let next=addDays(key,1),guard=0;while(closure(next,config)&&guard++<366)next=addDays(next,1);
 return {date:key,schoolDay:reason?null:cycleNumber(key,config),holiday:!!reason,reason,nextDate:next,nextDay:cycleNumber(next,config)};
}
const parseValue=value=>{if(value?.seconds)return dateKey(new Date(value.seconds*1000));const s=String(value||'');if(/T\d{2}:\d{2}/.test(s)&&Number.isFinite(Date.parse(s)))return dateKey(new Date(s));const iso=s.match(/\b(20\d\d-\d{2}-\d{2})\b/);if(iso)return iso[1];return''};
export function holidaysFromNotices(notices){
 const result=[],months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
 for(const n of notices||[]){
  const text=[n.title,n.message,n.fullMessage,n.description].join(' ');
  if(/school office|office timings|administrative office/i.test(text))continue;
  if(!/school.{0,65}(?:remain closed|will be closed|shall remain closed|holiday)|(?:school holiday|no classes|holiday for students)/i.test(text))continue;
  // A reopening date is a school day, never a holiday.
  const closedText=text.split(/(?:school\s+)?(?:will\s+)?reopen/i)[0];
  const base=parseValue(n.messageDate)||parseValue(n.createdAt),year=base?.slice(0,4)||'2026',dates=[];
  const event=parseValue(n.eventDate);if(event)dates.push(event);
  for(const m of closedText.matchAll(/\b(20\d\d-\d{2}-\d{2})\b/g))dates.push(m[1]);
  for(const m of closedText.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d\d)\b/g))dates.push(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  for(const m of closedText.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s*,?\s*(20\d\d))?/gi))dates.push(`${m[3]||year}-${String(months[m[2].slice(0,3).toLowerCase()]).padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  for(const m of closedText.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d\d))?/gi))dates.push(`${m[3]||year}-${String(months[m[1].slice(0,3).toLowerCase()]).padStart(2,'0')}-${m[2].padStart(2,'0')}`);
  if(!dates.length&&base&&/\btomorrow\b/i.test(closedText))dates.push(addDays(base,1));
  const unique=[...new Set(dates)].filter(d=>{try{dateMs(d);return true}catch{return false}}).sort();
  if(unique.length===2&&/\bfrom\b[\s\S]*\b(?:to|till|through)\b/i.test(closedText)&&dateMs(unique[1])-dateMs(unique[0])<=90*DAY){for(let d=unique[0];d<=unique[1];d=addDays(d,1))result.push({date:d,reason:n.title||'School holiday',source:'teacher-notice',noticeId:n.id});}
  else unique.forEach(date=>result.push({date,reason:n.title||'School holiday',source:'teacher-notice',noticeId:n.id}));
 }
 return [...new Map(result.map(h=>[h.date,h])).values()];
}
