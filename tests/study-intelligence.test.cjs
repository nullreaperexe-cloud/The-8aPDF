/* Deterministic school reminder tests: absolutely no Gemini or real Firebase calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('study-intelligence.js','utf8'),css=fs.readFileSync('study-intelligence.css','utf8'),html=fs.readFileSync('index.html','utf8');
new vm.Script(src,{filename:'study-intelligence.js'});
const listeners={},saved=new Map();
const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
const dom={readyState:'loading',hidden:false,getElementById:()=>null,addEventListener:(event,fn)=>{listeners[event]=fn},querySelector:()=>null};
const w={};
vm.runInNewContext(src,{window:w,document:dom,localStorage:storage,sessionStorage:storage,Date,Intl,Set,Map,Array,Number,String}, {filename:'study-intelligence.js'});
assert(w.__8apdfStudyIntel,'Study intelligence API must load');
const today=new Date(),later=new Date(today.getFullYear(),today.getMonth(),today.getDate()+3),iso=[later.getFullYear(),String(later.getMonth()+1).padStart(2,'0'),String(later.getDate()).padStart(2,'0')].join('-');
listeners['8apdf:teacher-data']({detail:[
 {id:'test-1',title:'Science Unit Test',description:'Chapter 5 unit test on '+iso,category:'Tests',eventDate:iso,messageDate:'2026-10-11'},
 {id:'note-1',title:'English notebook submission',description:'Submit English notebook by '+iso,category:'Homework',eventDate:iso},
 {id:'test-undated',title:'Maths class test',description:'Prepare exercise 2; date not yet shared',category:'Tests'}
]});
const up=w.__8apdfStudyIntel.upcoming();
assert.equal(up.length,2,'Only dated future events must become reminders');
assert(up.some(e=>e.id==='test-1'));
assert(up.some(e=>e.id==='note-1'));
assert(!up.some(e=>e.id==='test-undated'),'Undated tests cannot create reminders');
const ans=w.__8apdfStudyIntel.answer('When is the next Science test?');
assert(ans.message.includes(iso), 'Science test date must be grounded');
assert(!ans.message.includes('Maths class test'),'Other subjects must not be invented');
const submit=w.__8apdfStudyIntel.answer('Any notebook submission coming up?');
assert(submit.message.includes('English notebook submission'),'Notebook submission must be found');
assert.equal(w.__8apdfStudyIntel.answer('Find Science chapter 3 PDF'),null,'PDF questions belong to PDF Finder');
assert.equal(w.__8apdfStudyIntel.customKey(),'','Default API key must stay private');
assert(html.includes('announcements:()=>state.announcements.map'),'Real announcements bridge missing');
assert(html.includes('showNoticeResults(resultAI)'),'Grounded AI result renderer missing');
assert(css.includes('ws-event-toast'),'Visual reminder must exist');
console.log('PASS local test/notebook announcements, dated memory and default-key privacy');
