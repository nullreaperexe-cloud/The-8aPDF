import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=readFileSync(new URL('../features/app-core.js',import.meta.url),'utf8');
const section=(start,end)=>{
 const from=html.indexOf(start);
 assert(from>=0,'Missing source block: '+start);
 const to=html.indexOf(end,from+start.length);
 assert(to>=0,'Missing end marker: '+end);
 return html.slice(from,to);
};

assert(!html.includes('eightapdf-maintenance'),'Maintenance overlay should be gone');
assert(!html.includes('Website Under Maintenance'),'Page title should be restored');
assert(html.includes('data-school-term="all"'),'All PDFs term selector should be available');
assert(core.includes("sort:'new'"),'Latest-first PDF sort should be default');
assert(core.includes("refreshSupabaseMaterials();"));
assert(core.includes("refreshSupabaseAnnouncements();"));

const code=[
 section('function sortedDocs(){','function dateMs('),
 section('function dateMs(v){','function pdfDateYMD('),
 section('function normalizeDoc(d){',"$('#pdfGrid').onclick"),
 section('function announcementTime(x){','\nfunction renderAnnouncementFilters(')
].join('\n');
const state={
 materials:[],filter:'All Subjects',term:'all',query:'',sort:'new'
};
const {normalizeDoc,sortedDocs,dateMs,pdfUploadMs,announcementTime}=new Function(
 'state','termOfPdf','keywords',code+'\nreturn {normalizeDoc,sortedDocs,dateMs,pdfUploadMs,announcementTime};'
)(state,()=>'term1',x=>(x.title+' '+x.subject).toLowerCase());

state.materials=[
 normalizeDoc({id:'old',title:'Old homework',subject:'Math',pdf_url:'https://example.org/old.pdf',
  date_iso:'2026-10-09',created_at:'2026-10-17T17:00:00Z'}),
 normalizeDoc({id:'new',title:'New school PDF',subject:'Science',pdf_url:'https://example.org/new.pdf',
  source_date:'2026-10-17T00:00:00Z',created_at:'2026-10-17T16:00:00Z'}),
 normalizeDoc({id:'middle',title:'Oct 12',subject:'Hindi',pdf_url:'https://example.org/mid.pdf',
  date_iso:'2026-10-12',created_at:'2026-10-18T12:00:00Z'})
];
assert.deepEqual(sortedDocs().map(x=>x.id),['middle','old','new'],
 'Upload time must outrank the school date');
assert.equal(state.materials[0].createdAt,'2026-10-09','School dates remain available for display and term filters');
assert.equal(sortedDocs().length,3,'All PDFs default should not filter out old terms');
state.sort='old';
assert.deepEqual(sortedDocs().map(x=>x.id),['new','old','middle']);
state.sort='new';
state.materials.push(normalizeDoc({id:'admin-upload',title:'Backdated school notes',subject:'Math',
 pdf_url:'https://example.org/admin.pdf',source_date:'2026-09-01',
 inserted_at:'2026-10-18T13:30:00Z',created_at:'2026-10-17T00:00:00Z',order:999}));
assert.equal(sortedDocs()[0].id,'admin-upload','Verified insertion time wins even for a backdated PDF');
assert.equal(pdfUploadMs(state.materials.at(-1)),Date.parse('2026-10-18T13:30:00Z'));
state.materials.push(normalizeDoc({id:'edited-old',title:'Edited older PDF',subject:'Math',
 pdf_url:'https://example.org/edited.pdf',source_date:'2026-12-01',
 inserted_at:'2026-10-17T01:00:00Z',updated_at:'2026-10-20T18:00:00Z',order:-999}));
assert.equal(sortedDocs()[0].id,'admin-upload','An edit or future school date must not promote an older upload');
assert.deepEqual(sortedDocs().map(x=>x.id),['admin-upload','middle','old','new','edited-old']);
state.filter='Math';
assert.deepEqual(sortedDocs().map(x=>x.id),['admin-upload','old','edited-old'],'Subject filters retain upload order');
state.filter='All Subjects';
const fallback=normalizeDoc({id:'fallback',source_date:'2026-09-01',inserted_at:'invalid',created_at:'2026-10-01T12:00:00Z'});
assert.equal(pdfUploadMs(fallback),Date.parse('2026-10-01T12:00:00Z'),'Invalid or missing insertion times use a valid creation timestamp');
assert.equal(pdfUploadMs(normalizeDoc({id:'legacy',date_iso:'2026-08-05'})),Date.parse('2026-08-05'),'School date is the fallback when no upload timestamp exists');
const sameDay=[
 normalizeDoc({id:'morning',source_date:'2026-10-17',inserted_at:'2026-10-17T08:00:00Z',order:-20}),
 normalizeDoc({id:'afternoon',source_date:'2026-10-17',inserted_at:'2026-10-17T12:00:00Z',order:20})
];
state.materials=sameDay;
assert.deepEqual(sortedDocs().map(x=>x.id),['afternoon','morning'],'Same-day uploads sort by time rather than legacy order');
state.sort='old';assert.deepEqual(sortedDocs().map(x=>x.id),['morning','afternoon']);
assert.equal(dateMs({seconds:1792195200,nanoseconds:0}),1792195200000);
assert.equal(announcementTime({
 messageDate:'2026-10-17T00:00:00Z',createdAt:'2026-10-09T00:00:00Z'
}),dateMs('2026-10-17T00:00:00Z'));
console.log('PASS newest uploads first, insertion/legacy timestamp fallbacks, same-day order, filters and original school dates');
