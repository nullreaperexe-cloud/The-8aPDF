import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
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
assert(html.includes("sort:'new'"),'Latest-first PDF sort should be default');
assert(html.includes("refreshSupabaseMaterials();"));
assert(html.includes("refreshSupabaseAnnouncements();"));

const code=[
 section('function sortedDocs(){','function dateMs('),
 section('function dateMs(v){','function pdfDateYMD('),
 section('function normalizeDoc(d){',"$('#pdfGrid').onclick"),
 section('function announcementTime(x){','\nfunction renderAnnouncementFilters(')
].join('\n');
const state={
 materials:[],filter:'All Subjects',term:'all',query:'',sort:'new'
};
const {normalizeDoc,sortedDocs,dateMs,announcementTime}=new Function(
 'state','termOfPdf','keywords',code+'\nreturn {normalizeDoc,sortedDocs,dateMs,announcementTime};'
)(state,()=>'term1',x=>(x.title+' '+x.subject).toLowerCase());

state.materials=[
 normalizeDoc({id:'old',title:'Old homework',subject:'Math',pdf_url:'https://example.org/old.pdf',
  date_iso:'2026-10-09',created_at:'2026-10-17T17:00:00Z'}),
 normalizeDoc({id:'new',title:'New school PDF',subject:'Science',pdf_url:'https://example.org/new.pdf',
  source_date:'2026-10-17T00:00:00Z',created_at:'2026-10-17T16:00:00Z'}),
 normalizeDoc({id:'middle',title:'Oct 12',subject:'Hindi',pdf_url:'https://example.org/mid.pdf',
  date_iso:'2026-10-12',created_at:'2026-10-18T12:00:00Z'})
];
assert.deepEqual(sortedDocs().map(x=>x.id),['new','middle','old'],
 'Original school date must outrank data-import date');
assert.equal(sortedDocs().length,3,'All PDFs default should not filter out old terms');
state.sort='old';
assert.deepEqual(sortedDocs().map(x=>x.id),['old','middle','new']);
state.sort='new';
assert.equal(dateMs({seconds:1792195200,nanoseconds:0}),1792195200000);
assert.equal(announcementTime({
 messageDate:'2026-10-17T00:00:00Z',createdAt:'2026-10-09T00:00:00Z'
}),dateMs('2026-10-17T00:00:00Z'));
console.log('PASS no maintenance; all Supabase documents; school date latest-first');
