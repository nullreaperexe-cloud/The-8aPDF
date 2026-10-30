/* 8aPDF — elegant, accessible, responsive study typing headline. */
(()=>{'use strict';
const headline=document.getElementById('studyTypingHeadline');
const output=document.getElementById('studyTypingText');
if(!headline||!output)return;
const lines=[
 'Learn today. Lead tomorrow.',
 'Big dreams begin with small steps.',
 'One chapter closer to your goal.',
 'Stay curious. Keep discovering.',
 'Every question makes you stronger.',
 'Read more. Understand deeper.',
 'Progress beats perfection.',
 'Turn effort into excellence.',
 'Small wins build big dreams.',
 'New day. New things to learn.',
 'Your next breakthrough starts here.',
 'One lesson at a time.',
 'Keep exploring. Keep growing.',
 'Focus now. Shine later.',
 'Study smart. Dream without limits.',
 'Believe. Learn. Achieve.',
 'Every page holds a possibility.',
 'Every minute of effort matters.',
 'Your curiosity is your superpower.',
 'Start strong. Finish stronger.',
 'Every chapter counts.',
 'Study with purpose. Grow with pride.',
 'Stay focused. You are getting there.',
 'Discover more than yesterday.',
 'Make your learning count.',
 'More knowledge. More confidence.',
 'One step closer every day.',
 'Good things take practice.',
 'Knowledge opens new doors.',
 'Make the most of every lesson.',
 'Think bigger. Learn better.',
 'Your effort creates your future.',
 'Learn something new every day.',
 'Today is full of possibilities.'
];
// The introductory story plays once per page visit. It never repeats between
// motivational quotes, and waits briefly for live Supabase data rather than
// pretending a still-loading collection has zero new items.
const introStages=4; // welcome, today's PDFs, today's announcements, dated tests
let stage=0,quoteIndex=0,count=0,deleting=false,timer=0,phrase='',waitMs=0;
const root=document.documentElement;
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const welcome=()=>{
 let name='';
 try{name=(localStorage.getItem('eightapdf_user_name_v2')||localStorage.getItem('eightapdf_user_name')||'').trim()}catch{}
 name=name.replace(/\s+/g,' ').slice(0,32);
 return name&&name!=='Student'?'Welcome '+name:'Welcome';
};
let greeting=welcome();
headline.setAttribute('aria-label',greeting+'. Today’s school updates, followed by study motivation.');

function indiaDay(value){
 if(value===null||value===undefined||value==='')return '';
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 let date=null;
 if(typeof value==='number')date=new Date(value<1e11?value*1000:value);
 else if(value&&typeof value==='object'){
  if(value instanceof Date)date=value;
  else if(typeof value.toDate==='function'){try{date=value.toDate()}catch{}}
  else if(Number.isFinite(Number(value.seconds??value._seconds))){
   date=new Date(Number(value.seconds??value._seconds)*1000);
  }
 }else date=new Date(value);
 if(!date||!Number.isFinite(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function uniqueCount(rows,check){
 if(!Array.isArray(rows))return 0;
 const seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||!check(row))continue;
  const id=String(row.id??row.sourceMessageId??'').trim();
  if(id)seen.add(id);
 }
 return seen.size;
}
function introPhrase(which){
 if(which===0)return greeting;
 const bridge=window.__8apdfStudyBridge;
 const today=indiaDay(new Date());
 if(which===1){
  if(!bridge?.isLive?.()||typeof bridge.documents!=='function')return null;
  const n=uniqueCount(bridge.documents(),row=>
   indiaDay(row.uploadedAtMs??row.uploadedAt??row.createdAt)===today);
  return n+' PDF'+(n===1?'':'s')+' uploaded today.';
 }
 if(which===2){
  if(!bridge?.areAnnouncementsReady?.()||typeof bridge.announcements!=='function')return null;
  const n=uniqueCount(bridge.announcements(),row=>
   indiaDay(row.messageDate??row.createdAt)===today);
  return n+' new announcement'+(n===1?'':'s')+' today.';
 }
 if(which===3){
  if(!bridge?.areAnnouncementsReady?.()||typeof window.__8apdfStudyIntel?.upcoming!=='function')return null;
  const tests=window.__8apdfStudyIntel.upcoming();
  const n=uniqueCount(tests,row=>row.kind==='test'&&row.date>=today);
  return n===0?'No upcoming tests confirmed.':n+' upcoming test'+(n===1?'':'s')+'.';
 }
 return lines[quoteIndex];
}
const fallback=which=>({
 1:"Today's PDF count unavailable.",
 2:"Today's announcements unavailable.",
 3:"Upcoming tests not available."
}[which]||lines[quoteIndex]);
const permitted=()=>root.dataset.uiMode==='studio'&&root.dataset.motion!=='off'&&!motion.matches&&!document.hidden;
function schedule(delay){window.clearTimeout(timer);timer=window.setTimeout(tick,delay)}
function tick(){
 if(!permitted())return;
 if(document.querySelector('#welcomeScreen.show,#nameModal.show')){schedule(180);return;}
 if(!phrase){
  phrase=introPhrase(stage);
  if(phrase===null){
   if(waitMs<4000){waitMs+=250;schedule(250);return;}
   phrase=fallback(stage);
  }
  waitMs=0;
 }
 if(!deleting){
  if(count<phrase.length){
   count++;
   output.textContent=phrase.slice(0,count);
   schedule(45+(count%4)*6);
  }else{
   deleting=true;
   schedule(stage<introStages?1650:1850);
  }
 }else if(count>0){
  count--;
  output.textContent=phrase.slice(0,count);
  schedule(26);
 }else{
  deleting=false;
  phrase='';
  if(stage<introStages)stage++;
  else quoteIndex=(quoteIndex+1)%lines.length;
  schedule(330);
 }
}
function sync(){
 window.clearTimeout(timer);
 headline.classList.toggle('study-typing-still',motion.matches||root.dataset.motion==='off');
 if(root.dataset.uiMode!=='studio')return;
 if(motion.matches||root.dataset.motion==='off'){
  output.textContent=stage<introStages?greeting:lines[quoteIndex];
  count=output.textContent.length;
  deleting=false;
  phrase=output.textContent;
  return;
 }
 if(document.hidden)return;
 schedule(100);
}
if(motion.matches||root.dataset.motion==='off'){
 output.textContent=greeting;count=greeting.length;phrase=greeting;
}else{
 output.textContent='';count=0;schedule(160);
}
document.addEventListener('8apdf:profile-changed',()=>{
 const name=welcome();
 if(name===greeting)return;
 greeting=name;stage=0;quoteIndex=0;count=0;deleting=false;phrase='';waitMs=0;
 output.textContent='';
 headline.setAttribute('aria-label',greeting+'. Today’s school updates, followed by study motivation.');
 sync();
});
document.addEventListener('visibilitychange',sync);
document.addEventListener('8apdf:ui-mode-changed',sync);
motion.addEventListener?.('change',sync);
new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-motion','data-ui-mode']});
})();
