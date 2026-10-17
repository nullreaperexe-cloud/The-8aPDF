/* Friends Chat privacy lock. Interface gate only: real data protection requires server-side access rules. */
(()=>{'use strict';
const expected='8d253132c360061bb156cc9c07e09f4e1ec3ca9cd729d7dc5365fc2e96cd0961';
const css=document.createElement('style');css.textContent=`
html:not(.chat-unlocked) #chatApp,html:not(.chat-unlocked) .toast-stack,html:not(.chat-unlocked) .app-dialog,html:not(.chat-unlocked) .preview-dialog{visibility:hidden!important;pointer-events:none!important}
#chatPrivacyGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#09090b;color:#fafafa;font-family:Inter,system-ui,sans-serif}
#chatPrivacyGate[hidden]{display:none!important}
#chatPrivacyGate form{width:min(100%,390px);padding:30px;border:1px solid #303036;border-radius:24px;background:#171719;box-shadow:0 24px 90px #0008}
#chatPrivacyGate h1{font-size:23px;letter-spacing:-.6px;margin:0 0 9px}
#chatPrivacyGate p{color:#aaaab0;font-size:14px;line-height:1.55}
#chatPrivacyGate input{box-sizing:border-box;width:100%;margin:15px 0 8px;padding:14px;border:1px solid #52525b;border-radius:12px;background:#09090b;color:white;font-size:17px}
#chatPrivacyGate button{width:100%;padding:14px;border:0;border-radius:12px;background:white;color:#111;font-size:15px;font-weight:700;cursor:pointer}
#chatPrivacyGate .error{color:#ff9c9c;min-height:20px;margin:8px 0}
`;document.head.append(css);
const gate=document.createElement('div');gate.id='chatPrivacyGate';gate.innerHTML='<form autocomplete="off"><div style="font-size:35px;margin-bottom:12px">🔒</div><h1>Friends Chat Locked</h1><p>Enter your chat password to open conversations. Notifications never show message previews.</p><input type="password" aria-label="Chat password" placeholder="Enter chat password" required autocomplete="off" maxlength="100"><p class="error" aria-live="polite"></p><button type="submit">Unlock Chat</button><p style="text-align:center;font-size:12px;margin-bottom:0">Your chats stay hidden until you unlock them.</p></form>';
function mount(){document.body.append(gate);gate.querySelector('input').focus();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
let initialized=false,failures=0;
const encode=str=>new TextEncoder().encode(str);
async function check(value){const digest=await crypto.subtle.digest('SHA-256',encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')===expected}
gate.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const field=gate.querySelector('input'),message=gate.querySelector('.error');
const password=field.value;field.value='';if(failures>=5){message.textContent='Too many attempts. Reload to try again.';return}
if(!await check(password)){failures++;message.textContent='Incorrect password ('+(5-failures)+' attempts remaining).';return}
document.documentElement.classList.add('chat-unlocked');gate.hidden=true;message.textContent='';if(!initialized){initialized=true;const script=document.createElement('script');script.src='/chat/app.js?v=20261017-full';script.onerror=()=>{initialized=false;message.textContent='Chat could not load. Reload and retry.';gate.hidden=false;document.documentElement.classList.remove('chat-unlocked');};document.body.append(script)}
});
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='8apdf:chat-lock'){document.documentElement.classList.remove('chat-unlocked');gate.hidden=false;gate.querySelector('input').value='';gate.querySelector('input').focus();}});
window.addEventListener('pagehide',()=>{document.documentElement.classList.remove('chat-unlocked');gate.hidden=false;});
})();