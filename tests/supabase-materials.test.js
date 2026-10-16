import assert from 'node:assert/strict';
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  listStudyMaterials,
  fetchAllStudyMaterials
} from '../supabase-materials.js';

const rows=Array.from({length:5},(_,i)=>({
  id:String(i+1),
  title:'Test PDF '+(i+1),
  pdf_url:'https://example.org/pdf-'+(i+1)+'.pdf'
}));
let requests=0;
async function mockFetch(url,opts){
  const parsed=new URL(url);
  assert.equal(parsed.origin,SUPABASE_PROJECT_URL);
  assert.equal(parsed.pathname,'/rest/v1/study_materials');
  assert.equal(parsed.searchParams.get('select'),'*');
  assert.equal(parsed.searchParams.get('apikey'),SUPABASE_PUBLISHABLE_KEY);
  assert.equal(opts.headers.apikey,SUPABASE_PUBLISHABLE_KEY);
  assert.equal(opts.method,'GET');
  const limit=Number(parsed.searchParams.get('limit'));
  const offset=Number(parsed.searchParams.get('offset')||0);
  requests++;
  const id=parsed.searchParams.get('id');
  const data=id?rows.filter(r=>r.id===id.slice(3)).slice(0,limit):rows.slice(offset,offset+limit);
  return {ok:true,json:async()=>data};
}
assert.deepEqual((await listStudyMaterials({limit:2,offset:2,fetchImpl:mockFetch})).map(r=>r.id),['3','4']);
assert.deepEqual((await listStudyMaterials({id:'4',limit:1,fetchImpl:mockFetch})).map(r=>r.id),['4']);
assert.deepEqual((await fetchAllStudyMaterials({pageSize:2,maxRows:10,fetchImpl:mockFetch})).map(r=>r.id),['1','2','3','4','5']);
assert.deepEqual((await fetchAllStudyMaterials({pageSize:5,maxRows:5,fetchImpl:mockFetch})).map(r=>r.id),['1','2','3','4','5']);
await assert.rejects(()=>listStudyMaterials({limit:0,fetchImpl:mockFetch}),/limit/);
await assert.rejects(()=>fetchAllStudyMaterials({pageSize:2,maxRows:4,fetchImpl:mockFetch}),/limit reached/);
await assert.rejects(
 ()=>listStudyMaterials({limit:1,fetchImpl:async()=>({ok:false,status:403,json:async()=>({message:'RLS denied'})})}),
 /HTTP 403/
);
assert(requests>=5);
console.log('PASS Supabase study_materials endpoint, key, pagination, ID lookups and errors');
