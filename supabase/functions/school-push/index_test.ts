// Runs the actual handler with mocked HTTP boundaries; no live devices are used.
import assert from 'node:assert/strict';
import webpush from 'npm:web-push@3.6.7';
import {createECDH,randomBytes} from 'node:crypto';
Deno.env.set('SUPABASE_URL','https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-key');
let handler:(req:Request)=>Promise<Response>;
const originalServe=Deno.serve;
Deno.serve=((callback:any)=>{handler=callback;return {};}) as any;
const vapid=webpush.generateVAPIDKeys(),device=createECDH('prime256v1');device.generateKeys();
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const calls:any[]=[];let page=0,pending:any[]=[],failIngest=false,pushStatus=201,lookupEmail="";
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
globalThis.fetch=(async(input:any,init:any={})=>{
 const url=String(input),body=init.body?JSON.parse(typeof init.body==='string'?init.body:'{}'):null;
 calls.push({url,method:init.method||'GET',body});
 if(url.includes('/school_push_config')&&(init.method||'GET')==='GET')return json({id:1,vapid_public_key:vapid.publicKey,vapid_private_key:vapid.privateKey,worker_secret:'worker-secret'});
 if(url.includes('/rpc/school_push_claim_run_v2'))return json('00000000-0000-0000-0000-000000000001');
 if(url.includes('documents:runQuery')){
  if(body.structuredQuery.from[0].collectionId==='announcements')return json([]);
  const start=page++*500,count=Math.min(500,1001-start);
  if(start>0)assert.equal(body.structuredQuery.startAt.before,false);
  return json(Array.from({length:Math.max(0,count)},(_,i)=>({document:{name:'projects/test/databases/(default)/documents/study_materials/'+(start+i),fields:{title:{stringValue:'Science Notes '+(start+i)}}}})));
 }
 if(url.includes('/rpc/school_push_ingest'))return failIngest?json({message:'Atomic fan-out failed'},500):json({records:body.records.length,new:0,queued:0,baseline:false});
 if(url.includes('/school_push_deliveries')&&(init.method||'GET')==='GET')return json(pending);
 if(url.startsWith('https://fcm.googleapis.com/'))return new Response('',{status:pushStatus,headers:{'Retry-After':'120'}});
 if(url.includes('identitytoolkit'))return lookupEmail?json({users:[{email:lookupEmail,disabled:false}]}):json({error:{message:'INVALID_ID_TOKEN'}},400);
 if(url.includes('/auth/v1/user'))return json({msg:'Invalid JWT'},401);
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
  if(status===201){assert.equal(result.sent,1);assert(calls.some(c=>c.method==='PATCH'&&c.body?.status==='sent'));}
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
