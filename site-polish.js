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
 music.innerHTML='<h4>Background Music</h4><p>Music controls are kept here instead of floating over your notes. Browsers may need you to press Play once before allowing audio.</p>';
 container.append(music);
 const frame=document.createElement('iframe');
 frame.id='eightapdfMusicPlayerFrame';
 frame.title='Background Music - Elfsight';
 frame.src='/music-player.html?v=settings-only-20261012';
 frame.setAttribute('allow','autoplay; encrypted-media');
 frame.setAttribute('loading','eager');
 frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
 frame.style.cssText='width:100%;height:230px;min-height:210px;max-width:100%;display:block;border:0;border-radius:12px;background:transparent;overflow:hidden;';
 music.append(frame);
 /* Keep this iframe mounted even while Settings is closed.
    Its floating controls are contained inside this frame, not the website viewport,
    and playback can continue after the Settings panel closes. */

}
function htmlEscape(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function textPreview(m){return (m.body|| (m.attachment_name?'Shared '+m.attachment_name:'Sent an attachment')).slice(0,135)}
async function revealMessage(msg,roomSlug,initial=false){
 if(!enabled(NOTICES_KEY)||msg.sender_id===visitor?.id)return;
 const old=get(SEEN_KEY,'');
 if(old===msg.id&&!initial)return;
 put(SEEN_KEY,msg.id);
 if(document.hidden)return;
 const {data:p}=await db.from('chat_profiles').select('display_name').eq('id',msg.sender_id).maybeSingle();
 const author=p?.display_name||'Friend',wrap=$('eightapdfChatToastHolder')||document.createElement('div');
 if(!wrap.id){wrap.id='eightapdfChatToastHolder';wrap.className='eightapdf-chat-toasts';document.body.append(wrap)}
 const el=document.createElement('article');el.className='eightapdf-chat-alert';el.setAttribute('role','status');
 el.innerHTML='<strong>💬 '+htmlEscape(author)+'</strong><small>'+htmlEscape(initial?'A recent message from your friends':'New message · Chat with Your Friends')+'</small><p>'+htmlEscape(textPreview(msg))+'</p><button type="button" aria-label="Dismiss notification">×</button>';
 el.querySelector('button').onclick=e=>{e.stopPropagation();el.remove()};
 el.onclick=()=>{try{sessionStorage.setItem('8apdf_from_chat_v1','1')}catch{}location.href='/chat/'+encodeURIComponent(roomSlug||'general')};
 wrap.prepend(el);playAlert();
 let timer=setTimeout(()=>el.remove(),7300);
 el.onmouseenter=()=>clearTimeout(timer);
 el.onmouseleave=()=>{clearTimeout(timer);timer=setTimeout(()=>el.remove(),3200)};
}
async function initializeNotifications(){
 if(!window.supabase?.createClient||!savedName()||savedName()==='Student')return;
 try{
  db=window.supabase.createClient(SB_URL,SB_KEY,{
   auth:{storageKey:CHAT_AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  const {data:{session}}=await db.auth.getSession();let user=session?.user;
  if(!user){const {data,error}=await db.auth.signInAnonymously();if(error)throw error;user=data.user}
  visitor=user;if(!visitor)return;
  const {error}=await db.rpc('chat_enter_lobby');if(error)throw error;
  const {data:memberRows}=await db.from('chat_members').select('room_id,chat_rooms(slug)').eq('user_id',visitor.id);
  activeRoomIds=new Set((memberRows||[]).map(x=>x.room_id));
  const roomSlugs=new Map((memberRows||[]).map(x=>[x.room_id,x.chat_rooms?.slug||'general']));
  if(!activeRoomIds.size)return;
  let latestRequest=db.from('chat_messages').select('id,room_id,sender_id,body,attachment_name,created_at')
   .in('room_id',Array.from(activeRoomIds)).neq('sender_id',visitor.id)
   .order('created_at',{ascending:false}).limit(1);
  const {data:latest}=await latestRequest;
  const recent=latest?.[0];
  if(recent){
   const last=get(SEEN_KEY,'');
   if(!last){
    put(SEEN_KEY,recent.id);
    if(Date.now()-new Date(recent.created_at).getTime()<24*3600*1000)revealMessage(recent,roomSlugs.get(recent.room_id),true).catch(()=>{});
   }else if(last!==recent.id && Date.now()-new Date(recent.created_at).getTime()<24*3600*1000){
    await revealMessage(recent,roomSlugs.get(recent.room_id),true);
   }
  }
  channel=db.channel('8apdf_home_chat_notices')
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},({new:m})=>{
    if(m&&activeRoomIds.has(m.room_id)&&m.sender_id!==visitor.id)revealMessage(m,roomSlugs.get(m.room_id)).catch(()=>{});
   }).subscribe();
  setInterval(async()=>{if(document.hidden||!visitor)return;
   const {data}=await db.from('chat_members').select('room_id,chat_rooms(slug)').eq('user_id',visitor.id);
   if(data){activeRoomIds=new Set(data.map(x=>x.room_id));data.forEach(x=>roomSlugs.set(x.room_id,x.chat_rooms?.slug||'general'))}
  },90000);
 }catch(err){console.warn('8aPDF optional chat notifications unavailable:',err?.message||err)}
}
function init(){
 mountSettings();
 document.addEventListener('pointerdown',()=>{soundUnlocked=true},{once:true});
 document.addEventListener('keydown',()=>{soundUnlocked=true},{once:true});
 setTimeout(initializeNotifications,2300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();