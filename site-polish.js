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
let unreadBusy=false;
async function refreshUnread(){
 if(unreadBusy||!visitor||!db)return;unreadBusy=true;
 try{
  const {data:members,error:memberError}=await db.from('chat_members').select('room_id,joined_at,chat_rooms(slug)').eq('user_id',visitor.id);if(memberError)throw memberError;
  activeRoomIds=new Set((members||[]).map(m=>m.room_id));
  const {data:cursors,error:cursorError}=await db.from('chat_read_cursors').select('room_id,last_read_at').eq('user_id',visitor.id);if(cursorError)throw cursorError;
  const byRoom=new Map((cursors||[]).map(c=>[c.room_id,c.last_read_at]));let total=0;
  const counts=await Promise.all((members||[]).map(async m=>{
   const {count,error}=await db.from('chat_messages').select('id',{count:'exact',head:true}).eq('room_id',m.room_id).neq('sender_id',visitor.id).gt('created_at',byRoom.get(m.room_id)||'1970-01-01T00:00:00Z');if(error)throw error;return count||0;
  }));total=counts.reduce((a,b)=>a+b,0);
  window.__8apdfUnreadCount=total;document.dispatchEvent(new CustomEvent('8apdf:chat-unread',{detail:{count:total}}));
  return members;
 }catch(e){window.__8apdfUnreadCount=null;document.dispatchEvent(new CustomEvent('8apdf:chat-unread',{detail:{count:null,error:true}}));console.warn('Unread count unavailable:',e.message)}finally{unreadBusy=false}
}
async function revealMessage(msg,roomSlug){
 if(!enabled(NOTICES_KEY)||msg.sender_id===visitor?.id||document.hidden)return;
 if(window.__8apdfPersistentPage==='chat'&&window.__8apdfActiveChatRoom===msg.room_id)return;
 const {data:p}=await db.from('chat_profiles').select('display_name').eq('id',msg.sender_id).maybeSingle();
 window.__8apdfNotices?.publish({source:'chat',id:msg.id,fingerprint:msg.created_at+'|'+msg.body,title:p?.display_name||'Friends Chat',body:textPreview(msg),open:()=>window.__8apdfOpenPage?.('/chat/'+encodeURIComponent(roomSlug||'general'))});playAlert();
}
async function initializeNotifications(){
 if(db||!window.supabase?.createClient||savedName()==='Student')return;
 try{
  db=window.supabase.createClient(SB_URL,SB_KEY,{auth:{storageKey:CHAT_AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data:{session}}=await db.auth.getSession();let user=session?.user;
  if(!user){const {data,error}=await db.auth.signInAnonymously();if(error)throw error;user=data.user}visitor=user;if(!visitor)return;
  const {error}=await db.rpc('chat_enter_lobby');if(error)throw error;
  window.__8apdfSocial={refreshUnread};
  const members=await refreshUnread()||[],roomSlugs=new Map(members.map(m=>[m.room_id,m.chat_rooms?.slug||'general']));
  if(activeRoomIds.size){
   const {data:cursors}=await db.from('chat_read_cursors').select('room_id,last_read_at').eq('user_id',visitor.id);const readMap=new Map((cursors||[]).map(c=>[c.room_id,c.last_read_at]));
   for(const m of members){const {data:latest}=await db.from('chat_messages').select('id,room_id,sender_id,body,attachment_name,created_at').eq('room_id',m.room_id).neq('sender_id',visitor.id).gt('created_at',readMap.get(m.room_id)||'1970-01-01T00:00:00Z').order('created_at',{ascending:false}).limit(1);if(latest?.[0])revealMessage(latest[0],roomSlugs.get(m.room_id)).catch(()=>{})}
  }
  channel=db.channel('8apdf_home_chat_notices').on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},({new:m})=>{if(m&&activeRoomIds.has(m.room_id)){refreshUnread();if(m.sender_id!==visitor.id)revealMessage(m,roomSlugs.get(m.room_id)).catch(()=>{})}}).subscribe();
  setInterval(()=>{if(!document.hidden)refreshUnread()},35000);
 }catch(err){db=null;console.warn('8aPDF chat status unavailable:',err?.message||err)}
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