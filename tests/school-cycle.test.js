import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {calendarDay,dateKey,holidaysFromNotices,dateMs} from '../shared/school-calendar-core.js';
import {notificationAllowed,recordNotification} from '../shared/notification-policy.js';
const config=JSON.parse(fs.readFileSync('data/school-calendar.json'));
assert.equal(calendarDay('2026-10-13',config).schoolDay,6);
assert.equal(calendarDay('2026-10-14',config).schoolDay,1);
assert.equal(calendarDay('2026-10-18',config).reason,'Sunday');
assert.equal(calendarDay('2026-10-10',config).reason,'Second Saturday');
assert.equal(calendarDay('2026-10-24',config).reason,'Fourth Saturday');
assert.equal(calendarDay('2026-10-17',config).schoolDay,4);
assert.equal(calendarDay('2026-10-19',config).schoolDay,5);
// Midterm timetable correction: next school day on Oct 22 is Day 5.
assert.equal(calendarDay('2026-10-21',config).schoolDay,4);
assert.equal(calendarDay('2026-10-21',config).nextDate,'2026-10-22');
assert.equal(calendarDay('2026-10-21',config).nextDay,5);
assert.equal(calendarDay('2026-10-22',config).schoolDay,5);
assert.equal(calendarDay('2026-10-23',config).schoolDay,6);
assert.equal(calendarDay('2026-10-26',config).schoolDay,1);
const closed={...config,holidays:[{date:'2026-10-14',reason:'Confirmed school holiday'}]};
assert.equal(calendarDay('2026-10-14',closed).schoolDay,null);
assert.equal(calendarDay('2026-10-15',closed).schoolDay,1);
assert.equal(calendarDay('2026-10-13',closed).nextDate,'2026-10-15');
assert.equal(calendarDay('2026-10-12',config).schoolDay,5);
assert.equal(dateKey(new Date('2026-10-13T19:00:00Z')),'2026-10-14');
assert.throws(()=>dateMs('2026-02-30'));
const notices=[{id:'office',title:'School office will be closed',message:'14 October 2026'}, {id:'reopen',title:'School holiday',message:'School will remain closed on 14-10-2026. School will reopen on 15 October 2026.'},{id:'range',title:'School holiday',message:'School will be closed from 20 October 2026 to 22 October 2026.'},{id:'test',title:'Math test',message:'23 October 2026'}];
assert.deepEqual(holidaysFromNotices(notices).map(x=>x.date),['2026-10-14','2026-10-20','2026-10-21','2026-10-22']);
const state={seen:{}};
assert(notificationAllowed(state,'chat:1','v1','2026-10-13',false));
recordNotification(state,'chat:1','v1','2026-10-13');
assert(!notificationAllowed(state,'chat:1','v1','2026-10-13',true));
assert(!notificationAllowed(state,'chat:1','v1','2026-10-14',false));
assert(notificationAllowed(state,'chat:1','v1','2026-10-14',true));
assert(notificationAllowed(state,'chat:1','v2','2026-10-13',false));
// Execute the real typing engine using a virtual clock, including welcome cover.
let now=0,serial=0,covered=true;const timers=new Map(),seen=[];
const output={_text:'',get textContent(){return this._text},set textContent(v){this._text=v;seen.push(v)}};
const root={dataset:{uiMode:'studio',motion:'on'}};
const doc={hidden:false,documentElement:root,getElementById:id=>id==='studyTypingText'?output:{setAttribute(){},classList:{toggle(){}}},querySelector:()=>covered?{}:null,addEventListener(){}};
const win={matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(fs.readFileSync('study-typing.js','utf8'),{document:doc,window:win,localStorage:{getItem:()=> 'Kanish'},MutationObserver:class {observe(){}}});
function advance(ms){const end=now+ms;while(timers.size){const [id,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(t.at>end)break;now=t.at;timers.delete(id);t.fn()}now=end}
advance(5000);assert(!seen.includes('Welcome Kanish'),'Greeting must wait until welcome overlay closes');
covered=false;advance(1300);assert(seen.includes('Welcome Kanish'));assert(!seen.includes('Learn today. Lead tomorrow.'));
advance(5000);assert(seen.includes('Learn today. Lead tomorrow.'));
console.log('PASS school rotation, confirmed closures, notification dedupe and greeting-to-motivation animation');
// Verify the production compact toast waits five seconds and exits after three.
let clock=0,seq=0;const jobs=new Map(),nodes=[];
function node(tag){const classes=new Set();return {tag,children:[],setAttribute(){},append(...kids){this.children.push(...kids)},classList:{contains:c=>classes.has(c),add:c=>classes.add(c)},remove(){this.removed=true}}}
const body=node('body'),documentMock={hidden:false,body,querySelector:()=>null,addEventListener(){},getElementById:id=>nodes.find(n=>n.id===id),createElement:tag=>{const n=node(tag);nodes.push(n);return n}};
const storage=new Map(),ctx={document:documentMock,window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Intl,Date,performance:{now:()=>clock},notificationRules:{notificationAllowed,recordNotification},setTimeout:(fn,delay)=>{const id=++seq;jobs.set(id,{fn,at:clock+delay});return id},clearTimeout:id=>jobs.delete(id)};
vm.runInNewContext(fs.readFileSync('compact-notices.js','utf8').replace("import('/shared/notification-policy.js')","Promise.resolve(notificationRules)"),ctx);
await new Promise(setImmediate);
const item={source:'chat',id:'one',fingerprint:'one-v1',title:'New message',body:'Unread message'};
ctx.window.__8apdfNotices.publish(item);
function move(ms){const end=clock+ms;while(jobs.size){const [id,t]=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(t.at>end)break;clock=t.at;jobs.delete(id);t.fn()}clock=end}
move(4999);assert(!nodes.find(n=>n.className==='compact-notice'));
move(1);const toast=nodes.find(n=>n.className==='compact-notice');assert(toast);move(2999);assert(!toast.classList.contains('leaving'));move(1);assert(toast.classList.contains('leaving'));move(240);assert(toast.removed);
ctx.window.__8apdfNotices.publish(item);move(1000);assert.equal(nodes.filter(n=>n.className==='compact-notice').length,1);
ctx.window.__8apdfNotices.publish({...item,fingerprint:'one-v2'});assert.equal(nodes.filter(n=>n.className==='compact-notice').length,2);
console.log('PASS actual compact notification timer: 5 seconds delay, 3 seconds display, smooth exit and no repeated alert');
