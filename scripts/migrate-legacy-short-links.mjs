/**
 * Safely migrate every legacy 8aPDF custom PDF link from the ORIGINAL Vercel
 * Blob store into the new 8aPDF Supabase short_links table.
 *
 * Usage (run locally or a trusted CI secret environment):
 *   BLOB_READ_WRITE_TOKEN=<old-store-token> SUPABASE_SECRET_KEY=<server-secret> \
 *     node scripts/migrate-legacy-short-links.mjs
 *   # Review output and then add --apply to actually import.
 *
 * Never commit either secret. The public sb_publishable_ key cannot write.
 * No existing Supabase rows are overwritten.
 */
import {get,list} from '@vercel/blob';

const ROOT='short-links/v1/';
const SUPABASE_URL='https://xudhjwojgxblbsebkzso.supabase.co';
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const token=process.env.BLOB_READ_WRITE_TOKEN||'';
const apply=process.argv.includes('--apply');
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
if(!token)throw Error('BLOB_READ_WRITE_TOKEN from the ORIGINAL Vercel Blob store is required.');
if(apply&&(!key||key.startsWith('sb_publishable_')))throw Error('A private SUPABASE_SECRET_KEY is required for --apply.');

function valid(record){
 if(!record||!slugPattern.test(String(record.slug||''))||String(record.slug).includes('--'))return false;
 try{const u=new URL(String(record.url||''));if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))return false}
 catch{return false}
 return true;
}
async function fetchLegacy(slug){
 for(const access of ['private','public']){
  try{
   const file=await get(ROOT+slug+'.json',{access,token});
   if(file?.statusCode===200&&file.stream){
    const item=JSON.parse(await new Response(file.stream).text());
    if(item.slug===slug&&valid(item))return item;
   }
  }catch{/* Existing private/public store configurations differ. */}
 }
 return null;
}
function supabaseHeaders(){
 const headers={apikey:key,'Content-Type':'application/json','x-apdf-legacy-import':'true',Prefer:'resolution=ignore-duplicates,return=representation'};
 if(key.split('.').length===3)headers.Authorization='Bearer '+key;
 return headers;
}
async function exists(slug){
 const response=await fetch(SUPABASE_URL+'/rest/v1/short_links?select=slug,url&slug=eq.'+encodeURIComponent(slug),{
  method:'GET',headers:supabaseHeaders(),signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error('Supabase read failed (HTTP '+response.status+')');
 const rows=await response.json();
 return rows[0]||null;
}
async function insert(record){
 const createdAt=Number.isFinite(Date.parse(String(record.createdAt||'')))?new Date(record.createdAt).toISOString():new Date().toISOString();
 const row={
  slug:record.slug,
  document_id:typeof record.documentId==='string'?record.documentId:null,
  title:String(record.title||'School PDF').slice(0,180),
  url:new URL(record.url).toString(),
  owner_hash:/^[a-f0-9]{64}$/.test(String(record.ownerHash||''))?record.ownerHash:null,
  created_at:createdAt
 };
 const prior=await exists(row.slug);
 if(prior){
  if(prior.url!==row.url)throw Error('CONFLICT: '+row.slug+' already belongs to another PDF; leaving it untouched');
  return 'existing';
 }
 const res=await fetch(SUPABASE_URL+'/rest/v1/short_links?on_conflict=slug',{
  method:'POST',headers:supabaseHeaders(),
  body:JSON.stringify(row),signal:AbortSignal.timeout(20000)
 });
 if(!res.ok)throw Error('Supabase insert HTTP '+res.status+' for '+row.slug);
 return 'imported';
}
let cursor,seen=0,found=0,imported=0,already=0,errors=0;
do{
 const page=await list({prefix:ROOT,limit:1000,...(cursor?{cursor}:{}),token});
 for(const blob of page.blobs||[]){
  if(!blob.pathname.startsWith(ROOT)||!blob.pathname.endsWith('.json'))continue;
  seen++;
  const slug=blob.pathname.slice(ROOT.length,-5);
  const record=await fetchLegacy(slug);
  if(!record){errors++;console.warn('Unreadable legacy alias:',slug);continue}
  found++;
  if(!apply)continue;
  try{
   const status=await insert(record);
   if(status==='imported')imported++;else already++;
  }catch(e){errors++;console.warn('Import skipped:',slug,String(e.message).slice(0,100))}
 }
 cursor=page.hasMore?page.cursor:null;
}while(cursor);
console.log(JSON.stringify({mode:apply?'apply':'dry-run',listed:seen,validLegacyRecords:found,
 imported,alreadyInSupabase:already,errors},null,2));
if(errors)process.exitCode=1;
