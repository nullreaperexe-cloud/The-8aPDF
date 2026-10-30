import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import '../announcement-format.js';

const F=globalThis.__8aPDFAnnouncementFormat;

test('personal attendance is blocked, but ordinary class notices stay',()=>{
  assert.equal(F.blocked({id:'edusecure-0779a1bb3f03949fb1c2b02fe692838b'}),true);
  assert.equal(F.blocked({title:'Attendance Your Child X is absent today'}),true);
  assert.equal(F.blocked({title:'Class attendance is compulsory tomorrow'}),false);
  assert.equal(F.blocked({title:'Do the French worksheet in your notebook'}),false);
});

test('homework and classwork become separate, readable sections',()=>{
  const m={title:'French Worksheet',message:'Message Oct 30, 2026 Home Work : Do the worksheet shared in PDF in your notebook. Class Work : FRENCH Les adjectifs demonstratifs'};
  const result=F.build(m);
  assert.deepEqual(result.sections.map(s=>s.heading),['Homework','Classwork']);
  assert.match(result.sections[0].points.join(' '),/worksheet shared in PDF/);
  assert.match(result.sections[1].points.join(' '),/Les adjectifs demonstratifs/);
  assert.doesNotMatch(F.toWhatsApp(m),/Oct 30, 2026/);
});

test('WhatsApp output uses mobile-friendly bold headers and bullets',()=>{
  const text=F.toWhatsApp({title:'French Worksheet',message:'Complete the worksheet. Bring it tomorrow.'});
  assert.ok(text.startsWith('*French Worksheet*'));
  assert.match(text,/\*Key details\*/);
  assert.match(text,/• Complete the worksheet/);
  assert.match(text,/_Shared via 8aPDF_/);
});

test('HTML renderer escapes input instead of injecting markup',()=>{
  const html=F.toHtml({title:'Update',message:'<img src=x onerror=alert(1)> Please study science'});
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/Please study science/);
});

test('AI points can be shown without extra browser requests',()=>{
  const sections=F.build({title:'Library',message:'General notice for school',keyPoints:['Bring the exercise notebook']}).sections;
  assert.equal(sections[0].points[0],'Bring the exercise notebook');
});

test('main home page wires clean reader, source filter, share actions',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/announcement-format\.js/);
  const core=readFileSync(new URL('../features/app-core.js',import.meta.url),'utf8');
  assert.match(core,/AFormat\.toHtml\(x\)/);
  assert.match(core,/AFormat\.toWhatsApp\(x\)/);
  assert.match(core,/AFormat\.blocked\(x\)/);
  assert.match(core,/shareWhatsAppAnnouncement/);
  assert.match(html,/features\/app-core\.js/);
  assert.doesNotThrow(()=>new Script(core,{filename:'features/app-core.js'}));
});
