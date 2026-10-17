import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {allowedPushOrigin,notificationPath,retryState} from '../shared/push-policy.js';
assert(allowedPushOrigin('https://the-8apdf.vercel.app'));
assert(!allowedPushOrigin('https://the-8apdf.vercel.app.evil.test'));
assert.equal(notificationPath('http://[','https://the-8apdf.vercel.app'),'/');
assert.equal(notificationPath('//evil.test','https://the-8apdf.vercel.app'),'/');
assert.equal(notificationPath('/tests?x=1#paper','https://the-8apdf.vercel.app'),'/tests?x=1#paper');
assert.equal(retryState(5,null,0).status,'failed');
assert.equal(retryState(0,'120',0).next_attempt_at,new Date(120000).toISOString());
const events={},notifications=[],opened=[];
const self={location:{origin:'https://the-8apdf.vercel.app'},addEventListener:(name,handler)=>events[name]=handler,
 registration:{showNotification:async(title,options)=>notifications.push({title,options})},
 clients:{matchAll:async()=>[],openWindow:async path=>opened.push(path)},skipWaiting:async()=>{}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,URL});
async function push(data){let promise;events.push({data,waitUntil:p=>promise=p});await promise;}
await push({json:()=>({title:'New PDF',url:'http://[',tag:'one'})});
assert.equal(notifications.at(-1).options.data.path,'/');
await push({json:()=>null});await push({json:()=>17});
await push({json:()=>{throw Error()},text:()=> 'Plain school update'});
assert.equal(notifications.at(-1).options.body,'Plain school update');
let completion;events.notificationclick({notification:{close(){},data:{path:'/tests'}},waitUntil:p=>completion=p});await completion;
assert.deepEqual(opened,['/tests']);
let navigated,focused=false;
self.clients.matchAll=async()=>[{url:self.location.origin+'/settings',navigate:async path=>{navigated=path;return {focus:async()=>{focused=true}}}}];
events.notificationclick({notification:{close(){},data:{path:'/school-reminders?message=one'}},waitUntil:p=>completion=p});await completion;
assert.equal(navigated,'/school-reminders?message=one');assert(focused);

// Exercise the real client. Granted permission with no subscription MUST NOT
// create one on page load, and disabling must persist across a reload.
async function client({optIn=null,existing=null}={}){
 const storage=new Map(optIn===null?[]:[['8apdf_phone_notifications_v1_enabled',optIn]]);
 let creates=0,fetches=0;const requests=[];
 const subscription=existing||{endpoint:'https://fcm.googleapis.com/fcm/send/device',toJSON:()=>({}),unsubscribe:async()=>true};
 const reg={pushManager:{getSubscription:async()=>existing,subscribe:async()=>{creates++;return subscription;}}};
 const context={window:{isSecureContext:true,PushManager:{},Notification:{},__8apdfGetSocialClient:async()=>({db:{auth:{getSession:async()=>({data:{session:{access_token:'session'}}})}}})},
  navigator:{serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg),addEventListener(){}}},
  Notification:{permission:'granted'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  document:{dispatchEvent(){}},Event:class{},AbortSignal,TextEncoder,crypto:globalThis.crypto,atob,
  fetch:async(url,options)=>{fetches++;requests.push(options);return {ok:true,json:async()=>({publicKey:'AQID',subscriptions:[],queued:true})}},
  setTimeout:()=>0,clearTimeout(){},console};
 vm.runInNewContext(fs.readFileSync('push-notifications.js','utf8'),context);
 await new Promise(setImmediate);
 return {context,storage,requests,creates:()=>creates,fetches:()=>fetches};
}
let state=await client();assert.equal(state.creates(),0);
state=await client({optIn:'false',existing:{endpoint:'x'}});assert.equal(state.fetches(),0,'Opted-out subscriptions cannot be automatically registered');
state=await client();await state.context.window.__8apdfPush.disable();assert.equal(state.storage.get('8apdf_phone_notifications_v1_enabled'),'false');
state=await client({optIn:'true',existing:{endpoint:'https://fcm.googleapis.com/fcm/send/device',toJSON:()=>({})}});
assert.equal((await state.context.window.__8apdfPush.testClosed()).queued,true);
assert.equal(JSON.parse(state.requests.at(-1).body).action,'test-closed');
console.log('PASS native push payloads, safe click navigation, retry budget, current-origin CORS and persistent opt-out');
