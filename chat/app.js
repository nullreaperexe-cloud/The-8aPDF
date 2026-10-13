/* 8aPDF Friends Chat — secure, persistent multi-device client */
(() => {
'use strict';
const SUPABASE_URL='https://uumqvvsfqwpwtwerdylv.supabase.co';
const KEY='sb_publishable_M1C4bP9ijOsm08ugE1uJig_ERVxR-zi';
const BUCKET='8apdf-chat-uploads';
const MAX=8*1024*1024;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const icon=n=>'<svg aria-hidden="true"><use href="#i-'+n+'"></use></svg>';
const when=d=>{const t=new Date(d);return t.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
const shortAgo=d=>{if(!d)return 'Offline';const n=Math.max(0,Math.floor((Date.now()-new Date(d).getTime())/60000));return n<1?'Just now':n<60?n+' min ago':n<1440?Math.floor(n/60)+'h ago':Math.floor(n/1440)+'d ago'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const state={sb:null,user:null,displayName:'Student',room:null,rooms:[],members:[],profiles:new Map(),messages:[],pending:[],oldest:null,more:false,loadingOlder:false,refreshing:false,channel:null,presence:null,onlineIds:new Set(),fileUrls:new Map(),lastSignature:'',currentRoomChange:0,invitesShown:new Set(),initError:null,replyTo:null,reactions:new Map(),reactionsLoaded:false,messageInitialized:false,siteAdmin:false,lastInbound:new Map()};
function notify(message,bad=false){const holder=$('toastStack');const n=document.createElement('div');n.className='toast'+(bad?' error':'');n.textContent=message;holder.append(n);setTimeout(()=>n.remove(),5000)}
function showConnection(text,ready=false){$('connectionBadge').innerHTML='<span class="status-light '+(ready?'':'off')+'"></span> '+esc(text);$('identityStatus').textContent=ready?'Connected privately':'Connection issue'}
function nameFromSite(){try{return (localStorage.getItem('eightapdf_user_name_v2')||localStorage.getItem('eightapdf_user_name')||'').trim().slice(0,40)||'Student'}catch{return 'Student'}}
function hideMobile(){ $('chatSidebar').classList.remove('open');$('membersPanel').classList.remove('open');$('mobileBackdrop').hidden=true }
function toggleMobile(which){const el=$(which);const opening=!el.classList.contains('open');hideMobile();if(opening){el.classList.add('open');$('mobileBackdrop').hidden=false}}
function showDialog(title,content,buttons=[],kicker='8aPDF CHAT'){const d=$('actionDialog');$('dialogTitle').textContent=title;$('dialogKicker').textContent=kicker;$('dialogContent').innerHTML=content;$('dialogFooter').innerHTML='';const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>d.close();$('dialogFooter').append(cancel);buttons.forEach(({label,act,primary=true})=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=primary?'confirm':'';b.onclick=()=>Promise.resolve(act(b)).catch(e=>notify(e.message||'Could not complete action',true));$('dialogFooter').append(b)});d.showModal()}
function closeDialog(){$('actionDialog').close()}
function ensureReady(){if(!state.user)throw Error('Chat session not ready. Try reloading.')}
function urlForRoom(slug,token=''){return location.origin+'/chat/'+encodeURIComponent(slug)+(token?'?invite='+encodeURIComponent(token):'')}
async function copyText(s){try{await navigator.clipboard.writeText(s);notify('Invite link copied')}catch{showDialog('Copy invite link','<p>Copy and share this link with a friend.</p><div class="dialog-result">'+esc(s)+'</div>',[])}}
function normalizeSlug(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)}
let startingChat=false;
let chatRetryTimer=null;
function showChatRecovery(error){
 const msg=String(error?.message||'Unknown connection error');
 const anonDisabled=/anonymous\s+sign[- ]?ins?\s+(are\s+)?disabled|anonymous\s+users?\s+disabled/i.test(msg);
 showConnection(anonDisabled?'Guest sign-in disabled':'Connection issue');
 $('roomList').innerHTML='<div class="list-loading">Chat will appear once connected.</div>';
 $('memberCount').textContent='0';
 $('membersList').replaceChildren();
 $('messageInput').disabled=true;$('sendButton').disabled=true;$('mediaInput').disabled=true;
 $('identityStatus').textContent=anonDisabled?'Waiting for guest access':'Chat disconnected';
 $('messages').innerHTML='<div class="intro-space"><div class="intro-icon">'+icon('lock')+'</div><h3>'+
 (anonDisabled?'Guest access needs to be enabled':'Unable to connect right now')+
 '</h3><p>'+(anonDisabled?'The Supabase owner must enable Anonymous Sign-Ins once. No name form, email or password will be required.':'Please retry. If this continues, report the error below to the site owner.')+
 '</p><div class="chat-recovery-actions"><button type="button" class="connection-setup-button" id="retryChat">Retry connection</button>'+
 (anonDisabled?'<a class="connection-help-link" href="https://supabase.com/dashboard/project/uumqvvsfqwpwtwerdylv/auth/providers" target="_blank" rel="noopener noreferrer">Owner: enable guest sign-in ↗</a>':'')+
 '</div><p class="connection-error-detail">'+esc(msg)+'</p></div>';
 $('retryChat').addEventListener('click',()=>start());
 if(anonDisabled&&!chatRetryTimer){chatRetryTimer=setInterval(()=>{if(!document.hidden&&!state.user&&!startingChat)start()},45000)}
}
async function start(){
 if(startingChat||state.user)return;
 startingChat=true;
 try {
 state.displayName=nameFromSite();$('sideName').textContent=state.displayName;
 $('miniAvatar').textContent=state.displayName[0].toUpperCase();$('railAvatar').textContent=state.displayName[0].toUpperCase();
 if(!window.supabase?.createClient){showConnection('Service unavailable');notify('Chat library could not load. Check internet / ad blocker.',true);return}
 if(window.parent!==window&&parent.__8apdfGetSocialClient){const shared=await parent.__8apdfGetSocialClient();state.sb=shared.db;}else state.sb=window.supabase.createClient(SUPABASE_URL,KEY,{auth:{storageKey:'8apdf_social_auth_v2',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:12}}});
 try{
  let {data:{session},error:sessionError}=await state.sb.auth.getSession();if(sessionError)throw sessionError;
  if(!session){const result=await state.sb.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session}
  if(!session?.user)throw Error('Unable to initialize guest session');
  state.user=session.user;
  await upsertProfile();
  await refreshSiteAdmin();
  await state.sb.rpc('chat_enter_lobby').then(({error})=>{if(error)throw error});
  await state.sb.rpc('chat_bootstrap_read_state').then(({error})=>{if(error)throw error});
  const match=location.pathname.match(/^\/chat\/([a-zA-Z0-9-]{2,48})\/?$/);
  const slug=new URLSearchParams(location.search).get('room')||(match?match[1]:'general');
  try{await openRoom(slug,new URLSearchParams(location.search).get('invite'),false)}
  catch(e){notify((e.message||'Cannot enter room')+'. Opening General Chat.',true);await openRoom('general',null,false)}
  showConnection('Live',true);
  $('messageInput').disabled=false;$('sendButton').disabled=false;$('mediaInput').disabled=false;
  if(chatRetryTimer){clearInterval(chatRetryTimer);chatRetryTimer=null}
  await loadRooms();
  await checkInvites();
  setInterval(()=>{if(!document.hidden&&state.user)heartbeat().catch(()=>{})},20000);
  setInterval(()=>{if(!document.hidden&&state.room){loadMessages(false).catch(()=>{});loadMembers().catch(()=>{});checkInvites().catch(()=>{})}},11000);
  window.addEventListener('focus',()=>{heartbeat().catch(()=>{});loadMessages(false).catch(()=>{});loadMembers().catch(()=>{})});
  window.addEventListener('storage',e=>{if(['eightapdf_user_name_v2','eightapdf_user_name'].includes(e.key)){state.displayName=nameFromSite();upsertProfile().catch(()=>{})}});
 }catch(e){
  state.initError=e;
  state.user=null;
  showChatRecovery(e);
  notify('Could not connect: '+(e.message||'Unknown error'),true);
 }
} finally {startingChat=false}
}
async function upsertProfile(){
 if(!state.user)return;
 const {error}=await state.sb.from('chat_profiles').upsert({id:state.user.id,display_name:state.displayName,last_seen:new Date().toISOString()},{onConflict:'id'});
 if(error)throw error;
 state.profiles.set(state.user.id,{id:state.user.id,display_name:state.displayName,last_seen:new Date().toISOString()});
}
async function heartbeat(){if(!state.user)return;const {error}=await state.sb.from('chat_profiles').update({last_seen:new Date().toISOString()}).eq('id',state.user.id);if(error)console.warn('Presence heartbeat failed',error.message);if(state.presence)await state.presence.track({user_id:state.user.id,display_name:state.displayName})}
async function loadRooms(){
 if(!state.user)return;
 const {data,error}=await state.sb.from('chat_members').select('role,room_id,chat_rooms(id,slug,name,kind,owner_id,created_at)').eq('user_id',state.user.id).order('joined_at',{ascending:false});
 if(error){console.warn(error.message);return}
 const entries=(data||[]).filter(v=>v.chat_rooms).map(v=>({...v.chat_rooms,role:v.role}));
 entries.sort((a,b)=>a.slug==='general'?-1:b.slug==='general'?1:new Date(b.created_at)-new Date(a.created_at));
 state.rooms=entries;renderRooms();
}
function renderRooms(){
 const list=$('roomList');if(!state.rooms.length){list.innerHTML='<div class="list-loading">No conversations yet. Create one!</div>';return}
 list.innerHTML=state.rooms.map(r=>'<button class="room-item '+(r.id===state.room?.id?'selected':'')+'" data-room="'+esc(r.slug)+'" type="button"><span class="room-icon">'+(r.kind==='private'?icon('lock'):'#')+'</span><span class="room-text"><strong>'+esc(r.name)+'</strong><small>'+esc(r.kind==='private'?'Private conversation':'# '+r.slug)+'</small></span>'+icon('chevron')+'</button>').join('');
 list.querySelectorAll('[data-room]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.room)));
}
async function openRoom(slug,token=null,changeUrl=true){
 ensureReady();const run=++state.currentRoomChange;
 const {data:id,error:joinError}=await state.sb.rpc('chat_join_room',{p_slug:slug,p_token:token||null});if(joinError)throw joinError;
 const {data:room,error}=await state.sb.from('chat_rooms').select('*').eq('id',id).single();if(error)throw error;
 if(run!==state.currentRoomChange)return;
 if(state.channel)await state.sb.removeChannel(state.channel);
 if(state.presence)await state.sb.removeChannel(state.presence);
 state.room=room;state.messages=[];state.pending=[];state.oldest=null;state.more=false;state.lastSignature='';state.onlineIds.clear();state.replyTo=null;state.reactions=new Map();state.reactionsLoaded=false;state.messageInitialized=false;updateReplyDraft();
 $('roomTitle').textContent=room.name;$('roomSubtitle').textContent=room.kind==='private'?'Private conversation · Invite-only':'# '+room.slug+' · Your friends are here';
 $('topicIcon').innerHTML=room.kind==='private'?icon('lock'):'#';
 $('messages').innerHTML='';$('loadOlder').hidden=true;hideMobile();
 if(changeUrl){if(window.parent!==window)history.replaceState({room:slug},'','/chat-frame.html?embedded=1&room='+encodeURIComponent(slug));else history.pushState({room:slug},'',urlForRoom(slug));}if(window.parent!==window)parent.postMessage({type:'8apdf:chat-route',path:'/chat/'+encodeURIComponent(slug),roomId:room.id},location.origin);document.title=room.name+' · 8aPDF';
 renderRooms();
 await Promise.all([loadMessages(true),loadMembers(),loadRooms()]);
 if(run!==state.currentRoomChange)return;
 setupRealtime(room);
}
function setupRealtime(room){
 state.channel=state.sb.channel('chat_messages_'+room.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:'room_id=eq.'+room.id},()=>loadMessages(false).catch(()=>{}))
  .on('postgres_changes',{event:'*',schema:'public',table:'chat_reactions'},()=>{loadReactions().then(()=>{state.lastSignature='';renderMessages()}).catch(()=>{})})
  .subscribe(status=>{if(status==='SUBSCRIBED')showConnection('Live',true);if(status==='CHANNEL_ERROR')showConnection('Reconnecting…',false)});
 state.presence=state.sb.channel('8apdf_presence_'+room.id,{config:{presence:{key:state.user.id}}})
  .on('presence',{event:'sync'},()=>{
   state.onlineIds=new Set(Object.keys(state.presence.presenceState()));renderMembers();
  }).on('broadcast',{event:'typing'},({payload})=>{if(!payload||payload.user_id===state.user.id)return;const p=state.profiles.get(payload.user_id);$('typingStatus').textContent=(p?.display_name||payload?.display_name||'Someone')+' is typing…';clearTimeout(typingTimeout);typingTimeout=setTimeout(()=>$('typingStatus').textContent='',1500)})
  .subscribe(async status=>{if(status==='SUBSCRIBED')await state.presence.track({user_id:state.user.id,display_name:state.displayName})});
}
let typingTimeout,typingSent=0;
function sendTyping(){if(state.presence&&Date.now()-typingSent>1300){typingSent=Date.now();state.presence.send({type:'broadcast',event:'typing',payload:{user_id:state.user.id,display_name:state.displayName}}).catch(()=>{})}}
async function loadMessages(reset=false){
 if(!state.room||state.refreshing)return;state.refreshing=true;const currentRoom=state.room.id;
 try{
  const {data,error}=await state.sb.from('chat_messages').select('id,room_id,sender_id,body,attachment_path,attachment_name,attachment_type,created_at,reply_to').eq('room_id',currentRoom).order('created_at',{ascending:false}).limit(120);
  if(error)throw error;if(currentRoom!==state.room?.id)return;
  const updated=(data||[]).reverse();state.more=(data||[]).length===120;$('loadOlder').hidden=!state.more;
  if(!reset&&state.messages.length>120){
   const seen=new Set(updated.map(x=>x.id));state.messages=state.messages.filter(x=>!seen.has(x.id)).concat(updated);
  }else state.messages=updated;
  state.oldest=state.messages[0]?.created_at||null;
  await loadReactions();
  const senderIds=[...new Set(state.messages.map(m=>m.sender_id))];await loadProfiles(senderIds);
  renderMessages();
  const inbound=updated.filter(m=>m.sender_id!==state.user?.id);
  if(inbound.length){const newest=inbound.at(-1);const oldId=state.lastInbound.get(currentRoom);if(state.messageInitialized&&oldId&&oldId!==newest.id)playMessageBeep();state.lastInbound.set(currentRoom,newest.id)}
  state.messageInitialized=true;requestAnimationFrame(()=>requestAnimationFrame(markVisibleRead));
 }catch(e){console.warn('Cannot refresh chat',e.message);if(reset)notify('Messages could not load: '+e.message,true)}
 finally{state.refreshing=false}
}
async function loadOlder(){
 if(!state.more||!state.oldest||state.loadingOlder)return;state.loadingOlder=true;const room=state.room?.id;
 const {data,error}=await state.sb.from('chat_messages').select('id,room_id,sender_id,body,attachment_path,attachment_name,attachment_type,created_at,reply_to').eq('room_id',room).lt('created_at',state.oldest).order('created_at',{ascending:false}).limit(120);
 state.loadingOlder=false;if(error){notify(error.message,true);return}if(room!==state.room?.id)return;
 const batch=(data||[]).reverse();state.more=(data||[]).length===120;$('loadOlder').hidden=!state.more;const seen=new Set(state.messages.map(m=>m.id));
 state.messages=batch.filter(m=>!seen.has(m.id)).concat(state.messages);state.oldest=state.messages[0]?.created_at;
 await loadProfiles(batch.map(m=>m.sender_id));await loadReactions();renderMessages(true);
}
async function loadProfiles(ids){
 const missing=[...new Set(ids)].filter(id=>id&&!state.profiles.has(id));if(!missing.length)return;
 const {data,error}=await state.sb.from('chat_profiles').select('id,display_name,last_seen').in('id',missing.slice(0,150));
 if(!error)(data||[]).forEach(p=>state.profiles.set(p.id,p));
}

const REACTION_EMOJIS=['❤️','😂','👍','😮','😢','🔥','👏','🎉'];
async function loadReactions(){
 if(!state.room||!state.sb)return;
 const ids=state.messages.map(m=>m.id).filter(Boolean);
 if(!ids.length){state.reactions=new Map();return}
 const {data,error}=await state.sb.from('chat_reactions').select('message_id,user_id,emoji').in('message_id',ids.slice(-300));
 if(error){console.warn('Reactions:',error.message);return}
 state.reactions=new Map();
 (data||[]).forEach(r=>{const a=state.reactions.get(r.message_id)||[];a.push(r);state.reactions.set(r.message_id,a)});
}
function renderReactions(messageId){
 const items=state.reactions.get(messageId)||[];
 const totals=REACTION_EMOJIS.map(emoji=>({emoji,users:items.filter(r=>r.emoji===emoji)})).filter(t=>t.users.length);
 return '<div class="reaction-list">'+totals.map(t=>'<button type="button" class="reaction-pill '+(t.users.some(u=>u.user_id===state.user.id)?'mine-reaction':'')+'" data-react="'+esc(messageId)+'" data-emoji="'+esc(t.emoji)+'">'+esc(t.emoji)+' <span>'+t.users.length+'</span></button>').join('')+'</div>';
}
function updateReplyDraft(){
 const d=$('replyDraft');if(!d)return;
 const m=state.replyTo;d.hidden=!m;
 if(!m)return;
 $('replyDraftAuthor').textContent=state.profiles.get(m.sender_id)?.display_name||'Friend';
 $('replyDraftText').textContent=(m.body||m.attachment_name||'Attachment').slice(0,160);
}
function beginReply(messageId){
 const m=state.messages.find(x=>x.id===messageId);
 if(!m)return;
 state.replyTo=m;updateReplyDraft();$('messageInput').focus();
}
async function toggleReaction(messageId,emoji){
 const existing=(state.reactions.get(messageId)||[]).some(r=>r.user_id===state.user.id&&r.emoji===emoji);
 const query=state.sb.from('chat_reactions');
 const {error}=existing?
 await query.delete().eq('message_id',messageId).eq('emoji',emoji).eq('user_id',state.user.id):
 await query.insert({message_id:messageId,user_id:state.user.id,emoji});
 if(error){notify(error.message,true);return}
 await loadReactions();state.lastSignature='';renderMessages();
}
let audioContext=null,userActivated=false;
function playMessageBeep(){
 try{
  if(!userActivated||localStorage.getItem('8apdf_chat_sound_v1')==='off')return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  audioContext=audioContext||new Audio();
  if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  const t=audioContext.currentTime,g=audioContext.createGain(),o=audioContext.createOscillator();
  o.type='sine';o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(850,t+.08);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.18);
  o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.2);
 }catch{}
}
function renderMessages(keepPosition=false){
 const el=$('messages');const area=$('messagesArea');const beforeHeight=area.scrollHeight;const beforeTop=area.scrollTop;
 const nearBottom=area.scrollHeight-area.scrollTop-area.clientHeight<150;
 const combined=state.messages.concat(state.pending.filter(p=>!state.messages.find(m=>m.id===p.id)));
 const signature=combined.map(m=>m.id+(m.pending?'p':'')+String(m.body)+(m.reply_to||'')).join('|');
 if(signature===state.lastSignature)return;state.lastSignature=signature;
 if(!combined.length){el.innerHTML='<div class="intro-space"><div class="intro-icon">'+icon('chat')+'</div><h3>Good conversations start here.</h3><p>Say hi, share a photo, or send a video. Everything stays saved.</p></div>';return}
 el.innerHTML=combined.map(m=>{
  const mine=m.sender_id===state.user.id;
  const who=state.profiles.get(m.sender_id)?.display_name|| (mine?state.displayName:'Friend');
  const canDelete=mine||(state.siteAdmin&&state.room?.kind==='group')||state.members.some(x=>x.user_id===state.user.id&&['owner','admin'].includes(x.role));
  const original=state.messages.find(x=>x.id===m.reply_to);
  const quote=m.reply_to?'<div class="msg-reply-quote"><strong>'+esc(original?(state.profiles.get(original.sender_id)?.display_name||'Friend'):'Replied message')+'</strong>'+esc((original?.body||original?.attachment_name||'Original message').slice(0,180))+'</div>':'';
  const body=m.body?'<div class="msg-bubble">'+quote+esc(m.body)+'</div>':quote;
  return '<div class="message-row '+(mine?'mine ':'')+(m.pending?'pending':'')+'" data-message-id="'+esc(m.id)+'">'+
   '<div class="msg-avatar">'+esc(who.slice(0,1).toUpperCase())+'</div><div class="msg-content"><div class="msg-meta"><strong>'+esc(mine?'You':who)+'</strong><span>'+esc(when(m.created_at))+'</span></div>'+
   body+(m.attachment_path?'<div class="msg-attachment" data-media-path="'+esc(m.attachment_path)+'" data-media-type="'+esc(m.attachment_type||'')+'" data-media-name="'+esc(m.attachment_name||'File')+'"><div class="media-open">'+icon('file')+' '+esc(m.attachment_name||'Loading file…')+'</div></div>':'')+
   (m.pending?'<div class="msg-options">Sending…</div>':
     '<div class="message-actions"><button type="button" data-reply="'+esc(m.id)+'">↩ Reply</button><button type="button" data-pick-emoji="'+esc(m.id)+'">☺ React</button>'+
     (canDelete?'<button type="button" data-delete-message="'+esc(m.id)+'">Delete</button>':'')+'</div>'+
     renderReactions(m.id)+
     '<div class="emoji-picker" data-emoji-picker="'+esc(m.id)+'" hidden>'+REACTION_EMOJIS.map(e=>'<button type="button" data-react="'+esc(m.id)+'" data-emoji="'+esc(e)+'">'+esc(e)+'</button>').join('')+'</div>')+'</div></div>';
 }).join('');
 el.querySelectorAll('[data-media-path]').forEach(holder=>{renderAttachment(holder).catch(e=>{holder.textContent='Attachment unavailable: '+e.message})});
 el.querySelectorAll('[data-delete-message]').forEach(b=>b.onclick=()=>deleteMessage(b.dataset.deleteMessage));
 el.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>beginReply(b.dataset.reply));
 el.querySelectorAll('[data-pick-emoji]').forEach(b=>b.onclick=()=>{
   const picker=el.querySelector('[data-emoji-picker="'+b.dataset.pickEmoji+'"]');
   if(picker)picker.hidden=!picker.hidden;
 });
 el.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>toggleReaction(b.dataset.react,b.dataset.emoji));
 if(keepPosition)area.scrollTop=area.scrollHeight-beforeHeight+beforeTop;
 else if(nearBottom||state.messages.length<15)area.scrollTop=area.scrollHeight;
}
async function getMediaUrl(path){
 const existing=state.fileUrls.get(path);if(existing&&existing.expires>Date.now()+60000)return existing.url;
 const {data,error}=await state.sb.storage.from(BUCKET).createSignedUrl(path,3600);
 if(error)throw error;state.fileUrls.set(path,{url:data.signedUrl,expires:Date.now()+3500000});return data.signedUrl;
}
function safeMediaType(type,name){const ext=(name||'').split('.').pop().toLowerCase();if(type.startsWith('image/')&&!['svg+xml'].some(x=>type.includes(x)))return 'image';if(type.startsWith('video/'))return 'video';if(type.startsWith('audio/'))return 'audio';if(type==='application/pdf'||ext==='pdf')return 'pdf';if(type==='text/plain'||ext==='txt')return 'text';return 'other'}
async function renderAttachment(holder){
 const path=holder.dataset.mediaPath,name=holder.dataset.mediaName,type=holder.dataset.mediaType;
 const url=await getMediaUrl(path);if(!holder.isConnected)return;
 const group=safeMediaType(type,name);
 if(group==='image'){holder.innerHTML='<button class="media-open" type="button" aria-label="Open image preview" style="padding:0;width:100%"><img loading="lazy" src="'+esc(url)+'" alt="'+esc(name)+'"></button>'}
 else if(group==='video'){holder.innerHTML='<video controls playsinline preload="metadata" src="'+esc(url)+'" aria-label="'+esc(name)+'"></video><button type="button" class="file-open">'+icon('eye')+' Open full preview</button>'}
 else if(group==='audio'){holder.innerHTML='<audio controls preload="metadata" src="'+esc(url)+'"></audio>'}
 else{holder.innerHTML='<button class="file-open" type="button">'+icon('file')+'<span>'+esc(name)+'<small>'+ (group==='pdf'?'PDF · Preview available':group==='text'?'Text file · Preview available':'File · Download available')+'</small></span>'+icon('eye')+'</button>'}
 const btn=holder.querySelector('button');if(btn)btn.onclick=()=>openPreview({url,name,type,group});
}
async function openPreview({url,name,type,group}){
 $('previewTitle').textContent=name;$('previewDownload').href=url;$('previewDownload').download=name;
 const holder=$('previewContent');holder.replaceChildren();
 if(group==='image'){const img=document.createElement('img');img.src=url;img.alt=name;holder.append(img)}
 else if(group==='video'){const v=document.createElement('video');v.src=url;v.controls=true;v.autoplay=true;v.playsInline=true;holder.append(v)}
 else if(group==='audio'){const v=document.createElement('audio');v.src=url;v.controls=true;v.autoplay=true;holder.append(v)}
 else if(group==='pdf'){const frame=document.createElement('iframe');frame.src=url;frame.title=name;holder.append(frame)}
 else if(group==='text'){const pre=document.createElement('pre');pre.textContent='Loading preview…';holder.append(pre);try{const r=await fetch(url);if(!r.ok)throw Error('Not available');pre.textContent=(await r.text()).slice(0,200000)}catch(e){pre.textContent='Preview unavailable: '+e.message}}
 else{holder.innerHTML='<p>This file type has no safe browser preview. Use the download button above.</p>'}
 $('mediaDialog').showModal();
}
async function deleteMessage(id){
 if(!confirm('Delete this message for everyone?'))return;
 const {error}=await state.sb.from('chat_messages').delete().eq('id',id).eq('room_id',state.room.id);
 if(error){notify('Cannot delete: '+error.message,true);return}
 state.messages=state.messages.filter(m=>m.id!==id);state.lastSignature='';renderMessages();notify('Message deleted');
}
async function loadMembers(){
 if(!state.room)return;const roomId=state.room.id;
 const {data,error}=await state.sb.from('chat_members').select('user_id,role,joined_at').eq('room_id',roomId);
 if(error){console.warn('Members:',error.message);return}if(roomId!==state.room?.id)return;
 state.members=data||[];await loadProfiles(state.members.map(m=>m.user_id));renderMembers();
}
function renderMembers(){
 const members=state.members.map(m=>({...m,profile:state.profiles.get(m.user_id)}));
 members.sort((a,b)=>Number(isOnline(b))-Number(isOnline(a)));
 $('memberCount').textContent=members.length;
 $('membersList').innerHTML=members.map(m=>{
  const name=m.profile?.display_name||'Friend';const online=isOnline(m);
  return '<div class="member-row"><div class="member-avatar">'+esc(name.slice(0,1).toUpperCase())+'<i class="'+(online?'online':'')+'"></i></div><span class="member-info"><strong>'+esc(name)+(m.user_id===state.user?.id?' (you)':'')+'</strong><small>'+esc(m.role==='owner'?'Room owner · ':m.role==='admin'?'Admin · ':'')+esc(online?'Online now':shortAgo(m.profile?.last_seen))+'</small></span></div>';
 }).join('') || '<div class="list-loading">No members found</div>';
}
function isOnline(m){return state.onlineIds.has(m.user_id)||!!m.profile?.last_seen&&(Date.now()-new Date(m.profile.last_seen).getTime()<60000)}
async function sendMessage(body='',attachment=null){
 ensureReady();if(!state.room)throw Error('Choose a room');
 const current=state.room.id;const trimmed=body.trim();if(!trimmed&&!attachment)return;
 const id=crypto.randomUUID();
 const msg={id,room_id:current,sender_id:state.user.id,reply_to:state.replyTo?.id||null,body:trimmed,attachment_path:attachment?.path||null,attachment_name:attachment?.name||null,attachment_type:attachment?.type||null,created_at:new Date().toISOString(),pending:true};
 state.pending.push(msg);state.lastSignature='';renderMessages();
 const {error}=await state.sb.from('chat_messages').insert({...msg,pending:undefined});
 state.pending=state.pending.filter(p=>p.id!==id);
 if(error){state.lastSignature='';renderMessages();throw error}
 state.messages.push({...msg,pending:false});state.replyTo=null;updateReplyDraft();state.lastSignature='';renderMessages();loadMessages(false).catch(()=>{});
}
async function sendText(e){
 e.preventDefault();const box=$('messageInput');const text=box.value.trim();if(!text)return;
 box.value='';box.style.height='35px';
 try{await sendMessage(text)}catch(err){box.value=text;notify('Failed to send: '+err.message,true)}
}
function resizeTextarea(){const el=$('messageInput');el.style.height='35px';el.style.height=Math.min(150,el.scrollHeight)+'px'}
async function imageCompress(file){
 if(file.type==='image/gif')throw Error('Large animated GIF cannot be safely recompressed. Send a GIF under 8 MB.');
 let img;try{img=await createImageBitmap(file)}catch{throw Error('Cannot decode this image for compression')}
 let w=img.width,h=img.height;let target=1800;
 try{
  while(target>=320){
   const scale=Math.min(1,target/Math.max(w,h));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
   const ctx=canvas.getContext('2d');if(!ctx)break;ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.82,.68,.50,.34]){
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));if(blob&&blob.size<=MAX){
     const result=new File([blob],file.name.replace(/\.[^.]+$/,'')+'-compressed.jpg',{type:'image/jpeg'});
     notify('Image compressed: '+Math.round(file.size/1048576)+' MB → '+(blob.size/1048576).toFixed(1)+' MB');
     return result;
    }
   }target=Math.floor(target*.68);
  }
 }finally{img.close?.()}
 throw Error('This image could not be compressed under 8 MB');
}
async function videoCompress(file){
 if(!('MediaRecorder' in window)||!HTMLMediaElement.prototype.captureStream)throw Error('This browser cannot compress videos. Compress it first, then upload.');
 const supported=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 if(!supported)throw Error('Video compression not supported in this browser');
 const video=document.createElement('video');const object=URL.createObjectURL(file);video.src=object;video.preload='auto';video.playsInline=true;video.muted=true;
 try{
  await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('Cannot read video'));setTimeout(()=>reject(Error('Video preview timed out')),15000)});
  if(!Number.isFinite(video.duration)||video.duration>180)throw Error('Videos over 3 minutes need to be compressed before upload');
  video.currentTime=0;await video.play().catch(e=>{throw Error('Cannot play video to compress: '+e.message)});
  const stream=video.captureStream();const chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:supported,videoBitsPerSecond:Math.max(220000,Math.floor((MAX*8*.76)/Math.max(1,video.duration))),audioBitsPerSecond:64000});
  const blob=await new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onerror=e=>reject(Error(e.error?.message||'Video encoding failed'));
   recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));
   video.onended=()=>{if(recorder.state!=='inactive')recorder.stop()};
   recorder.start(700);
   setTimeout(()=>{if(recorder.state!=='inactive'){recorder.stop()}},Math.min(210000,(video.duration+15)*1000));
  });
  if(!blob.size||blob.size>MAX)throw Error('Compressed video is still over 8 MB. Try a shorter/lower-resolution clip.');
  notify('Video converted to '+(blob.size/1048576).toFixed(1)+' MB WebM; preview after upload.');
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'-compressed.webm',{type:'video/webm'});
 }finally{video.pause();URL.revokeObjectURL(object);video.removeAttribute('src');video.load()}
}
async function prepareUpload(file){
 if(file.size<=MAX)return file;
 notify('Compressing '+file.name+'… This may take a moment.');
 if(file.type.startsWith('image/'))return imageCompress(file);
 if(file.type.startsWith('video/'))return videoCompress(file);
 throw Error('Automatic compression of '+(file.type||'this file format')+' cannot guarantee a smaller valid file. Compress it externally to 8 MB or less.');
}
async function uploadFile(file){
 ensureReady();if(!state.room)throw Error('Choose a room first');
 const accepted=['image/','video/','audio/'];const types=['application/pdf','text/plain','application/zip','application/octet-stream'];
 if(!accepted.some(x=>file.type.startsWith(x))&&!types.includes(file.type))throw Error('For safety, supported formats are photos, video, audio, PDF, text and ZIP');
 const prepared=await prepareUpload(file);
 if(prepared.size>MAX)throw Error('File is still over 8 MB');
 const slug=prepared.name.replace(/[^\w.\-]+/g,'_').slice(-90)||'upload';
 const path=state.room.id+'/'+state.user.id+'/'+crypto.randomUUID()+'-'+slug;
 $('composerInfo').textContent='Uploading '+prepared.name+'…';
 try{
  const {error}=await state.sb.storage.from(BUCKET).upload(path,prepared,{contentType:prepared.type||'application/octet-stream',upsert:false,cacheControl:'3600'});
  if(error)throw error;
  await sendMessage('',{path,name:prepared.name,type:prepared.type});
  notify('File shared successfully');
 }finally{$('composerInfo').textContent='Enter to send · Shift + Enter for new line'}
}
async function makeRoom(kind='group'){
 ensureReady();
 showDialog(kind==='private'?'Start a private chat':'Create a room',
 '<p>'+(kind==='private'?'A private, invite-only space for you and your friend.':'Make a new group space for your friends. Invite using a shareable link.')+'</p><label for="createRoomName">Room name</label><input id="createRoomName" maxlength="70" placeholder="'+(kind==='private'?'Best friend':'Goku squad')+'"><p class="help">Room link: /chat/your-room-name</p>',
 [{label:'Create '+(kind==='private'?'private chat':'room'),act:async b=>{b.disabled=true;try{
 const name=$('createRoomName').value.trim();const slug=normalizeSlug(name);if(name.length<2||slug.length<2)throw Error('Enter a room name with at least two letters');
 const {data,error}=await state.sb.from('chat_rooms').insert({slug,name,kind,owner_id:state.user.id}).select('id,slug,name,kind').single();
 if(error)throw error;closeDialog();await openRoom(slug);notify('Room created!');if(kind==='private')await shareRoom();else copyText(urlForRoom(slug));
 }finally{b.disabled=false}}}]);
}
async function joinRoom(){
 ensureReady();
 showDialog('Join a room','<p>Paste a room invite URL or enter the short room name.</p><label for="roomJoinValue">Room link or name</label><input id="roomJoinValue" placeholder="https://8apdf.vercel.app/chat/goku"><p class="help">Public groups are open by link. Private groups require a valid invitation.</p>',
 [{label:'Join room',act:async b=>{b.disabled=true;try{
  const val=$('roomJoinValue').value.trim();let slug=val,token=null;
  if(val.includes('/chat/')){const link=new URL(val,location.origin);slug=link.pathname.split('/chat/')[1]?.split('/')[0];token=link.searchParams.get('invite')}
  slug=normalizeSlug(slug);if(!slug)throw Error('Enter a room name');
  await openRoom(slug,token);closeDialog();notify('Room joined');
 }finally{b.disabled=false}}}]);
}
async function shareRoom(){
 ensureReady();const room=state.room;if(!room)return;
 if(room.kind==='private'){
  const {data,error}=await state.sb.from('chat_invites').insert({room_id:room.id,created_by:state.user.id}).select('token').single();if(error)throw error;
  await copyText(urlForRoom(room.slug,data.token));return;
 }
 await copyText(urlForRoom(room.slug));
}
async function inviteFriend(){
 ensureReady();const room=state.room;
 showDialog('Invite a friend','<p>Search the name your friend chose on 8aPDF, or simply copy an invite link.</p><label for="friendSearch">Find a friend</label><input id="friendSearch" placeholder="Search by name" maxlength="40"><div id="friendResults" class="member-search-list"></div><p class="help">Friend names are not verified identities. Confirm with them before sharing private details.</p>',
 [{label:'Copy invite link',act:async()=>{await shareRoom();closeDialog()}}]);
 const input=$('friendSearch');let debounce;
 input.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(async()=>{
  const query=input.value.trim();if(query.length<2){$('friendResults').innerHTML='';return}
  const {data,error}=await state.sb.from('chat_profiles').select('id,display_name').ilike('display_name','%'+query.replace(/[%_]/g,'')+'%').neq('id',state.user.id).limit(12);
  if(error)return;$('friendResults').innerHTML=(data||[]).map(p=>'<div class="inline-member"><strong>'+esc(p.display_name)+' <small style="color:#888">('+esc(p.id.slice(0,6))+')</small></strong><button data-invite-user="'+esc(p.id)+'">Invite</button></div>').join('')||'<p>No matching names found.</p>';
  $('friendResults').querySelectorAll('[data-invite-user]').forEach(b=>b.onclick=async()=>{b.disabled=true;
   const {error:err}=await state.sb.from('chat_invites').insert({room_id:room.id,created_by:state.user.id,invited_user_id:b.dataset.inviteUser});
   if(err){notify(err.message,true);b.disabled=false;return}notify('Invitation sent to friend');closeDialog();
  });
 },300)};
}
async function checkInvites(){
 if(!state.user)return;
 const {data,error}=await state.sb.from('chat_invites').select('id,room_id,created_by,status,chat_rooms(name,slug)').eq('invited_user_id',state.user.id).eq('status','pending').order('created_at',{ascending:false}).limit(8);
 if(error)return;
 for(const invite of data||[]){
  if(state.invitesShown.has(invite.id))continue;state.invitesShown.add(invite.id);
  const name=invite.chat_rooms?.name||'Private room';
  showDialog('You have a chat invitation','<p><strong>'+esc(name)+'</strong> invited you to join a conversation.</p><p>Accept to join, or dismiss the request.</p>',
   [{label:'Dismiss',primary:false,act:async()=>{const {error:e}=await state.sb.rpc('chat_respond_invite',{p_invite:invite.id,p_accept:false});if(e)throw e;closeDialog()}},
    {label:'Join chat',act:async()=>{const {data:roomId,error:e}=await state.sb.rpc('chat_respond_invite',{p_invite:invite.id,p_accept:true});if(e)throw e;closeDialog();const {data:room}=await state.sb.from('chat_rooms').select('slug').eq('id',roomId).single();if(room){await openRoom(room.slug);notify('Invitation accepted')}}}], 'FRIEND REQUEST');
  break;
 }
}
async function refreshSiteAdmin(){
 if(!state.user||!state.sb)return;
 const {data,error}=await state.sb.rpc('chat_is_site_admin');
 if(!error)state.siteAdmin=!!data;
}
async function roomManagement(){
 ensureReady();if(!state.room)return;
 await loadMembers();
 const mine=state.members.find(m=>m.user_id===state.user.id);
 const globalModerator=state.siteAdmin&&state.room.kind==='group';
 const manager=mine?.role==='owner'||mine?.role==='admin'||globalModerator;const owner=mine?.role==='owner'||globalModerator;
 const content='<p>'+esc(state.room.name)+' · '+esc(state.siteAdmin?'Site admin':mine?.role||'member')+'</p>'+(!state.siteAdmin?'<label for="chatAdminPassword">Admin access key</label><input type="password" id="chatAdminPassword" autocomplete="off" placeholder="Enter admin access key"><button type="button" id="verifySiteAdmin" class="connection-setup-button" style="margin-top:9px">Verify admin access</button><p class="help">Verified securely on the server. The key is never stored in your browser.</p>':'')+(manager?'<p>Manage members or remove inappropriate messages. Only room owners can promote other admins.</p>':'<p>This room is managed by its owner. Only owners and admins can moderate other members.</p>')+
 state.members.map(m=>{
  const prof=state.profiles.get(m.user_id);const canManage=manager&&m.user_id!==state.user.id&&m.role!=='owner';
  return '<div class="inline-member"><strong>'+esc(prof?.display_name||'Friend')+' <small style="color:#888">· '+esc(m.role)+'</small></strong>'+
  (canManage&&owner?'<button data-make-admin="'+esc(m.user_id)+'">'+(m.role==='admin'?'Demote':'Make admin')+'</button>':'')+
  (canManage&&(owner||m.role!=='admin')?'<button class="danger" data-ban="'+esc(m.user_id)+'">Ban</button>':'')+'</div>';
 }).join('');
 showDialog('Room management',content+(owner&&state.room.kind==='group'?'<div class="room-danger-zone"><p>Group moderation</p><button type="button" id="clearGroupChat">Clear group messages</button><button type="button" id="deleteGroupChat" '+(state.room.slug==='general'?'disabled':'')+'>Delete this group</button></div>':''),[],'ADMIN CONTROLS');
 const verify=$('verifySiteAdmin');
 if(verify)verify.onclick=async()=>{
   const input=$('chatAdminPassword');if(!input?.value.trim())return notify('Enter the admin key',true);
   const value=input.value;input.value='';verify.disabled=true;
   try{
    const {data,error}=await state.sb.rpc('chat_redeem_admin',{p_password:value});
    if(error)throw error;if(!data)throw Error('Invalid admin access key');
    await refreshSiteAdmin();notify('Site admin access enabled');closeDialog();await roomManagement();
   }catch(e){notify(e.message||'Verification failed',true)}
   finally{verify.disabled=false}
 };
 const clear=$('clearGroupChat');
 if(clear)clear.onclick=async()=>{
   if(!confirm('Delete ALL messages from this group for everyone? This cannot be undone.'))return;
   const {data,error}=await state.sb.rpc('chat_clear_group',{p_room:state.room.id});
   if(error){notify(error.message,true);return}
   closeDialog();notify(data+' messages removed');state.messages=[];state.lastSignature='';renderMessages();await loadMessages(true);
 };
 const del=$('deleteGroupChat');
 if(del)del.onclick=async()=>{
   if(!confirm('Permanently delete this entire group and its messages?'))return;
   const {error}=await state.sb.rpc('chat_delete_group',{p_room:state.room.id});
   if(error){notify(error.message,true);return}
   closeDialog();notify('Group deleted');await openRoom('general');
 };
 $('dialogContent').querySelectorAll('[data-make-admin]').forEach(b=>b.onclick=async()=>{
  const mem=state.members.find(m=>m.user_id===b.dataset.makeAdmin);const role=mem.role==='admin'?'member':'admin';
  const {error}=await state.sb.rpc('chat_set_member_role',{p_room:state.room.id,p_user:b.dataset.makeAdmin,p_role:role});
  if(error)notify(error.message,true);else{closeDialog();notify('Role changed');roomManagement()}
 });
 $('dialogContent').querySelectorAll('[data-ban]').forEach(b=>b.onclick=async()=>{
  if(!confirm('Permanently ban this member from this room?'))return;
  const {error}=await state.sb.rpc('chat_ban_member',{p_room:state.room.id,p_user:b.dataset.ban,p_reason:'Removed by a moderator'});
  if(error)notify(error.message,true);else{closeDialog();notify('Member banned');roomManagement()}
 });
}
function readTimestamp(value){const text=String(value||'1970-01-01T00:00:00Z'),fraction=(text.match(/\.(\d+)/)||[])[1]||'',whole=Date.parse(text.replace(/\.\d+/,''));return Number.isFinite(whole)?BigInt(whole)*1000000n+BigInt(fraction.padEnd(9,'0').slice(0,9)):0n;}
const readWritten=new Map();let readTimer=0;
function readingVisible(){try{return !document.hidden&&(window.parent===window||parent.__8apdfPersistentPage==='chat')}catch{return !document.hidden}}
async function markVisibleRead(){
 if(!readingVisible()||!state.user||!state.room||!state.messages.length)return;
 const area=$('messagesArea').getBoundingClientRect(),visibleIds=new Set([...document.querySelectorAll('[data-message-id]')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>area.top&&r.top<area.bottom}).map(el=>el.dataset.messageId));
 const atBottom=$('messagesArea').scrollHeight-$('messagesArea').scrollTop-$('messagesArea').clientHeight<30;
 const visible=state.messages.filter(m=>!m.pending&&visibleIds.has(m.id)).sort((a,b)=>readTimestamp(a.created_at)<readTimestamp(b.created_at)?-1:readTimestamp(a.created_at)>readTimestamp(b.created_at)?1:0),latest=atBottom?state.messages.filter(m=>!m.pending).at(-1):visible.at(-1);if(!latest)return;
 const room=state.room.id,at=latest.created_at;if(readTimestamp(readWritten.get(room))>=readTimestamp(at))return;
 const {error}=await state.sb.rpc('chat_mark_read',{p_room:room,p_last_read:at});if(error){console.warn('Read marker:',error.message);return}
 const old=readWritten.get(room);if(!old||readTimestamp(at)>readTimestamp(old))readWritten.set(room,at);try{localStorage.setItem('8apdf_chat_read_changed',String(Date.now()))}catch{}
 if(window.parent!==window)parent.postMessage({type:'8apdf:chat-read',roomId:room},location.origin);
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent)return;if(e.data?.type==='8apdf:tool-visible'&&e.data.visible)requestAnimationFrame(markVisibleRead);if(e.data?.type==='8apdf:open-chat-room'&&state.user&&state.room?.slug!==e.data.room)openRoom(e.data.room,e.data.invite||null,false).catch(err=>notify(err.message,true));});
function installEvents(){
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
  const actions={create:()=>makeRoom('group'),join:joinRoom,private:()=>makeRoom('private'),new:()=>makeRoom('group')};
  Promise.resolve(actions[b.dataset.action]?.()).catch(e=>notify(e.message,true));
 });
 $('refreshRooms').onclick=()=>loadRooms().then(()=>notify('Conversations refreshed'));
 $('adminBtn').onclick=()=>roomManagement().catch(e=>notify(e.message,true));
 $('inviteBtn').onclick=()=>inviteFriend().catch(e=>notify(e.message,true));
 $('headerMoreBtn').onclick=()=>showDialog('Chat options','<p>Share a link to this room, invite a friend, or manage participants.</p>',[
  {label:'Share room',act:async()=>{await shareRoom();closeDialog()}},{label:'Invite friends',act:()=>{closeDialog();inviteFriend()}}]);
 $('loadOlder').onclick=()=>loadOlder().catch(e=>notify(e.message,true));
 $('composerForm').addEventListener('submit',sendText);
 $('messageInput').addEventListener('input',()=>{resizeTextarea();if(state.user)sendTyping()});
 $('cancelReply').onclick=()=>{state.replyTo=null;updateReplyDraft()};
 document.addEventListener('pointerdown',()=>{userActivated=true},{once:true});
 document.addEventListener('keydown',()=>{userActivated=true},{once:true});
 document.querySelectorAll('.app-rail a[href="/"]').forEach(link=>link.addEventListener('click',e=>{try{sessionStorage.setItem('8apdf_from_chat_v1','1')}catch{}if(window.parent!==window){e.preventDefault();parent.postMessage({type:'8apdf:home'},location.origin)}}));
 window.addEventListener('pagehide',()=>{try{sessionStorage.setItem('8apdf_from_chat_v1','1')}catch{}});
 $('messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composerForm').requestSubmit()}});
 $('mediaInput').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{await uploadFile(file)}catch(err){notify(err.message||'Upload failed',true)}
 });
 $('closeDialog').onclick=closeDialog;$('previewClose').onclick=()=>{$('mediaDialog').close();$('previewContent').replaceChildren()};
 $('mediaDialog').addEventListener('close',()=>$('previewContent').replaceChildren());
 $('mobileOpenRooms').onclick=()=>toggleMobile('chatSidebar');$('mobileOpenMembers').onclick=()=>toggleMobile('membersPanel');
 $('closeMembers').onclick=hideMobile;$('mobileBackdrop').onclick=hideMobile;
 window.addEventListener('popstate',()=>{const slug=location.pathname.match(/\/chat\/([^/?]+)/)?.[1]||'general';if(state.user)openRoom(slug,new URLSearchParams(location.search).get('invite'),false).catch(e=>notify(e.message,true))});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){heartbeat().catch(()=>{});markVisibleRead()}});$('messagesArea').addEventListener('scroll',()=>{clearTimeout(readTimer);readTimer=setTimeout(markVisibleRead,150)},{passive:true});
}
installEvents();
start();
})();