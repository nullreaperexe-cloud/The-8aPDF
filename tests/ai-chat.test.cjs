/* Mock Groq contract: server-only key, grounded IDs, rate and response validation. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('api/pdf-chat.js','utf8').replace('export default async function handler','async function handler');
let call={};
const fetch=async(url,options)=>{
 call={url,options};
 return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({
   answer:'Science test on 14 October per teacher message.',
   ids:['doc1','invented'],
   announcementIds:['notice1','invented']
 })}}]})};
};
const processMock={env:{GROQ_API_KEY:'server-only-secret'}};
const handler=new Function('process','fetch','AbortController','setTimeout','clearTimeout',src+';return handler;')(
 processMock,fetch,AbortController,setTimeout,clearTimeout
);
const response=()=>{
 let status=200,payload=null;
 return {setHeader(){return this},status(n){status=n;return this},json(o){payload=o;return this},
  value:()=>({status,payload})};
};
(async()=>{
 let r=response();await handler({method:'GET',headers:{}},r);
 assert.equal(r.value().payload.aiConfigured,true);
 assert(!JSON.stringify(r.value().payload).includes('server-only-secret'));
 const question='When is the Science test?';
 r=response();await handler({method:'POST',headers:{'x-forwarded-for':'127.0.0.20'},
  body:{question,catalog:[{id:'doc1',title:'Science Chapter 3',subject:'Science'}],
   announcements:[{id:'notice1',title:'Science Test',description:'Unit test on 14 October',messageDate:'2026-10-13',eventDate:'2026-10-14'}]}
 },r);
 assert.equal(r.value().status,200);
 assert.equal(call.url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(call.options.headers.Authorization,'Bearer server-only-secret');
 assert(!JSON.stringify(call.options.body).includes('server-only-secret'));
 const sent=JSON.parse(call.options.body);
 assert.equal(sent.model,'llama-3.1-8b-instant');
 assert.equal(sent.response_format.type,'json_object');
 assert(sent.messages[1].content.includes('Science Test'));
 assert(sent.messages[1].content.includes('2026-10-14'));
 assert.deepEqual(r.value().payload.ids,['doc1']);
 assert.deepEqual(r.value().payload.announcementIds,['notice1']);
 assert.equal(r.value().payload.model,'llama-3.1-8b-instant');
 const bad=response();await handler({method:'POST',headers:{'x-forwarded-for':'127.0.0.21'},
  body:{question:'test',catalog:[],announcements:new Array(46).fill({id:'a',title:'x'})}},bad);
 assert.equal(bad.value().status,400);
 const disabled=new Function('process','fetch','AbortController','setTimeout','clearTimeout',src+';return handler;')(
  {env:{}},fetch,AbortController,setTimeout,clearTimeout
 );
 const none=response();await disabled({method:'GET',headers:{}},none);
 assert.equal(none.value().payload.aiConfigured,false);
 assert(!src.includes('GEMINI_API_KEY'));
 console.log('PASS Groq server secret isolation, grounded PDF and announcement citations, model JSON contract and limits');
})().catch(e=>{console.error(e);process.exitCode=1});
