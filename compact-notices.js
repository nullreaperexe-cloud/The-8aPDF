(()=>{'use strict';
const KEY='8apdf_compact_notices_v1';let policy=null,saved={seen:{}},pending=new Map(),showing=false,timer=0;
try{saved=JSON.parse(localStorage.getItem(KEY)||'null')||saved}catch{}
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const today=day(),firstOpening=saved.openedDay!==today;saved.openedDay=today;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{}};save();
const readyAt=5000;
import('/shared/notification-policy.js').then(module=>{policy=module;flush()});
function publish(item){if(!item?.id||!item.title)return;const key=(item.source||'school')+':'+item.id;pending.set(key,{...item,key,fingerprint:String(item.fingerprint||item.id)});flush()}
function flush(){
 clearTimeout(timer);if(showing||!pending.size||!policy)return;
 if(document.hidden||document.querySelector('#welcomeScreen.show,#nameModal.show')){timer=setTimeout(flush,250);return;}
 const delay=readyAt-performance.now();if(delay>0){timer=setTimeout(flush,delay);return;}
 const items=[...pending.values()].filter(x=>notificationAllowed(x));pending.clear();if(!items.length)return;
 const first=items[0],holder=document.getElementById('compactNoticeHolder')||document.createElement('div');
 if(!holder.id){holder.id='compactNoticeHolder';holder.className='compact-notice-holder';document.body.append(holder)}
 const toast=document.createElement('aside');toast.className='compact-notice';toast.setAttribute('role','status');
 const text=document.createElement('button');text.type='button';text.className='compact-notice-content';const title=document.createElement('strong');title.textContent=items.length>1?items.length+' new school/chat updates':first.title;const line=document.createElement('span');line.textContent=first.body||'Open to view';text.append(title,line);text.onclick=()=>{first.open?.();dismiss()};
 const close=document.createElement('button');close.type='button';close.className='compact-notice-close';close.setAttribute('aria-label','Dismiss notification');close.textContent='×';close.onclick=()=>dismiss();toast.append(text,close);holder.append(toast);
 items.forEach(x=>policy.recordNotification(saved,x.key,x.fingerprint,today));save();showing=true;
 let dismissTimer=setTimeout(dismiss,3000);
 function dismiss(){clearTimeout(dismissTimer);if(toast.classList.contains('leaving'))return;toast.classList.add('leaving');setTimeout(()=>{toast.remove();showing=false;flush()},240)}
}
function notificationAllowed(item){return policy.notificationAllowed(saved,item.key,item.fingerprint,today,firstOpening)}
window.__8apdfNotices={publish,firstOpening,readyAt};document.addEventListener('visibilitychange',flush);
})();
