import assert from 'node:assert/strict';
import {
 SUPABASE_PROJECT_URL,SUPABASE_PUBLISHABLE_KEY
} from '../supabase-materials.js';
import {
 SUPABASE_ANNOUNCEMENTS_URL,
 listSupabaseAnnouncements,
 fetchAllSupabaseAnnouncements,
 normalizeSupabaseAnnouncement
} from '../supabase-announcements.js';

assert.equal(SUPABASE_PROJECT_URL,'https://xudhjwojgxblbsebkzso.supabase.co');
assert.equal(SUPABASE_ANNOUNCEMENTS_URL,SUPABASE_PROJECT_URL+'/rest/v1/announcements');
const rows=Array.from({length:5},(_,i)=>({
 id:'edusecure-'+(i+1),title:'Notice '+(i+1),subject:'Science',
 published:true,created_at:'2026-10-16T00:00:00Z',
 raw:{title:'Notice '+(i+1),category:'Homework',createdAt:{seconds:1792108800,nanoseconds:0}}
}));
let checked=0;
async function mockedFetch(url,options){
 const u=new URL(url);
 assert.equal(u.origin,SUPABASE_PROJECT_URL);
 assert.equal(u.pathname,'/rest/v1/announcements');
 assert.equal(options.headers.apikey,SUPABASE_PUBLISHABLE_KEY);
 assert.equal(u.searchParams.get('select'),'*');
 const size=Number(u.searchParams.get('limit'));
 const offset=Number(u.searchParams.get('offset')||0);
 checked++;
 let data=u.searchParams.has('id')?
  rows.filter(x=>x.id===u.searchParams.get('id').slice(3)).slice(0,size):
  rows.slice(offset,offset+size);
 return {ok:true,json:async()=>data};
}
assert.deepEqual((await listSupabaseAnnouncements({limit:2,offset:1,fetchImpl:mockedFetch})).map(x=>x.id),['edusecure-2','edusecure-3']);
assert.deepEqual((await listSupabaseAnnouncements({limit:1,id:'edusecure-4',fetchImpl:mockedFetch})).map(x=>x.id),['edusecure-4']);
assert.equal((await fetchAllSupabaseAnnouncements({pageSize:2,maxRows:10,fetchImpl:mockedFetch})).length,5);
assert.equal((await fetchAllSupabaseAnnouncements({pageSize:5,maxRows:5,fetchImpl:mockedFetch})).length,5);
assert.equal(normalizeSupabaseAnnouncement(rows[0]).category,'Homework');
assert.equal(normalizeSupabaseAnnouncement(rows[0]).createdAt.seconds,1792108800);
await assert.rejects(()=>listSupabaseAnnouncements({limit:0,fetchImpl:mockedFetch}),/page size/);
await assert.rejects(()=>fetchAllSupabaseAnnouncements({pageSize:2,maxRows:4,fetchImpl:mockedFetch}),/limit reached/);
await assert.rejects(
 ()=>listSupabaseAnnouncements({limit:1,fetchImpl:async()=>({ok:false,status:403,json:async()=>({code:'42501'})})}),
 /HTTP 403/
);
assert(checked>=5);
console.log('PASS 8aPDF Supabase announcements source, paging, timestamp normalization and read errors');
