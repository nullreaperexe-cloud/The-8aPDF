(()=>{'use strict';
let feed=[];
const ids=new Map();
const fmt=val=>{
 if(!val)return '';
 try{let d=val?.toDate?.()|| (val?.seconds?new Date(val.seconds*1000):new Date(val));if(!Number.isFinite(d.getTime()))return '';const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return o.year+'-'+o.month+'-'+o.day}catch{return ''}
};
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>fmt(new Date());
const plus=(str,n)=>{const d=new Date(str+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const done=()=>{try{return JSON.parse(localStorage.getItem('8a_auto_done_v1')||'{}')||{}}catch{return {}}};
function buildTasks(){
 const requires=/\b(test|exam|assessment|submission|submit|bring|prepare|complete|homework|assignment|worksheet|notebook|project|practical|revision|revise|practice|due|chapter)\b|परीक्षा|टेस्ट|जमा|ਅਭਿਆਸ/i;
 return feed.filter(x=>x.published===true).filter(x=>requires.test([x.title,x.message,x.fullMessage,x.description,x.category].join(' '))).slice(0,60).map(x=>{
 const text=String(x.title||x.message||x.description||'Teacher task').replace(/\s+/g,' ').slice(0,155);
 const body=[x.title,x.message,x.fullMessage,x.description].join(' ');
 let due=fmt(x.eventDate);
 const base=fmt(x.messageDate||x.createdAt);
 if(!due&&base&&/\btomorrow\b/i.test(body))due=plus(base,1);
 else if(!due&&base&&/\btoday\b/i.test(body))due=base;
 return {id:'msg:'+x.id,text,due,subject:String(x.subject||x.category||'Teacher message')}
 });
}
function markup(items){const status=done();return items.map(t=>'<label class="planner-task"><input type="checkbox" data-autotodo="'+safe(t.id)+'" '+(status[t.id]?'checked':'')+'><span><strong>'+safe(t.text)+'</strong><small>'+safe(t.due||'Date not specified')+' · '+safe(t.subject)+'</small></span></label>').join('')}
function draw(){
 const tasks=buildTasks(),now=day(),tomorrow=plus(now,1);
 const due=tasks.filter(t=>t.due===now||t.due===tomorrow);
 const confirmed=(window.__8apdfStudyIntel?.upcoming?.()||[])
   .filter(e=>e.date===now||e.date===tomorrow)
   .map(e=>({id:'teacher-event:'+e.id,text:e.title,due:e.date,subject:e.subject||'Teacher message'}))
   .filter(e=>!due.some(t=>t.text.toLowerCase()===e.text.toLowerCase()));
 const undated=tasks.filter(t=>!t.due && /\b(test|exam|quiz|assessment)\b|परीक्षा|ਟेस्ट/i.test(t.text)).slice(0,3);
 const list=document.getElementById('smartTasks'),summary=document.getElementById('smartDue');
 if(!list||!summary)return;
 list.innerHTML=tasks.length?markup(tasks.slice(0,6)):'<div class="planner-empty">No clear task instruction detected yet. See Teacher Messages for other updates.</div>';
 const items=[...due,...confirmed].slice(0,5);
 summary.innerHTML=(items.length?markup(items):'<div class="planner-empty">No tests or submissions with a confirmed date for today or tomorrow.</div>')+
 (undated.length?'<div class="ws-due-unconfirmed">Test mentioned · date still unconfirmed</div>'+markup(undated):'');
}
document.addEventListener('8apdf:teacher-data',e=>{feed=Array.isArray(e.detail)?e.detail:[];draw()});
document.getElementById('newSchoolPlanner')?.addEventListener('change',e=>{
 const b=e.target.closest('[data-autotodo]');if(!b)return;
 const current=done();current[b.dataset.autotodo]=b.checked;
 try{localStorage.setItem('8a_auto_done_v1',JSON.stringify(current))}catch{}
 draw();
});

function personalTasks(){try{const x=JSON.parse(localStorage.getItem('8apdf_tasks_v1')||'[]');return Array.isArray(x)?x:[]}catch{return []}}
const taskView={filter:'pending',query:'',limit:12};
function paintTaskModal(){
 const root=document.getElementById('fullTaskCenter');if(!root)return;
 const modal=root.closest('.dialog'),previousScroll=modal?.scrollTop||0;
 const editing=document.activeElement?.id==='plannerTaskSearch';
 const selection=editing?document.activeElement.selectionStart:0;
 const automatic=buildTasks(),personal=personalTasks(),checked=done(),now=day();
 const completed=automatic.filter(t=>checked[t.id]).length+personal.filter(t=>t.done).length;
 const pending=automatic.length+personal.length-completed;
 const match=(t,own)=>{
  const finished=own?!!t.done:!!checked[t.id];
  if(taskView.filter==='pending'&&finished)return false;
  if(taskView.filter==='completed'&&!finished)return false;
  const q=taskView.query.toLowerCase();
  return !q||[t.text,t.subject,t.due,own?'personal':'teacher'].join(' ').toLowerCase().includes(q);
 };
 const score=t=>t.due?(t.due>=now?0:2):1;
 const teachers=automatic.slice().sort((a,b)=>score(a)-score(b)||(a.due&&b.due?a.due.localeCompare(b.due):0)).filter(t=>match(t,false));
 const ownTasks=personal.filter(t=>match(t,true));
 const fmtDue=t=>!t.due?'Date not confirmed':t.due===now?'Today':t.due===plus(now,1)?'Tomorrow':t.due;
 const task=(t,own)=>{
  const id=String(t.id||''),finished=own?!!t.done:!!checked[id];
  const due=own?'My task':fmtDue(t),subject=own?'Personal':String(t.subject||'Teacher message');
  return '<div class="planner-task todo-item'+(finished?' todo-finished':'')+'">'+
   '<label class="todo-checkbox-label"><input type="checkbox" '+(own?'data-personal-todo="':'data-all-autotodo="')+safe(id)+'" '+(finished?'checked':'')+' aria-label="Mark '+safe(t.text)+' as '+(finished?'not done':'done')+'">'+
   '<span class="todo-copy"><strong>'+safe(t.text)+'</strong><span class="todo-meta"><span class="todo-subject">'+safe(subject)+'</span><span class="todo-due">'+safe(due)+'</span></span></span></label>'+
   (own?'<button type="button" class="planner-delete" data-remove-personal="'+safe(id)+'" aria-label="Remove personal task">×</button>':'')+
   '</div>';
 };
 const section=(title,list)=>{
  const shown=list.slice(0,taskView.limit);
  return '<section class="todo-section"><div class="todo-section-heading"><h3>'+title+'</h3><small>'+list.length+' matching</small></div>'+
   (shown.length?'<div class="todo-items">'+shown.map(t=>task(t,title==='My personal tasks')).join('')+'</div>':
    '<p class="todo-empty">'+(taskView.query?'No matching tasks. Try another word.':taskView.filter==='completed'?'Nothing completed here yet.':'All clear in this section ✓')+'</p>')+
   (list.length>shown.length?'<button type="button" class="todo-show-more" data-todo-more>Show more · '+shown.length+' of '+list.length+'</button>':'')+'</section>';
 };
 root.innerHTML='<p class="planner-modal-intro">Your school checklist, organized. Tick an item when it is done—progress stays saved on this device.</p>'+
  '<div class="todo-stats"><span><strong>'+pending+'</strong> Pending</span><span><strong>'+completed+'</strong> Completed</span><span><strong>'+automatic.length+'</strong> Teacher tasks</span></div>'+
  '<div class="todo-toolbar"><label for="plannerTaskSearch">Search<input type="search" id="plannerTaskSearch" placeholder="Search a task or subject…" autocomplete="off" value="'+safe(taskView.query)+'"></label>'+
  '<label for="plannerTaskView">Show<select id="plannerTaskView"><option value="pending" '+(taskView.filter==='pending'?'selected':'')+'>Pending</option><option value="all" '+(taskView.filter==='all'?'selected':'')+'>All tasks</option><option value="completed" '+(taskView.filter==='completed'?'selected':'')+'>Completed</option></select></label></div>'+
  section('Teacher-assigned tasks',teachers)+
  '<section class="todo-add-section"><h3>Add a personal task</h3><form id="plannerAddTask"><input required id="plannerNewText" maxlength="170" aria-label="New task" placeholder="e.g. Finish Science chapter 8"><button type="submit" class="solid">Add task</button></form></section>'+
  section('My personal tasks',ownTasks);
 if(modal)modal.scrollTop=previousScroll;
 if(editing){const input=document.getElementById('plannerTaskSearch');if(input){input.focus({preventScroll:true});if(selection!=null)try{input.setSelectionRange(selection,selection)}catch{}}}
}

function openTaskCenter(){
 const modal=document.getElementById('modal');if(!modal)return;
 document.getElementById('modalTitle').textContent='My Study To-Do';
 document.getElementById('modalContent').innerHTML='<div id="fullTaskCenter"></div>';
 document.getElementById('modalActions').innerHTML='';
 modal.classList.add('open');modal.setAttribute('aria-hidden','false');
 document.body.classList.add('no-scroll');
 paintTaskModal();
}
window.__8apdfOpenTasks=openTaskCenter;
document.getElementById('modal')?.addEventListener('change',event=>{
 if(!document.getElementById('fullTaskCenter'))return;
 const input=event.target;
 if(input.id==='plannerTaskView'){taskView.filter=input.value;taskView.limit=12;paintTaskModal();return}
 if(input.matches('[data-all-autotodo]')){
   const status=done();status[input.dataset.allAutotodo]=input.checked;
   try{localStorage.setItem('8a_auto_done_v1',JSON.stringify(status))}catch{}
   draw();paintTaskModal();
 }
 if(input.matches('[data-personal-todo]')){
   const existing=document.querySelector('#notesList input[data-task-check="'+input.dataset.personalTodo+'"]');
   if(existing){existing.checked=input.checked;existing.dispatchEvent(new Event('change',{bubbles:true}))}
   paintTaskModal();
 }
});
document.getElementById('modal')?.addEventListener('click',event=>{
 if(!document.getElementById('fullTaskCenter'))return;
 if(event.target.closest('[data-todo-more]')){taskView.limit+=18;paintTaskModal();return}
 const button=event.target.closest('[data-remove-personal]');
 if(!button)return;
 const original=document.querySelector('#notesList button[data-task-delete="'+button.dataset.removePersonal+'"]');
 original?.click();paintTaskModal();
});
document.getElementById('modal')?.addEventListener('input',event=>{
 if(event.target.id!=='plannerTaskSearch'||!document.getElementById('fullTaskCenter'))return;
 taskView.query=event.target.value;taskView.limit=12;paintTaskModal();
});
document.getElementById('modal')?.addEventListener('submit',event=>{
 if(event.target.id!=='plannerAddTask')return;
 event.preventDefault();
 const field=document.getElementById('plannerNewText'),text=field?.value.trim();
 if(!text)return;
 const original=document.getElementById('newNote'),form=document.getElementById('noteForm');
 if(original&&form){original.value=text;form.requestSubmit();paintTaskModal()}
});

draw();
})();
