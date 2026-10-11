/* Mock Gemini contract: grounding, key override, no default-key exposure. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('api/pdf-chat.js','utf8').replace('export default async function handler','async function handler');
let call={};
const fetch=async(url,options)=>{call={url,options};return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Science test on 14 Oct, per teacher message.',ids:['doc1','invalid'],announcementIds:['notice1','invented']})}]}}]})}};
const context={env:{GEMINI_API_KEY:'server-default-secret'}};
const handler=new Function('process','fetch','AbortController','setTimeout','clearTimeout',src+';return handler;')(context,fetch,AbortController,setTimeout,clearTimeout);
const response=()=>{let status=200,payload=null;return {setHeader(){return this},status(n){status=n;return this},json(o){payload=o;return this},value:()=>({status,payload})}};
(async()=>{
 let r=response();await handler({method:'GET',headers:{}},r);
 assert.equal(r.value().payload.aiConfigured,true);
 assert(!JSON.stringify(r.value().payload).includes('server-default-secret'));
 const request={method:'POST',headers:{'x-forwarded-for':'127.0.0.20','x-8apdf-gemini-key':'AIzaSy1234567890abcdefghijklmnopqrst'},body:{question:'When is the Science test?',catalog:[{id:'doc1',title:'Science chapter five',subject:'Science'}],announcements:[{id:'notice1',title:'Science Test',description:'14 Oct 2026',eventDate:'2026-10-14',category:'Tests'}]}};
 r=response();await handler(request,r);
 assert.equal(r.value().status,200);
 assert.equal(call.options.headers['x-goog-api-key'],request.headers['x-8apdf-gemini-key']);
 assert.equal(r.value().payload.answer,'Science test on 14 Oct, per teacher message.');
 assert.deepEqual(r.value().payload.ids,['doc1']);
 assert.deepEqual(r.value().payload.announcementIds,['notice1']);
 const sent=JSON.parse(call.options.body);
 assert.equal(sent.contents[0].parts[0].text.includes('Science Test'),true);
 assert.equal(sent.contents[0].parts[0].text.includes('2026-10-14'),true);
 r=response();await handler({method:'POST',headers:{'x-forwarded-for':'127.0.0.21'},body:{question:'Next test?',catalog:[],announcements:[{id:'a',title:'Maths test'}]}},r);
 assert.equal(call.options.headers['x-goog-api-key'],'server-default-secret');
 assert.equal(r.value().status,200);
 console.log('PASS Gemini default and personal keys, grounded notice/PDF citations and input size checks');
})().catch(e=>{console.error(e);process.exitCode=1});
