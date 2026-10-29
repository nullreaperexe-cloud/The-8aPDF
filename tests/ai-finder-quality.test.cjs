/* Regression suite: test the exact inline AI Finder ranking, not a separate mock. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const begin=html.indexOf('const normalize=s=>',html.indexOf('<script id="8apdf-chatbot-client">'));
const end=html.indexOf('function makeMessage(',begin);
assert(begin>0&&end>begin,'Finder ranking implementation must exist');
const inline=html.slice(begin,end);
const fetch=async()=>({ok:false});
const {rank,chapterOf,subjectOf,termOf,normalize}=new Function('fetch',inline+';return {rank,chapterOf,subjectOf,termOf,normalize}')(fetch);
const docs=[
 {id:'a',title:'Science Chapter 3 - Force Notes',subject:'Science',description:'Friction and force',chapter:'3',term:'term2',dateMs:2},
 {id:'b',title:'Science Chapter 2 - Cells',subject:'Science',description:'Cells and microbiology',chapter:'2',term:'term2',dateMs:3},
 {id:'c',title:'Mathematics Chapter 5 Worksheet',subject:'Other',description:'Chapter 5 exercises',chapter:'5',term:'term2',dateMs:1},
 {id:'d',title:'Hindi Chapter 3 Literature',subject:'Hindi',description:'कविता पाठ',chapter:'3',term:'term1',dateMs:1},
 {id:'e',title:'Computer Chapter 3',subject:'Computer',description:'HTML',chapter:'3',term:'term2',dateMs:7},
 {id:'f',title:'Science chapter 3 - Practice',subject:'Science',description:'Practice questions',chapter:'3',term:'term2',dateMs:9}
];
assert.deepEqual(rank('science chapter 3 pdf',docs).map(x=>x.id),['f','a']);
assert.deepEqual(rank('maths ch5 worksheet',docs).map(x=>x.id),['c']);
assert.deepEqual(rank('Hindi chapter 3 term 1',docs).map(x=>x.id),['d']);
assert.deepEqual(rank('Computer chapter 3',docs).map(x=>x.id),['e']);
assert.equal(chapterOf('Science ch3'),'3');
assert.equal(subjectOf('SST'),'social science');
assert.equal(termOf('term 2'),'term2');
assert.deepEqual(rank('Physics Chapter 12',docs),[],'Unknown chapters must not hallucinate PDF results');
const notes=[
 {id:'n1',title:'Science Unit Test',description:'Chapter 3 test on 3 Nov',category:'Tests',messageDate:'2026-10-28'},
 {id:'n2',title:'English Notebook Submission',description:'Bring literature notebook',category:'Homework',messageDate:'2026-10-28'},
 {id:'n3',title:'Science homework',description:'Complete exercises',category:'Homework',messageDate:'2026-10-28'},
];
assert.deepEqual(rank('Science test',notes,'announcement').map(x=>x.id),['n1'],'Tests must not be confused with homework');
assert.deepEqual(rank('English notebook submission',notes,'announcement').map(x=>x.id),['n2']);

assert.deepEqual(rank('Science homework',notes,'announcement').map(x=>x.id),['n3'],'Science homework must not turn into a test');
assert.equal(rank('latest teacher announcements',notes,'announcement').length,3,'Generic latest teacher messages must be discoverable');
assert.deepEqual(rank('Which test is coming next?',notes,'announcement').map(x=>x.id),['n1'],'Natural-language upcoming test question must work');
assert.deepEqual(rank('Any notebook submissions coming up?',notes,'announcement').map(x=>x.id),['n2'],'Upcoming notebook query must find the correct notice');
assert.deepEqual(rank('Maths chapter 3',docs).map(x=>x.id),[],'Cross-subject chapter collisions must be rejected');
assert.deepEqual(rank('latest PDFs',docs).map(x=>x.id).slice(0,2),['f','e'],'Recent PDF search must order by date');
assert.equal(subjectOf('physics'),'science','Physics belongs to Science');
assert.deepEqual(rank('SCIENCE CH3',docs).map(x=>x.id),['f','a'],'Compact upper-case chapter search must keep exact chapter results');
assert(!fs.readFileSync('api/pdf-chat.js','utf8').includes('GEMINI_API_KEY'),'No Gemini server key should remain in the Finder');
const large=Array.from({length:600},(_,i)=>({id:'large-'+i,title:'Science Chapter '+(i%12+1)+' Practice',subject:'Science',description:'revision and concepts',chapter:String(i%12+1),term:'term2',dateMs:i}));
const started=performance.now();
const matches=rank('Science chapter 3',large);
assert(matches.length>0&&matches.every(d=>d.chapter==='3'),'Large-library matches must remain strictly chapter-specific');
assert(performance.now()-started<500,'Instant local ranking must stay within a small browser CPU budget');

assert(html.includes("Groq available when needed"));
assert(!html.includes('x-8apdf-gemini-key'));
assert(!html.includes('Gemini only when needed'));
assert(fs.existsSync('data/ai-finder-training.json'));
assert.equal(JSON.parse(fs.readFileSync('data/ai-finder-training.json','utf8')).version,1);
console.log('PASS exact chapter and subject ranking; multilingual search; teacher tests vs homework; Groq-only UI');
