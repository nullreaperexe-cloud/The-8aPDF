export function validPushSubscription(sub){try{const u=new URL(sub?.endpoint),host=u.hostname;return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.push.apple.com'))&&/^[-_A-Za-z0-9]{87,88}$/.test(sub.keys?.p256dh||'')&&/^[-_A-Za-z0-9]{22,24}$/.test(sub.keys?.auth||'')}catch{return false}}
export function preferenceAllows(preferences,event){const p=preferences||{};return (event.source==='pdf'?p.pdfs!==false:p.announcements!==false)&&(!p.testsOnly||event.is_test);}
export function allowedPushOrigin(origin){return ['https://8apdf.vercel.app','https://the-8apdf.vercel.app'].includes(origin)||/^https:\/\/the-8apdf-[a-z0-9-]+-nullreaperexe-clouds-projects\.vercel\.app$/.test(origin);}
export function notificationPath(path,origin){try{const url=new URL(path||'/',origin);return url.origin===origin?url.pathname+url.search+url.hash:'/';}catch{return '/';}}

export function retryState(attempts,retryAfter,now=Date.now()){
 const next=Number(attempts||0)+1;
 const seconds=Number(retryAfter),date=Date.parse(retryAfter||'');
 const requested=retryAfter?(Number.isFinite(seconds)?seconds*1000:Math.max(0,date-now)||0):0;
 const delay=Math.min(86400000,Math.max(Math.min(3600000,30000*2**Math.min(next-1,7)),requested));
 return {attempts:next,status:next>=6?'failed':'pending',next_attempt_at:new Date(now+delay).toISOString()};
}
