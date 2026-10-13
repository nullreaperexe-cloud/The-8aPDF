import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import {classifyTestPdf,isTestNotice,cleanSchoolText} from './test-recognition.js';
import {validPushSubscription,preferenceAllows,allowedPushOrigin,notificationPath} from './push-policy.js';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const sha=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
function json(data:unknown,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})}})}
const decode=(v:any):any=>v?.stringValue??v?.timestampValue??v?.booleanValue??(v?.integerValue?Number(v.integerValue):v?.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,value])=>[k,decode(value)])):null);
function secureEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function send(sub:any,payload:any,cfg:any){
 const req=webpush.generateRequestDetails(sub.subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://8apdf.vercel.app/',publicKey:cfg.vapid_public_key,privateKey:cfg.vapid_private_key},contentEncoding:'aes128gcm',TTL:86400,urgency:'normal',topic:String(payload.tag).slice(0,32)});
 const response=await fetch(req.endpoint,{method:req.method,headers:req.headers,body:new Uint8Array(req.body),redirect:'error',signal:AbortSignal.timeout(8000)});return response.status;
}
async function sourceEvents(collection:string){
 const response=await fetch('https://firestore.googleapis.com/v1/projects/academyvault-5d1eb/databases/(default)/documents:runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:collection}],...(collection==='announcements'?{where:{fieldFilter:{field:{fieldPath:'published'},op:'EQUAL',value:{booleanValue:true}}}}:{}),limit:1000}}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('School feed unavailable');const rows=await response.json(),out=[];
 for(const r of rows){if(!r.document)continue;const raw=Object.fromEntries(Object.entries(r.document.fields||{}).map(([k,v])=>[k,decode(v)])),id=r.document.name.split('/').at(-1);
  if(collection==='announcements'&&raw.published!==true)continue;
  const source=collection==='study_materials'?'pdf':'announcement',title=cleanSchoolText(raw.title||raw.name||'School update').slice(0,180),body=cleanSchoolText(raw.message||raw.fullMessage||raw.description||raw.subject||'New school material').slice(0,220);
  const is_test=source==='pdf'?classifyTestPdf(raw).isTest:isTestNotice(raw),fingerprint=await sha(JSON.stringify([title,body,raw.pdfUrl||raw.url||raw.attachmentUrl||'',raw.eventDate||'']));
  out.push({id:source+':'+id+':'+fingerprint.slice(0,24),source,source_id:id,title,body,path:source==='pdf'?(is_test?'/tests':'/pdf-explorer'):'/school-reminders?message='+encodeURIComponent(id),is_test});
 }return out;
}
async function poll(cfg:any,dryRun=false){
 const claim=await db.rpc('school_push_claim_run');if(claim.error)throw claim.error;if(!claim.data)return{busy:true};
 const results:any={sources:{},newEvents:0,sent:0,failed:0,expired:0};
 try{
  const {data:subs,error:subError}=await db.from('school_push_subscriptions').select('*').limit(1000);if(subError)throw subError;
  for(const collection of ['study_materials','announcements']){
   try{
    const records=await sourceEvents(collection);const {data:state,error:stateError}=await db.from('school_push_sources').select('initialized').eq('id',collection).maybeSingle();if(stateError)throw stateError;
    if(dryRun){results.sources[collection]={records:records.length,initialized:!!state?.initialized};continue}
    const {data:added,error}=await db.from('school_push_events').upsert(records,{onConflict:'id',ignoreDuplicates:true}).select('id,source,is_test');if(error)throw error;
    const fresh=state?.initialized?(added||[]):[];results.newEvents+=fresh.length;
    const deliveries=(subs||[]).flatMap(s=>fresh.filter(e=>preferenceAllows(s.preferences,e)).map(e=>({subscription_id:s.id,event_id:e.id})));
    if(deliveries.length){const written=await db.from('school_push_deliveries').upsert(deliveries,{onConflict:'subscription_id,event_id',ignoreDuplicates:true});if(written.error)throw written.error}
    const sourceState=await db.from('school_push_sources').upsert({id:collection,initialized:true,last_checked_at:new Date().toISOString()});if(sourceState.error)throw sourceState.error;
    results.sources[collection]={records:records.length,new:fresh.length,baseline:!state?.initialized};
   }catch{results.sources[collection]={error:'School feed temporarily unavailable'}}
  }
  if(!dryRun){
   const {data:pending,error}=await db.from('school_push_deliveries').select('subscription_id,event_id,attempts,school_push_events(*)').eq('status','pending').lte('next_attempt_at',new Date().toISOString()).limit(1000);if(error)throw error;
   const bySub=new Map<string,any[]>();for(const row of pending||[]){if(!bySub.has(row.subscription_id))bySub.set(row.subscription_id,[]);bySub.get(row.subscription_id)!.push(row)}
   for(const [subId,rows] of bySub){const sub=subs?.find(s=>s.id===subId);if(!sub)continue;
    for(let i=0;i<rows.length;i+=12){const batch=rows.slice(i,i+12),events=batch.map(r=>r.school_push_events).filter(e=>e&&preferenceAllows(sub.preferences,e));const ids=batch.map(r=>r.event_id);if(!events.length){await db.from('school_push_deliveries').update({status:'skipped'}).eq('subscription_id',subId).in('event_id',ids);continue}
     const first=events[0],tag=(await sha(ids.slice().sort().join('|'))).slice(0,32),payload={title:events.length>1?events.length+' new 8aPDF updates':(first.source==='pdf'?'New '+(first.is_test?'test PDF':'PDF'):'School announcement'),body:events.length>1?events.slice(0,3).map(e=>e.title).join(' · ').slice(0,220):first.title,url:notificationPath(first.path,sub.origin),tag};
     let code=0;try{code=await send(sub,payload,cfg)}catch{}
     if(code>=200&&code<300){const wrote=await db.from('school_push_deliveries').update({status:'sent'}).eq('subscription_id',subId).in('event_id',ids);if(wrote.error)throw wrote.error;results.sent++}
     else if(code===404||code===410){await db.from('school_push_subscriptions').delete().eq('id',subId);results.expired++;break}
     else {for(const row of batch)await db.from('school_push_deliveries').update({attempts:row.attempts+1,next_attempt_at:new Date(Date.now()+Math.min(3600000,600000*2**row.attempts)).toISOString(),status:row.attempts>=5?'failed':'pending'}).eq('subscription_id',subId).eq('event_id',row.event_id);results.failed++}
    }
   }
   await db.from('school_push_config').update({last_checked_at:new Date().toISOString()}).eq('id',1);
  }return results;
 }finally{await db.from('school_push_config').update({lease_until:null}).eq('id',1)}
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'',allowed=allowedPushOrigin(origin),cors=allowed?origin:'';
 if(req.method==='OPTIONS')return allowed?json({},200,cors):json({error:'Origin not allowed'},403);
 try{
  const {data:cfg,error}=await db.from('school_push_config').select('*').eq('id',1).single();if(error)throw error;
  if(req.method==='GET')return json({enabled:true,publicKey:cfg.vapid_public_key,lastChecked:cfg.last_checked_at,intervalMinutes:10},200,cors);
  if(req.method!=='POST')return json({error:'Use GET or POST'},405,cors);
  if(Number(req.headers.get('Content-Length')||0)>10000)return json({error:'Request too large'},413,cors);
  const raw=await req.text();if(raw.length>10000)return json({error:'Request too large'},413,cors);const body=JSON.parse(raw||'{}');
  if(body.action==='poll'||body.action==='dry-run'){
   if(!secureEqual(req.headers.get('X-Worker-Secret')||'',cfg.worker_secret))return json({error:'Unauthorized'},401);
   return json(await poll(cfg,body.action==='dry-run'));
  }
  if(!allowed)return json({error:'Origin not allowed'},403);
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const auth=await db.auth.getUser(token);if(auth.error||!auth.data.user)return json({error:'Valid user session required'},401,cors);const uid=auth.data.user.id;
  if(body.action==='status'){const count=await db.from('school_push_subscriptions').select('id,preferences').eq('user_id',uid);if(count.error)throw count.error;return json({subscriptions:count.data},200,cors)}
  if(!validPushSubscription(body.subscription))return json({error:'Invalid push subscription'},400,cors);const id=await sha(body.subscription.endpoint);
  if(body.action==='unsubscribe'){const removed=await db.from('school_push_subscriptions').delete().eq('id',id).eq('user_id',uid);if(removed.error)throw removed.error;return json({unsubscribed:true},200,cors)}
  if(body.action==='subscribe'){
   const own=await db.from('school_push_subscriptions').select('id',{count:'exact',head:true}).eq('user_id',uid);if(own.error)throw own.error;if((own.count||0)>=8){const existing=await db.from('school_push_subscriptions').select('id').eq('id',id).eq('user_id',uid).maybeSingle();if(!existing.data)return json({error:'Device limit reached'},429,cors)}
   const p=body.preferences||{},preferences={pdfs:p.pdfs!==false,announcements:p.announcements!==false,testsOnly:p.testsOnly===true};
   const result=await db.from('school_push_subscriptions').upsert({id,user_id:uid,origin,subscription:body.subscription,preferences,updated_at:new Date().toISOString()});if(result.error)throw result.error;return json({subscribed:true,id,preferences},200,cors);
  }
  if(body.action==='test'){
   const {data:sub}=await db.from('school_push_subscriptions').select('*').eq('id',id).eq('user_id',uid).single();if(!sub)return json({error:'Enable notifications first'},404,cors);
   const code=await send(sub,{title:'8aPDF notifications ready',body:'New PDFs and school updates can reach you while the website is closed.',url:'/',tag:'8apdf-device-test'},cfg);return json({sent:code>=200&&code<300},code>=200&&code<300?200:502,cors);
  }return json({error:'Unknown action'},400,cors);
 }catch{return json({error:'Notification service temporarily unavailable'},503,cors)}
});
