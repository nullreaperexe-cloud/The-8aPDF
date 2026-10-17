// Exercise the real Chrome service worker with every application tab closed.
// DevTools injects the push; this test does not contact any live subscriber.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/sw.js'?'text/javascript':'text/html'});res.end(req.url==='/sw.js'?code:'<!doctype html><title>Background push test</title>');});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
try{
 const context=await browser.newContext();await context.grantPermissions(['notifications'],{origin});
 const harness=await context.newPage(),cdp=await context.newCDPSession(harness);
 let registrationId;
 cdp.on('ServiceWorker.workerRegistrationUpdated',({registrations})=>{for(const r of registrations)if(r.scopeURL===origin+'/')registrationId=r.registrationId;});
 await cdp.send('ServiceWorker.enable');
 const app=await context.newPage();await app.goto(origin);
 await app.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await harness.waitForFunction(()=>true);
 assert(registrationId,'Chrome reported the actual worker registration');
 const worker=context.serviceWorkers().find(w=>w.url()===origin+'/sw.js');assert(worker);
 await worker.evaluate(()=>{
  self.__pushDisplayTest=[];
  self.addEventListener('push',()=>self.__pushDisplayTest.push({received:true}));
  const native=self.registration.showNotification.bind(self.registration);
  self.registration.showNotification=async(title,options)=>{
   try{const result=await native(title,options);self.__pushDisplayTest.push({title,silent:options.silent,accepted:true});return result;}
   catch(error){self.__pushDisplayTest.push({error:error.message});throw error;}
  };
 });
 await app.close();assert(!context.pages().some(p=>p.url().startsWith(origin)),'All application windows must be closed');
 await cdp.send('ServiceWorker.deliverPushMessage',{origin,registrationId,data:JSON.stringify({title:'Closed-site Chrome test',body:'Received with no website window',tag:'closed-browser-test',url:'/notification-settings'})});
 let displayed=[];
 for(let attempt=0;attempt<20;attempt++){
  displayed=await worker.evaluate(()=>self.__pushDisplayTest.filter(result=>result.accepted));
  if(displayed.length)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(displayed[0]?.title,'Closed-site Chrome test');
 assert.equal(displayed[0]?.silent,false);
 // Headless Chrome resolves the real native API but cannot verify OS surfaces.
 console.log('PASS real Chrome accepts the non-silent notification with every website window closed; physical lock-screen display requires a phone test');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
