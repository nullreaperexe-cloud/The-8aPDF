/* 8aPDF home: message notices, settings controls and contained music experience. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SB_URL='https://uumqvvsfqwpwtwerdylv.supabase.co';
const SB_KEY='sb_publishable_M1C4bP9ijOsm08ugE1uJig_ERVxR-zi';
const NOTICES_KEY='8apdf_chat_notices_v1', SOUND_KEY='8apdf_chat_sound_v1', SEEN_KEY='8apdf_last_chat_notice_v1';
const CHAT_AUTH_KEY='8apdf_social_auth_v2';
const get=(k,fall)=>{try{return localStorage.getItem(k)??fall}catch{return fall}};
const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
const enabled=key=>get(key,'on')!=='off';
const savedName=()=>get('eightapdf_user_name_v2',get('eightapdf_user_name','Student'))?.trim()||'Student';
let db=null,visitor=null,channel=null,activeRoomIds=new Set(),seenAtStartup='',soundUnlocked=false,audioContext=null;
function playAlert(){
 if(!soundUnlocked||!enabled(SOUND_KEY))return;
 try{
 const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
 audioContext ||=new A();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
 const now=audioContext.currentTime,os=audioContext.createOscillator(),gain=audioContext.createGain();
 os.type='sine';os.frequency.setValueAtTime(690,now);os.frequency.setValueAtTime(900,now+.06);
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.065,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.17);
 os.connect(gain);gain.connect(audioContext.destination);os.start(now);os.stop(now+.18);
 }catch{}
}
function mountSettings(){
 const container=$('studioUiSetting')||document.querySelector('#settingsPanel .setting-body');
 if(!container||$('eightapdfSettingsChat'))return;
 const notifications=document.createElement('div');notifications.className='eightapdf-settings-chat';notifications.id='eightapdfSettingsChat';
 notifications.innerHTML='<h4>Friends Chat · Notifications</h4><p>Control premium pop-up alerts when messages arrive. These preferences only affect this browser.</p>'+
 '<label class="eightapdf-setting-toggle"><span>New message animations</span><input type="checkbox" id="eightapdfEnableChatNotices"></label>'+
 '<label class="eightapdf-setting-toggle"><span>Message beep</span><input type="checkbox" id="eightapdfEnableChatSound"></label>';
 container.append(notifications);
 const notices=$('eightapdfEnableChatNotices'),sound=$('eightapdfEnableChatSound');
 notices.checked=enabled(NOTICES_KEY);sound.checked=enabled(SOUND_KEY);
 notices.addEventListener('change',()=>put(NOTICES_KEY,notices.checked?'on':'off'));
 sound.addEventListener('change',()=>put(SOUND_KEY,sound.checked?'on':'off'));
 const music=document.createElement('div');music.className='eightapdf-settings-music';music.id='eightapdfSettingsMusic';
 music.innerHTML='<h4>Background Music</h4><p>Music stays connected while you browse PDFs and Friends Chat. Your browser may need one tap on Play.</p>';
 container.append(music);
 music.innerHTML+='<button type="button" id="eightapdfShowMusic">Open music controls</button>';
 music.querySelector('button').onclick=()=>window.__8apdfMusic?.show?.();

}
function htmlEscape(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function textPreview(m){return (m.body|| (m.attachment_name?'Shared '+m.attachment_name:'Sent an attachment')).slice(0,135)}
let connecting=null,unreadBusy=false,unreadAgain=false,rooms=[];
async function socialClient(){
 if(connecting)return connecting;
 connecting=(async()=>{
  if(!window.supabase?.createClient)throw Error('Chat service is loading');
  db=window.supabase.createClient(SB_URL,SB_KEY,{auth:{storageKey:CHAT_AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let {data:{session},error}=await db.auth.getSession();if(error)throw error;
  if(!session){const result=await db.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session}
  visitor=session.user;
  for(const fn of ['chat_enter_lobby','chat_bootstrap_read_state']){const result=await db.rpc(fn);if(result.error)throw result.error}
  db.auth.onAuthStateChange((event,session)=>{if(session?.user&&visitor?.id!==session.user.id){visitor=session.user;setTimeout(refreshUnread,0)}});
  return {db,user:visitor};
 })().catch(error=>{connecting=null;throw error});return connecting;
}
window.__8apdfGetSocialClient=socialClient;
async function refreshUnread(){
 if(unreadBusy){unreadAgain=true;return}unreadBusy=true;
 try{
  await socialClient();
  do{unreadAgain=false;const {data,error}=await db.rpc('chat_unread_counts');if(error)throw error;rooms=data||[];
   activeRoomIds=new Set(rooms.map(r=>r.room_id));const count=rooms.reduce((sum,r)=>sum+Number(r.unread_count||0),0);
   window.__8apdfUnreadCount=count;put('8apdf_unread_cache_v2:'+visitor.id,JSON.stringify({count,at:Date.now()}));document.dispatchEvent(new CustomEvent('8apdf:chat-unread',{detail:{count}}));
  }while(unreadAgain);
  return rooms;
 }catch(e){console.warn('Unread count refresh:',e.message)}finally{unreadBusy=false}
}
async function markAllRead(){await socialClient();const result=await db.rpc('chat_mark_all_read');if(result.error)throw result.error;await refreshUnread();put('8apdf_chat_read_changed',Date.now())}
window.__8apdfSocial={refreshUnread,markAllRead};
async function revealMessage(msg,roomSlug){
 if(!enabled(NOTICES_KEY)||msg.sender_id===visitor?.id||document.hidden)return;
 if(window.__8apdfPersistentPage==='chat'&&window.__8apdfActiveChatRoom===msg.room_id)return;
 const {data:p}=await db.from('chat_profiles').select('display_name').eq('id',msg.sender_id).maybeSingle();
 window.__8apdfNotices?.publish({source:'chat',id:msg.id,fingerprint:msg.created_at+'|'+msg.body,title:p?.display_name||'Friends Chat',body:textPreview(msg),open:()=>window.__8apdfOpenPage?.('/chat/'+encodeURIComponent(roomSlug||'general'))});playAlert();
}
async function initializeNotifications(){
 if(channel||!window.supabase?.createClient||savedName()==='Student')return;
 try{
  await socialClient();const cached=get('8apdf_unread_cache_v2:'+visitor.id,'');try{const saved=JSON.parse(cached);if(Number.isInteger(saved.count)){window.__8apdfUnreadCount=saved.count;document.dispatchEvent(new Event('8apdf:chat-unread'))}}catch{}
  await refreshUnread();
  for(const r of rooms.filter(r=>Number(r.unread_count)>0)){const {data:latest}=await db.from('chat_messages').select('id,room_id,sender_id,body,attachment_name,created_at').eq('room_id',r.room_id).neq('sender_id',visitor.id).gt('created_at',r.last_read_at).order('created_at',{ascending:false}).limit(1);if(latest?.[0])revealMessage(latest[0],r.room_slug).catch(()=>{})}
  channel=db.channel('8apdf_home_chat_notices').on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},({new:m})=>{if(m&&activeRoomIds.has(m.room_id)){refreshUnread();if(m.sender_id!==visitor.id)revealMessage(m,rooms.find(r=>r.room_id===m.room_id)?.room_slug).catch(()=>{})}}).subscribe();
  setInterval(()=>{if(!document.hidden)refreshUnread()},35000);
 }catch(err){console.warn('8aPDF chat status unavailable:',err.message)}
}
window.addEventListener('storage',event=>{if(event.key==='8apdf_chat_read_changed')refreshUnread()});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='8apdf:chat-read')refreshUnread()});
function init(){
 mountSettings();
 document.addEventListener('pointerdown',()=>{soundUnlocked=true},{once:true});
 document.addEventListener('keydown',()=>{soundUnlocked=true},{once:true});
 setTimeout(initializeNotifications,150);document.getElementById('nameForm')?.addEventListener('submit',()=>setTimeout(initializeNotifications,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();