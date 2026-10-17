import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import {sourceEvents,FEED_ID,INTERVAL_MINUTES} from './school-feed.js';
import {validPushSubscription,preferenceAllows,allowedPushOrigin,notificationPath,retryState} from './push-policy.js';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
const sha=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
function json(data:unknown,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})}})}
function secureEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
const FIREBASE_API_KEY='AIzaSyATxKki6gkNWic_CnoGbZnOZjAUj1lbKGI';
const value=(result:any)=>{if(result.error)throw result.error;return result.data;};
async function syncAuthorized(req:Request){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token||token.length>4096)return false;
 // Google validates expiry, revocation and project ownership. A decoded JWT
 // alone is never used for authorization. Only the existing sync admin may wake it.
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(8000)});
 if(!response.ok){await response.body?.cancel();return false;}
 const account=(await response.json()).users?.[0];
 return !!account&&!account.disabled&&account.email?.toLowerCase()===(Deno.env.get('FIREBASE_SYNC_EMAIL')||'nullreaper.exe@gmail.com').toLowerCase();
}
async function send(sub:any,payload:any,cfg:any){
 const req=webpush.generateRequestDetails(sub.subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://8apdf.vercel.app/',publicKey:cfg.vapid_public_key,privateKey:cfg.vapid_private_key},contentEncoding:'aes128gcm',TTL:86400,urgency:'normal',topic:String(payload.tag).slice(0,32)});
 const response=await fetch(req.endpoint,{method:req.method,headers:req.headers,body:new Uint8Array(req.body),redirect:'error',signal:AbortSignal.timeout(8000)});
 const result={status:response.status,retryAfter:response.headers.get('Retry-After')};
 await response.body?.cancel();return result;
}
async function poll(cfg:any,dryRun=false){
 const owner=value(await db.rpc('school_push_claim_run_v2'));
 if(!owner)return {ok:true,busy:true};
 const started=Date.now(),results:any={ok:true,sources:{},newEvents:0,sent:0,failed:0,expired:0,deferred:0};
 try{
  for(const collection of ['study_materials','announcements']){
   try{
    const records=await sourceEvents(collection,started+45000);
    if(dryRun){results.sources[collection]={records:records.length};continue;}
    // SQL owns the baseline, dedupe and delivery fan-out transaction.
    const ingested=value(await db.rpc('school_push_ingest_v2',{source_name:collection,feed_name:FEED_ID,records}));
    results.sources[collection]=ingested;results.newEvents+=ingested.baseline?0:ingested.new;
   }catch(error){
    results.ok=false;results.sources[collection]={error:error instanceof Error?error.message:String(error)};
    console.error('School feed ingestion failed:',collection,results.sources[collection].error);
   }
  }
  if(!dryRun){
   // Read the subscription joined to each due row, rather than truncating the
   // subscriber list and starving every device after the first 1,000.
   const pending=value(await db.from('school_push_deliveries').select('subscription_id,event_id,attempts,school_push_events(*),school_push_subscriptions(*)').eq('status','pending').lte('next_attempt_at',new Date().toISOString()).order('next_attempt_at').order('subscription_id').order('event_id').limit(200));
   const groups=new Map<string,any[]>();
   for(const row of pending||[]){if(!groups.has(row.subscription_id))groups.set(row.subscription_id,[]);groups.get(row.subscription_id)!.push(row);}
   const jobs:any[]=[];for(const rows of groups.values())for(let i=0;i<rows.length;i+=12)jobs.push(rows.slice(i,i+12));
   let index=0;
   async function deliver(){
    while(index<jobs.length){
     const batch=jobs[index++];
     // Leave unstarted work pending for the next invocation. Each send has an
     // eight-second timeout; all four workers finish before the 100-second lease.
     if(Date.now()>started+65000){results.deferred+=batch.length;continue;}
     const sub=batch[0].school_push_subscriptions;if(!sub)continue;
     const events=batch.map((r:any)=>r.school_push_events).filter((e:any)=>e&&preferenceAllows(sub.preferences,e));
     const ids=batch.map((r:any)=>r.event_id);
     if(!events.length){value(await db.from('school_push_deliveries').update({status:'skipped'}).eq('subscription_id',sub.id).in('event_id',ids));continue;}
     const first=events[0],tag=(await sha(ids.slice().sort().join('|'))).slice(0,32);
     const payload={title:events.length>1?events.length+' new 8aPDF updates':first.source==='device-test'?first.title:first.source==='pdf'?(first.is_test?'New test PDF':'New PDF'):'School announcement',body:events.length>1?events.slice(0,3).map((e:any)=>e.title).join(' · ').slice(0,220):first.source==='device-test'?first.body:first.title,url:notificationPath(first.path,sub.origin),tag};
     let response={status:0,retryAfter:null as string|null};
     try{response=await send(sub,payload,cfg);}catch(error){console.error('Push transport failed:',error instanceof Error?error.name:'UnknownError');}
     if(response.status>=200&&response.status<300){value(await db.from('school_push_deliveries').update({status:'sent',last_error:null}).eq('subscription_id',sub.id).in('event_id',ids));results.sent++;}
     else if(response.status===404||response.status===410){value(await db.from('school_push_subscriptions').delete().eq('id',sub.id));results.expired++;}
     else{
      // One write per batch prevents twelve sequential database timeouts
      // from outliving the lease. Existing primary keys make this idempotent.
      value(await db.from('school_push_deliveries').upsert(batch.map((row:any)=>({subscription_id:sub.id,event_id:row.event_id,...retryState(row.attempts,response.retryAfter),last_error:response.status?'Push service returned HTTP '+response.status:'Push transport timed out or failed'})),{onConflict:'subscription_id,event_id'}));
      results.failed++;results.ok=false;
     }
    }
   }
   // Await ALL workers, even on one database error, before releasing the lease.
   const outcomes=await Promise.allSettled(Array.from({length:4},()=>deliver()));
   for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
   if(Object.values(results.sources).every((s:any)=>!s.error))value(await db.from('school_push_config').update({last_checked_at:new Date().toISOString()}).eq('id',1));
  }
  return results;
 }finally{
  value(await db.from('school_push_config').update({lease_until:null,lease_owner:null}).eq('id',1).eq('lease_owner',owner));
 }
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'',allowed=allowedPushOrigin(origin),cors=allowed?origin:'';
 if(req.method==='OPTIONS')return allowed?json({},200,cors):json({error:'Origin not allowed'},403);
 try{
  const {data:cfg,error}=await db.from('school_push_config').select('*').eq('id',1).single();if(error)throw error;
  if(req.method==='GET'){const {data:sources,error:sourceError}=await db.from('school_push_sources').select('id,last_checked_at,feed_id').in('id',['study_materials','announcements']).eq('feed_id',FEED_ID);if(sourceError)throw sourceError;const dates=(sources||[]).map(s=>s.last_checked_at).filter(Boolean).sort();return json({enabled:true,publicKey:cfg.vapid_public_key,lastChecked:dates.length===2?dates[0]:null,intervalMinutes:INTERVAL_MINUTES,feed:FEED_ID},200,cors);}
  if(req.method!=='POST')return json({error:'Use GET or POST'},405,cors);
  if(Number(req.headers.get('Content-Length')||0)>10000)return json({error:'Request too large'},413,cors);
  const raw=await req.text();if(raw.length>10000)return json({error:'Request too large'},413,cors);let body;try{body=JSON.parse(raw||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json({error:'A JSON object is required.'},400,cors);}
  if(body.action==='sync'){if(!await syncAuthorized(req))return json({error:'Unauthorized'},401);const result=await poll(cfg);return json(result,result.ok?200:503);}
  if(body.action==='poll'||body.action==='dry-run'||body.action==='crypto-check'){
   if(!secureEqual(req.headers.get('X-Worker-Secret')||'',cfg.worker_secret))return json({error:'Unauthorized'},401);
   if(body.action==='crypto-check'){if(!validPushSubscription(body.subscription))return json({error:'Invalid test subscription'},400);const encrypted=webpush.generateRequestDetails(body.subscription,'8aPDF notification protocol verification',{vapidDetails:{subject:'https://8apdf.vercel.app/',publicKey:cfg.vapid_public_key,privateKey:cfg.vapid_private_key},contentEncoding:'aes128gcm',TTL:60});return json({encryptedBytes:encrypted.body.length,encoding:encrypted.headers['Content-Encoding']||encrypted.headers['content-encoding'],authenticated:!!(encrypted.headers.Authorization||encrypted.headers.authorization)});}
   const result=await poll(cfg,body.action==='dry-run');return json(result,result.ok?200:503);
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
  if(body.action==='test'||body.action==='test-closed'){
   const {data:sub}=await db.from('school_push_subscriptions').select('*').eq('id',id).eq('user_id',uid).single();if(!sub)return json({error:'Enable notifications first'},404,cors);
   if(body.action==='test-closed')return json(value(await db.rpc('school_push_queue_device_test',{device_id:id,owner_id:uid})),200,cors);
   const delivery=await send(sub,{title:'8aPDF notifications ready',body:'New PDFs and school updates can reach you while the website is closed.',url:'/',tag:'8apdf-device-test'},cfg);return json({sent:delivery.status>=200&&delivery.status<300},delivery.status>=200&&delivery.status<300?200:502,cors);
  }return json({error:'Unknown action'},400,cors);
 }catch(error){console.error('Notification request failed:',error instanceof Error?error.message:'Database or transport failure');return json({error:'The notification service is temporarily unavailable.'},503,cors)}
});
