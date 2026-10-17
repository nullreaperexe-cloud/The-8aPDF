// Runs the actual handler with mocked HTTP boundaries; no live devices are used.
import assert from 'node:assert/strict';
import webpush from 'npm:web-push@3.6.7';
import {createECDH,randomBytes} from 'node:crypto';
import {signReceipt} from './receipt-policy.js';
Deno.env.set('SUPABASE_URL','https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-key');
let handler:(req:Request)=>Promise<Response>;
const originalServe=Deno.serve;
Deno.serve=((callback:any)=>{handler=callback;return {};}) as any;
const vapid=webpush.generateVAPIDKeys(),device=createECDH('prime256v1');device.generateKeys();
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const calls:any[]=[];let page=0,pending:any[]=[],failIngest=false,pushStatus=201,lookupEmail="",authorizedDevice=false;
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
globalThis.fetch=(async(input:any,init:any={})=>{
 const url=String(input),body=init.body?JSON.parse(typeof init.body==='string'?init.body:'{}'):null;
 calls.push({url,method:init.method||'GET',body,headers:init.headers});
 if(url.includes('/school_push_config')&&(init.method||'GET')==='GET')return json({id:1,vapid_public_key:vapid.publicKey,vapid_private_key:vapid.privateKey,worker_secret:'worker-secret'});
 if(url.includes('/rpc/school_push_claim_run_v2'))return json('00000000-0000-0000-0000-000000000001');
 if(url.startsWith('https://xudhjwojgxblbsebkzso.supabase.co/rest/v1/')){
  const query=new URL(url).searchParams;
  assert.equal(init.headers.apikey,'sb_publishable_fVH-3bHJHdIlCpiL31f1rw_tqWhgTP1');
  assert.equal(query.get('published'),'eq.true');assert.equal(query.get('archived_at'),'is.null');
  if(url.includes('/announcements'))return json([]);
  const start=page++*500,count=Math.min(500,1001-start);
  if(start>0)assert.equal(query.get('id'),'gt.'+JSON.stringify(String(start-1)));
  return json(Array.from({length:Math.max(0,count)},(_,i)=>({id:String(start+i),published:true,pdf_url:'https://example.test/paper.pdf',title:'Science Notes '+(start+i)})));
 }
 if(url.includes('/rpc/school_push_ingest_v2')){assert.equal(body.feed_name,'supabase:xudhjwojgxblbsebkzso');return failIngest?json({message:'Atomic fan-out failed'},500):json({records:body.records.length,new:0,queued:0,baseline:false});}
 if(url.includes('/rpc/school_push_queue_device_test')){assert.equal(body.owner_id,'device-owner');return json({queued:true,withinSeconds:90});}
 if(url.includes('/school_push_subscriptions')&&(init.method||'GET')==='GET')return json(authorizedDevice?{id:'device',user_id:'device-owner',subscription}:null);
 if(url.includes('/school_push_deliveries')&&(init.method||'GET')==='GET')return json(pending);
 if(url.startsWith('https://fcm.googleapis.com/')){assert.equal(new Headers(init.headers).get('Urgency'),'high','Locked-phone delivery must request high urgency');return new Response('',{status:pushStatus,headers:{'Retry-After':'120'}});}
 if(url.includes('identitytoolkit'))return lookupEmail?json({users:[{email:lookupEmail,disabled:false}]}):json({error:{message:'INVALID_ID_TOKEN'}},400);
 if(url.includes('/auth/v1/user'))return authorizedDevice?json({id:'device-owner'}):json({msg:'Invalid JWT'},401);
 if(url.includes('/rest/v1/'))return json([]);
 throw Error('Unexpected HTTP boundary: '+url);
}) as any;
await import('./index.ts');Deno.serve=originalServe;
const req=(action:string)=>new Request('https://example.test/school-push',{method:'POST',headers:{'Content-Type':'application/json','X-Worker-Secret':'worker-secret'},body:JSON.stringify({action})});
Deno.test('CORS includes production; malformed JSON and unauthenticated triggers are rejected',async()=>{
 const preflight=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:'https://the-8apdf.vercel.app'}}));assert.equal(preflight.status,200);
 const malformed=await handler(new Request('https://example.test',{method:'POST',body:'null'}));assert.equal(malformed.status,400);
 const unauthorized=await handler(req('sync'));assert.equal(unauthorized.status,401);
});
Deno.test('Actual poll paginates beyond 1,000 records and calls transactional fan-out',async()=>{
 calls.length=0;page=0;pending=[];
 const response=await handler(req('poll'));assert.equal(response.status,200);
 const data=await response.json();assert(data.ok);
 const ingestions=calls.filter(c=>c.url.includes('/rpc/school_push_ingest'));
 assert.equal(ingestions.length,2);assert.equal(ingestions[0].body.records.length,1001);
 assert(calls.some(c=>c.method==='PATCH'&&c.url.includes('lease_owner=eq.')),'Lease release must be restricted to its owner');
});
Deno.test('Atomic fan-out failure is visible as HTTP 503 and still releases its lease',async()=>{
 calls.length=0;page=0;failIngest=true;
 const response=await handler(req('poll'));assert.equal(response.status,503);assert.equal((await response.json()).ok,false);
 assert(calls.some(c=>c.method==='PATCH'&&c.url.includes('lease_owner=eq.')));failIngest=false;
});
Deno.test('Real encryption, accepted send, rate-limit retry and expired endpoint cleanup',async()=>{
 const row={subscription_id:'device',event_id:'pdf:one',attempts:0,school_push_events:{source:'pdf',title:'Science Notes',path:'/pdf-explorer',is_test:false},school_push_subscriptions:{id:'device',origin:'https://the-8apdf.vercel.app',subscription,preferences:{}}};
 for(const status of [201,429,410]){
  calls.length=0;page=0;pending=[row];pushStatus=status;
  const response=await handler(req('poll')),result=await response.json();
  if(status===201){assert.equal(result.sent,1);assert(calls.some(c=>c.method==='PATCH'&&c.body?.status==='sent'&&c.body?.provider_accepted_at));assert(calls.some(c=>c.method==='PATCH'&&c.body?.receipt_id),'Receipt identity must be persisted before the push is sent');}
  if(status===429){assert.equal(response.status,503);const retry=calls.find(c=>c.method==='POST'&&Array.isArray(c.body)&&c.body[0]?.attempts===1);assert(retry);assert.equal(retry.body[0].status,'pending');}
  if(status===410){assert.equal(result.expired,1);assert(calls.some(c=>c.method==='DELETE'&&c.url.includes('school_push_subscriptions')));}
 }
 pending=[];
});

Deno.test('Sync wake-up accepts only the validated Firebase administrator',async()=>{
 const trigger=()=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer firebase-test-token'},body:JSON.stringify({action:'sync'})});
 lookupEmail='another@example.test';assert.equal((await handler(trigger())).status,401);
 lookupEmail='nullreaper.exe@gmail.com';page=0;pending=[];assert.equal((await handler(trigger())).status,200);
 lookupEmail='';assert.equal((await handler(trigger())).status,401);
});

Deno.test('Closed-site test is authenticated and persisted without a page timer or immediate push',async()=>{
 const trigger=()=>new Request('https://example.test',{method:'POST',headers:{Origin:'https://the-8apdf.vercel.app',Authorization:'Bearer device-session'},body:JSON.stringify({action:'test-closed',subscription})});
 authorizedDevice=false;assert.equal((await handler(trigger())).status,401);
 authorizedDevice=true;calls.length=0;
 try{
  const response=await handler(trigger());assert.equal(response.status,200);assert.equal((await response.json()).queued,true);
  assert(calls.some(c=>c.url.includes('/rpc/school_push_queue_device_test')));
  assert(!calls.some(c=>c.url.startsWith('https://fcm.googleapis.com/')),'The server scheduler, not this request, must deliver the test');
 }finally{authorizedDevice=false;}
});

Deno.test('Scheduled device tests are delivered even with all content categories disabled',async()=>{
 calls.length=0;page=0;pushStatus=201;
 pending=[{subscription_id:'device',event_id:'test:one',attempts:0,
  school_push_events:{source:'device-test',title:'Background test',body:'The server sent this',path:'/notification-settings'},
  school_push_subscriptions:{id:'device',origin:'https://the-8apdf.vercel.app',subscription,preferences:{pdfs:false,announcements:false,testsOnly:true}}}];
 try{const result=await (await handler(req('poll'))).json();assert.equal(result.sent,1);}finally{pending=[];}
});

Deno.test('Browser receipts need a valid scoped signature, not an open page or login session',async()=>{
 const deviceId='a'.repeat(64),receiptId=crypto.randomUUID();
 const token=await signReceipt(deviceId,receiptId,'worker-secret');
 const receipt=(value:string,origin='https://8apdf.vercel.app',stage='shown')=>new Request('https://example.test',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'receipt',token:value,stage})});
 assert.equal((await handler(receipt('forged'))).status,401);
 assert.equal((await handler(receipt(token,'https://evil.test'))).status,403);
 assert.equal((await handler(receipt(token,'https://8apdf.vercel.app','unknown'))).status,401);
 calls.length=0;assert.equal((await handler(receipt(token))).status,200);
 const update=calls.find(c=>c.method==='PATCH'&&c.body?.notification_shown_at);assert(update);
 assert.equal(update.body.worker_version,'lockscreen-v2');
 assert(update.url.includes('subscription_id=eq.'+deviceId));assert(update.url.includes('receipt_id=eq.'+receiptId));
 assert(update.url.includes('notification_shown_at=is.null'),'Late errors cannot erase confirmed display');
 assert(!calls.some(c=>c.url.includes('/auth/v1/user')),'Background receipts must work without a page session');
});
