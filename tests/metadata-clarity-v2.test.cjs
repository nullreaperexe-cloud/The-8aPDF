/* Evidence-based metadata normalizer regression suite. No database/network writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const root={};
vm.runInNewContext(fs.readFileSync('shared/title-clarity.js','utf8'),{window:root,globalThis:root});
const x=root.__8apdfTitleClarity;
const contaminated={id:'p-17',title:'MM/ /01/',
 filename:'English_Grammar_Worksheet.pdf',
 description:'Worksheet covering grammar. Attachment Pay Now Class Test Circular',
 pdf_url:'https://example.org/a.pdf',subject:'English',createdAt:'2026-11-13'};
const clean=x.normalizeMaterial(contaminated);
assert.equal(clean.title,'English Grammar Worksheet');
assert.equal(clean.description,'Worksheet covering grammar.');
assert.equal(clean.id,'p-17');assert.equal(clean.pdf_url,contaminated.pdf_url);
assert.equal(clean.subject,'English');assert.equal(clean.createdAt,contaminated.createdAt);
assert.equal(contaminated.title,'MM/ /01/','Original input must not be changed');
assert.equal(clean._sourceMetadata.title,'MM/ /01/');
assert.equal(clean._metadataQuality.reviewNeeded,true);
assert.deepEqual(JSON.stringify(x.normalizeMaterial(clean)),JSON.stringify(clean),'Idempotent result');
assert.equal(x.inspect({title:'MM/ /01/'}).title,'School Material');
assert.equal(x.inspect({title:'',filename:'Mathematics_Exercise_7.1.pdf'}).title,'Mathematics Exercise 7.1');
assert.equal(x.inspect({title:'Scan_02',filename:'scan_02.pdf',description:''}).title,'School Material');
assert.equal(x.inspect({title:'Scan_02'}).description,'Document details are not available.');
assert.equal(x.inspect({title:'Class Test Circular',description:'Class Test Circular on Monday'}).title,'Class Test Circular');
assert.equal(x.inspect({title:'Class Test Circular',description:'Class Test Circular on Monday'}).description,'Class Test Circular on Monday');
assert.equal(x.inspect({title:'Science Chapter 5 Practice',description:'Questions from Chapter 5'}).title,'Science Chapter 5 Practice');
assert.equal(x.display({title:'Ch. 14 was completed in the book &',description:'antonyms were done in module 7'}),'Chapter 14 Completed · Antonyms (Module 7)');
assert.equal(x.display({title:'Complete Q1 to 8 of Exercise 6.1 find'}),'Complete Q1 to 8 of Exercise 6.1');
assert.equal(x.inspect({title:'ਪੰਜਾਬੀ ਪਾਠ ਮਾਂ ਦਾ ਸਾਰ',description:'ਪਾਠ ਮਾਂ ਦਾ ਸਾਰ ਪੜ੍ਹੋ'}).title,'ਪੰਜਾਬੀ ਪਾਠ ਮਾਂ ਦਾ ਸਾਰ');
assert.equal(x.inspect({title:'हिंदी पाठ ४',description:'पाठ ४ पढ़ें'}).title,'हिंदी पाठ ४');
assert.equal(x.inspect({title:'HTML & PDF Worksheet',description:'HTML tags'}).title,'HTML & PDF Worksheet');
assert.equal(x.inspect({title:'Algebra x² + y² = z²',description:'Questions x² + y² = z²'}).title,'Algebra x² + y² = z²');
assert.equal(x.inspect({title:'<b>School</b> <script>evil()</script>Work',description:'<p>Homework</p>'}).title,'School Work');
const approved=x.inspect({title:'Teacher-approved custom label',description:'Approved exercise',
 metadata_review_status:'approved'});
assert.equal(approved.title,'Teacher-approved custom label');
assert.equal(x.validateSuggestion({title:'Galactic Quasar Chapter 99',description:'Read it'},
 {title:'Maths Chapter 4',description:'Exercise 4.1'}).valid,false);
assert.equal(x.validateSuggestion({title:'English Worksheet',description:'Grammar practice'},
 {filename:'English_Worksheet.pdf',description:'Grammar practice'}).valid,true);
assert.equal(x.normalizeMaterial(clean)._sourceMetadata.title,'MM/ /01/');
assert.equal(x.clean('Class Test Circular'),'Class Test Circular');
const core=fs.readFileSync('features/app-core.js','utf8');
assert.match(core,/normalizeMaterial\?\.\(d\)/);
assert.match(core,/rawSource:d/);
assert.match(core,/originalDescription:/);
assert.match(core,/title:x\.title,subject:x\.subject,description:x\.description/);
assert.match(core,/function keywords\(x\)/);
assert.match(core,/function renderRecent\(\)/);
assert.match(core,/function renderCommand\(\)/);
assert.match(core,/const fname=\(x\.title\|\|'study-material'\)/);
(async()=>{
 const {pdfCard}=await import('../shared/pdf-card.js');
 globalThis.__8apdfTitleClarity=x;
 const html=pdfCard({id:'<unsafe>',title:'<img onerror=alert(1)>',description:'<script>alert(1)</script>',
  subject:'HTML',createdAt:'Today'});
 assert(!html.includes('<img onerror='));
 assert(!html.includes('<script>'));
 assert(html.includes('&lt;unsafe&gt;'));
 assert(html.includes('data-action="summary"'));
 console.log('PASS metadata clarity: polluted imports, evidence, scripts, language, fallback, confidence, unchanged IDs and escaping');
})().catch(e=>{console.error(e);process.exitCode=1});
