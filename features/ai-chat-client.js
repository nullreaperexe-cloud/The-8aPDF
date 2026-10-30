(()=>{'use strict';
const el=id=>document.getElementById(id),bridge=()=>window.__8apdfStudyBridge;
const layer=el('pdfAiLayer'),feed=el('pdfAiFeed'),input=el('pdfAiInput'),status=el('pdfAiState'),hint=el('pdfAiHint');
const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase()
 .replace(/\bmathematics\b|\bmath\b|\bganit\b/g,'maths')
 .replace(/\bsst\b|\bsocial studies\b/g,'social science')
 .replace(/\bcomputers\b/g,'computer')
 .replace(/\bch\s*(\d{1,3})\b/g,'chapter $1')
 .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const ignore=new Set('find give show send me please the a an for of and in on to pdf pdfs material materials study notes note class my our want i need mujhe ka ki kaise kaha wala wali wale ke hai me mein se k do de dikhao dikhado chahiye from all about question questions available provide latest recent new newest today chapter chap lesson of full file document worksheet what when is are any bata bta dikha kiya kya'.split(' '));
const subjects=[['social science',['social science','sst','social studies','geography','history','civics']],['maths',['maths','mathematics','math','ganit']],['computer',['computer','computers','ai']],['science',['science','vigyan','physics','chemistry','biology']],['english',['english']],['hindi',['hindi','हिंदी','हिन्दी']],['punjabi',['punjabi','ਪੰਜਾਬੀ']],['french',['french']],['art',['art','drawing']],['life skills',['life skills']]];
const conversationalStop=new Set('which coming upcoming next tomorrow date dates due on when where please whenis kab kal hoga hone up about asking could would any all do does jo koi hai ki ka bata bta aane baare soon important recently nearest newest'.split(' '));
const words=s=>normalize(s).split(/\s+/).filter(x=>(x.length>1||/^\d+$/.test(x))&&!ignore.has(x)&&!conversationalStop.has(x));
function subjectOf(q){const n=normalize(q),padded=' '+n+' ';for(const [canonical,aliases] of subjects){for(const name of aliases){const needle=' '+normalize(name)+' ';if(padded.includes(needle))return canonical}}return ''}
function chapterOf(q){const m=normalize(q).match(/(?:chapter|chap|lesson|अध्याय|पाठ)\s*(?:number|no)?\s*(\d{1,3})/i);return m?String(Number(m[1])):''}
function termOf(q){const t=normalize(q);const m=t.match(/\bterm\s*([12])\b/);return m?'term'+m[1]:/\bundated\b/.test(t)?'undated':''}
const chapterPattern=/(?:chapter|chap|lesson|ch|अध्याय|पाठ)\s*(?:number|no)?\s*(\d{1,3})\b/gi;
const trainedTerms=new Map(),trainedAliases=new Map();
fetch('/data/ai-finder-training.json?v=offline-20261029',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(data=>{
 if(!data||data.version!==1||typeof data.items!=='object'||!data.items)return;
 for(const [id,item] of Object.entries(data.items)){
  if(!Array.isArray(item?.keywords)||item.keywords.length>12)continue;
  trainedTerms.set(id,normalize(item.keywords.join(' ')));
 }
 for(const [token,variants] of Object.entries(data.aliases||{})){
  if(!Array.isArray(variants)||variants.length>12||token.length>40)continue;
  trainedAliases.set(normalize(token),variants.filter(x=>typeof x==='string'&&x.length<55).map(normalize));
 }
}).catch(()=>{}); // Compact train.md vocabulary is loaded asynchronously; no query waits for it.

function chapterNumbers(text){const arr=[];for(const m of normalize(text).matchAll(chapterPattern))arr.push(String(Number(m[1])));return arr}
function matchChapter(d,no){if(!no)return true;const titleNums=chapterNumbers([d.title,d.chapter].join(' ')),explicit=normalize(d.chapter);if(titleNums.includes(no)||explicit===no)return true;if(titleNums.length)return false;const descNums=chapterNumbers([d.description,d.message].join(' '));return descNums.includes(no)}
function rank(q,docs,kind='pdf'){
 const norm=normalize(q),sub=subjectOf(q),chap=chapterOf(q),term=termOf(q),recent=/\b(latest|recent|newest|today|last|recently)\b/i.test(norm);
 const isNotice=kind==='announcement';
 const stop=new Set(['test','tests','exam','exams','assessment','quiz','quizzes','submission','submissions','submit','notebook','notebooks','homework','assignment','holiday','event','events','teacher','teachers','announcement','announcements','circular','circulars','message','messages','pdf','pdfs','notes','files','file','chapter','ch','lesson','document','documents','new','recent','latest','newest','today','last','school','work','workbook']);
 const namedSubjectTokens=new Set(words(sub));
 const significant=[...new Set(words(q).filter(t=>!stop.has(t)&&!namedSubjectTokens.has(t)&&!/^\d+$/.test(t)))];
 const wantTest=/\b(test|tests|exam|exams|assessment|quiz|quizzes)\b|परीक्षा|ਟੈਸਟ/i.test(norm);
 const wantSubmission=/\b(submit|submission|submissions|notebook|notebooks|copy checking)\b|जमा|ਕਾਪੀ/i.test(norm);
 const wantHomework=/\bhomework\b|होमवर्क|ਹੋਮਵਰਕ/i.test(norm);
 const wantHoliday=/\b(holiday|holidays|vacation|closed|closure|chhutti)\b|छुट्टी/i.test(norm);
 const wantNotice=/\b(teacher|teachers|announcement|announcements|notice|circular|message|messages)\b/i.test(norm);
 const wantWorksheet=/\bworksheet\b|\bwork sheet\b/i.test(norm);
 const wantNotes=/\b(notes|study notes|chapter notes|handwritten notes)\b/i.test(norm);
 const wantQna=/\b(qna|qa|question answers|questions and answers|solutions|ques ans)\b/i.test(norm);
 const wantPractical=/\b(practical|program|programs|coding)\b/i.test(norm);
 const wantRevision=/\b(revision|revise|practice)\b/i.test(norm);
 const aliases=token=>{
  const base=token==='qa'||token==='qna'?['question answer','question answers','questions','qa','qna','solution','answers']:token==='solutions'||token==='solution'?['solution','solved','answer','answers']:token==='revision'||token==='revise'?['revision','practice','review']:token==='worksheet'?['worksheet','work sheet','practice sheet']:token==='programs'||token==='program'?['program','programs','coding']:token==='sci'?['science']:token==='fractions'?['fraction','fractions']:[token];
  return [...new Set([...base,...(trainedAliases.get(token)||[])])];
 };
 const has=(field,token)=>aliases(token).some(w=>(' '+field+' ').includes(' '+w+' '));
 const rows=[];
 for(const doc of docs||[]){
  if(!doc||!doc.id||!doc.title)continue;
  if(!isNotice&&term&&doc.term&&doc.term!==term)continue;
  if(chap&&!matchChapter(doc,chap))continue;
  const title=normalize(doc.title),ds=normalize(doc.subject),desc=normalize([doc.description,doc.message,doc.fullMessage].join(' ')),meta=normalize([doc.chapter,doc.className,(doc.tags||[]).join(' ')].join(' ')),cat=normalize(doc.category);
  const text=title+' '+ds+' '+desc+' '+meta+' '+cat;
  const enriched=trainedTerms.get(kind+':'+doc.id)||'';
  const knownSubject=subjectOf(ds)||subjectOf(title)||subjectOf(meta);
  const unknownSubject=!ds||/^(other|general|uncategorized|circular|school diary)$/.test(ds);
  if(sub&&knownSubject&&knownSubject!==sub)continue;
  if(sub&&!knownSubject&&!(unknownSubject&&subjectOf(desc)===sub))continue;
  let score=(sub?(knownSubject===sub?65:24):0)+(chap?105:0),matched=0;
  for(const token of significant){
   if(has(title,token)){score+=34;matched++}
   else if(has(meta,token)){score+=22;matched++}
   else if(has(ds,token)){score+=16;matched++}
   else if(has(desc,token)){score+=10;matched++}
   else if(has(enriched,token)){score+=7;matched++}
  }
  if(significant.length&&!matched&&!chap)continue;
  if(significant.length>=2&&matched<Math.ceil(significant.length/2)&&!chap)continue;
  if(isNotice){
   const isTest=/\b(test|exam|quiz|assessment)\b|परीक्षा|ਟੈਸਟ/.test(text);
   const isSubmission=/\b(submit|submission|notebook|copy|bring)\b|जमा|ਕਾਪੀ/.test(text);
   const isHomework=/\b(homework|home work|assignment)\b|ਹੋਮਵਰਕ/.test(text);
   const isHoliday=/\b(holiday|holidays|closed|closure|vacation|chhutti)\b|छुट्टी/.test(text);
   if(wantTest&&!isTest)continue;
   if(wantSubmission&&!isSubmission)continue;
   if(wantHomework&&!isHomework)continue;
   if(wantHoliday&&!isHoliday)continue;
   if(wantTest)score+=55;
   if(wantSubmission)score+=48;
   if(wantHomework)score+=40;
   if(wantHoliday)score+=45;
   if(wantNotice)score+=18;
   if(wantTest&&/\b(tests|exams)\b/.test(cat))score+=15;
  }else{
   if(wantWorksheet&&/\bworksheet\b|\bwork sheet\b/.test(title))score+=40;
   else if(wantWorksheet&&/\bworksheet\b|\bwork sheet\b/.test(desc))score+=15;
   if(wantNotes&&/\b(notes|study notes|chapter notes)\b/.test(title))score+=42;
   else if(wantNotes&&/\bnotes\b/.test(desc))score+=13;
   if(wantQna&&/\b(question|questions|answer|answers|qna|qa|solution|solved)\b/.test(title))score+=36;
   else if(wantQna&&/\b(question|answer|solution)\b/.test(desc))score+=12;
   if(wantPractical&&/\b(practical|programs?|coding|html|css)\b/.test(title))score+=30;
   if(wantRevision&&/\b(revision|practice|revise)\b/.test(title))score+=27;
  }
  if(norm.length>8&&title.includes(norm))score+=70;
  const time=Number(doc.uploadedAtMs||doc.dateMs||Date.parse(doc.messageDate||doc.createdAt||0))||0;
  if(recent&&time)score+=15; // Sort equal-relevance matches by actual source date; no remote API.
  if(!sub&&!chap&&!significant.length&&!wantTest&&!wantSubmission&&!wantHomework&&!wantHoliday&&!wantNotice&&!recent&&!term)continue;
  if(!sub&&!chap&&!significant.length&&!isNotice&&!recent&&!term)continue;
  if(score<=0&&!recent)continue;
  rows.push({doc,score,time});
 }
 rows.sort((a,b)=>b.score-a.score||b.time-a.time||String(a.doc.title).localeCompare(String(b.doc.title)));
 return rows.slice(0,isNotice?4:6).map(x=>x.doc);
}
function makeMessage(text,type='ai'){const initial=el('pdfAiWelcome');if(initial)initial.hidden=true;const p=document.createElement('div');p.className='pdf-ai-message '+(type==='user'?'user':'ai');const z=document.createElement('p');z.textContent=text;p.append(z);feed.append(p);feed.scrollTop=feed.scrollHeight;return p}
function showResults(text,docs){const node=makeMessage(text);if(!docs.length)return;const grid=document.createElement('div');grid.className='pdf-ai-results';for(const doc of docs){const card=document.createElement('article');card.className='pdf-ai-result';const h=document.createElement('h3');h.textContent=doc.title;const small=document.createElement('small');small.textContent=[doc.subject,doc.term==='term1'?'Term 1':doc.term==='term2'?'Term 2':'Date unavailable',doc.chapter].filter(Boolean).join(' · ');card.append(h,small);const actions=document.createElement('div');actions.className='pdf-ai-result-actions';for(const [label,action] of [['Preview','preview'],['Download','download'],['Share','share']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{if(!bridge()?.openDocument)return;bridge().openDocument(doc.id,action)});actions.append(b)}card.append(actions);grid.append(card)}node.append(grid);feed.scrollTop=feed.scrollHeight}
let configured=false,checked=false,busy=false,lastFocus=null,seq=0;const memory=new Map();
async function checkAI(){if(checked)return configured;checked=true;try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1800);try{const r=await fetch('/api/pdf-chat',{signal:controller.signal});const j=await r.json();configured=!!j.aiConfigured}catch{configured=false}finally{clearTimeout(timer)}}catch{configured=false}status.textContent=configured?'Instant answers · Groq available when needed':'Local-first search · no AI credits';return configured}

async function open(){lastFocus=document.activeElement;layer.hidden=false;document.body.classList.add('pdf-ai-open');if(document.documentElement.dataset.studioMobileMenu==='open')el('studioSidebarClose')?.click();input.focus({preventScroll:true});checkAI();}
function close(){layer.hidden=true;document.body.classList.remove('pdf-ai-open');lastFocus?.focus?.({preventScroll:true})}
el('studioAssistantLink')?.addEventListener('click',open);el('pdfAiClose').addEventListener('click',close);el('pdfAiShade').addEventListener('click',close);
const morePanel=el('studioMorePanel');if(morePanel){const btn=document.createElement('button');btn.type='button';btn.id='studioMoreAssistant';btn.textContent='✦ AI PDF Finder';btn.addEventListener('click',()=>{morePanel.hidden=true;open()});morePanel.append(btn)}
document.addEventListener('keydown',e=>{if(layer.hidden||el('settingsPanel')?.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();close();return}if(e.key==='Tab'){const focusable=[...layer.querySelectorAll('button:not([disabled]),textarea')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
el('pdfAiQuick').addEventListener('click',e=>{const b=e.target.closest('[data-ai-prompt]');if(!b)return;input.value=b.dataset.aiPrompt;el('pdfAiForm').requestSubmit()});
function showNoticeResults(result){
 const matches=result.announcements||[];
 showResults(result.message,result.results||[]);
 if(!matches.length)return;
 const messages=Array.from(feed.querySelectorAll('.pdf-ai-message.ai'));
 const parent=messages[messages.length-1];
 if(!parent)return;
 const list=document.createElement('div');list.className='pdf-ai-results';
 for(const a of matches.slice(0,4)){
  const card=document.createElement('article');card.className='pdf-ai-result';
  const h=document.createElement('h3');h.textContent=a.title||'Teacher announcement';
  const sub=document.createElement('small');sub.textContent=[a.subject,a.category].filter(Boolean).join(' · ')||'Teacher message';
  const p=document.createElement('p');p.textContent=String(a.description||a.message||'').slice(0,350);
  const btn=document.createElement('button');btn.type='button';btn.className='pdf-ai-source-link';btn.textContent='View Teacher Messages →';
  btn.onclick=()=>{close();bridge()?.navigate?.('announcements')};
  card.append(h,sub,p,btn);list.append(card)
 }
 parent.append(list);feed.scrollTop=feed.scrollHeight;
}
function answerLocal(query,docs){
 const norm=normalize(query),notices=bridge()?.announcements?.()||[];
 const sub=subjectOf(query),chap=chapterOf(query),term=termOf(query);
 if(/^(hi|hii|hello|hey|namaste|hello bhai|hlo)\b/.test(norm))return{message:'Hey! 👋 Ask me to find PDFs or teacher announcements by subject, chapter, test or topic.',results:[],announcements:[]};
 if(/\b(timetable|time table|periods|schedule)\b/.test(norm)&&!sub){
  const days=bridge()?.timetable?.(),detail=Array.isArray(days)?'\n\n'+days.map(x=>'Day '+x.day+': '+x.periods.slice(1).join(' · ')).join('\n'):'';
  return {message:'Your six-day timetable is in the left sidebar → Timetable.'+detail,results:[],announcements:[]};
 }
 if(!docs.length&&!notices.length)return{message:'The school library is still loading. Please try again in a moment.',results:[],announcements:[]};
 const wantPdf=/\b(pdf|pdfs|file|files|worksheet|notes|chapter|chap|study material|download|document)\b|पीडीएफ/i.test(norm)||Boolean(chap||term);
 const wantAnnouncement=/\b(announcement|announcements|circular|teacher|test|exam|quiz|homework|submission|notebook|notice|message|assignment|holiday|event|due)\b|सूचना|परीक्षा|ਹੋਮਵਰਕ/i.test(norm);
 const pdfResults=wantAnnouncement&&!wantPdf?[]:rank(query,docs);
 const noticeResults=wantPdf&&!wantAnnouncement?[]:rank(query,notices,'announcement');
 // A high-confidence local answer never calls the remote AI: same instant speed.
 if(pdfResults.length||noticeResults.length){
  const texts=[];if(pdfResults.length)texts.push(pdfResults.length+' matching PDF'+(pdfResults.length===1?'':'s'));
  if(noticeResults.length)texts.push(noticeResults.length+' teacher announcement'+(noticeResults.length===1?'':'s'));
  return {message:'Found '+texts.join(' and ')+' in the 8aPDF library. These are the closest verified source titles; tap a result below.'+(wantAnnouncement?' Teacher message dates are not automatically test dates.':''),results:pdfResults,announcements:noticeResults};
 }
 if(wantPdf||wantAnnouncement||sub||chap||term)return{message:'No reliable match found in the currently loaded PDFs and teacher announcements. Try another subject, exact chapter or topic.',results:[],announcements:[]};
 return null;
}
async function answerAI(question,docs){
 if(!configured)return null;
 const anns=bridge()?.announcements?.()||[];
 const key=normalize(question)+'|'+docs.length+'|'+anns.length+'|'+(docs[0]?.id||'')+'|'+(anns[0]?.id||'');
 if(memory.has(key))return memory.get(key);
 const tokens=words(question);
 const score=x=>{const head=normalize([x.title,x.subject,x.category,x.chapter].join(' ')),desc=normalize([x.description,x.message,x.fullMessage].join(' '));return tokens.reduce((v,k)=>v+(head.includes(k)?7:desc.includes(k)?2:0),0)};
 const shortlist=(list,kind,size)=>{
  const good=rank(question,list,kind),seen=new Set(good.map(x=>x.id));
  const fallback=list.filter(x=>!seen.has(x.id)).sort((a,b)=>score(b)-score(a)).slice(0,Math.max(0,size-good.length));
  return [...good,...fallback].slice(0,size);
 };
 const catalog=shortlist(docs,'pdf',24).map(d=>({id:d.id,title:d.title,subject:d.subject,description:String(d.description||'').slice(0,400),chapter:d.chapter,term:d.term}));
 const dateText=v=>{if(typeof v==='string')return v.slice(0,55);try{if(v?.toDate)return v.toDate().toISOString().slice(0,10);if(typeof v?.seconds==='number')return new Date(v.seconds*1000).toISOString().slice(0,10)}catch{}return''};
 const announcements=shortlist(anns,'announcement',24).map(a=>({id:a.id,title:a.title,subject:a.subject,category:a.category,description:String(a.description||a.fullMessage||a.message||'').slice(0,500),eventDate:dateText(a.eventDate),messageDate:dateText(a.messageDate)}));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch('/api/pdf-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,catalog,announcements}),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'AI unavailable');
  const ids=new Set(Array.isArray(data.ids)?data.ids:[]),annIds=new Set(Array.isArray(data.announcementIds)?data.announcementIds:[]);
  const result={message:String(data.answer||'No confirmed match in current sources.'),results:docs.filter(d=>ids.has(d.id)).slice(0,4),announcements:anns.filter(a=>annIds.has(a.id)).slice(0,4)};
  memory.set(key,result);if(memory.size>30)memory.delete(memory.keys().next().value);
  return result;
 }catch(e){hint.textContent=e.name==='AbortError'?'Groq timed out. Local answers remain available.':'Groq unavailable: '+String(e.message||'Try again').slice(0,140);return null}
 finally{clearTimeout(timer)}
}
async function send(){
 const question=input.value.trim();if(!question||busy)return;
 input.value='';makeMessage(question,'user');
 const docs=bridge()?.documents?.()||[];
 const wantsDate=/\b(when|upcoming|next|tomorrow|due|date|kab|kal)\b/i.test(normalize(question));
 const teacherAnswer=wantsDate?window.__8apdfStudyIntel?.answer?.(question):null;
 if(teacherAnswer&&teacherAnswer.announcements?.length){showNoticeResults(teacherAnswer);return}
 const result=answerLocal(question,docs);
 if(result){showNoticeResults(result);return}
 busy=true;
 const placeholder=makeMessage('Checking PDFs and teacher announcements…');
 try{
  await checkAI();const resultAI=await answerAI(question,docs);placeholder.remove();
  if(resultAI)showNoticeResults(resultAI);
  else showResults('No confirmed answer in currently loaded PDFs or teacher messages. Ask for a specific subject, chapter or topic.',[]);
 }finally{busy=false}
}
el('pdfAiForm').addEventListener('submit',e=>{e.preventDefault();send()});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();el('pdfAiForm').requestSubmit()}});
window.__8apdfAiFinderTest={rank,answerLocal,normalize,subjectOf,chapterOf,termOf};
})();
