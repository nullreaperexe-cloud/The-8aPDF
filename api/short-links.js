import {createHash} from 'node:crypto';
import {get,list,del} from '@vercel/blob';

const EDGE='https://xudhjwojgxblbsebkzso.supabase.co/functions/v1/apdf_short_links';
const OLD_ROOT='short-links/v1/';
const VALID=/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const clean=x=>typeof x==='string'?x.trim().toLowerCase():'';
const blobConfigured=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN);
function respond(res,status,obj){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(status).json(obj);
}
function ownerHash(value){
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))return null;
 return createHash('sha256').update(value).digest('hex');
}
function validateSlug(value){
 const slug=clean(value);
 return VALID.test(slug)&&!slug.includes('--')?slug:null;
}
async function supabase(action,payload={}){
 let response;
 try{
  response=await fetch(EDGE,{
   method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({action,...payload}),cache:'no-store',signal:AbortSignal.timeout(15000)
  });
 }catch{
  return {status:503,body:{code:'STORAGE_UNAVAILABLE',error:'Supabase short-link service is temporarily unreachable.'}};
 }
 let body;
 try{body=await response.json()}catch{body={error:'Invalid short-link service response.'}}
 return {status:response.status,body};
}
async function oldRecord(slug){
 if(!blobConfigured())return null;
 const pathname=OLD_ROOT+slug+'.json';
 for(const access of ['private','public']){
  try{
   const item=await get(pathname,{access});
   if(item?.statusCode!==200||!item.stream)continue;
   const content=JSON.parse(await new Response(item.stream).text());
   if(content&&content.slug===slug&&typeof content.url==='string')return content;
  }catch{/* legacy store may be disconnected or have a different access setting */}
 }
 return null;
}
async function oldLinks(ownerKey){
 const digest=ownerHash(ownerKey);
 if(!digest||!blobConfigured())return [];
 const result=[];
 let cursor;
 for(let page=0;page<20;page++){
  let batch;
  try{batch=await list({prefix:OLD_ROOT,limit:1000,...(cursor?{cursor}:{})})}
  catch{return result}
  for(let i=0;i<(batch.blobs||[]).length;i+=15){
   const blobs=batch.blobs.slice(i,i+15);
   const records=await Promise.all(blobs.map(x=>
    oldRecord(x.pathname.slice(OLD_ROOT.length).replace(/\.json$/,'')).catch(()=>null)));
   for(const r of records)if(r?.ownerHash===digest&&r.slug){
    result.push({slug:r.slug,documentId:r.documentId,title:r.title||'School PDF',
     createdAt:r.createdAt,shortUrl:'https://8apdf.vercel.app/'+r.slug,
     originalPdfUrl:r.url});
   }
  }
  if(!batch.hasMore||!batch.cursor)break;
  cursor=batch.cursor;
 }
 return result;
}
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method)){
  res.setHeader('Allow','GET, POST');
  return respond(res,405,{error:'Method not allowed'});
 }
 const body=req.method==='POST'&&req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
 const action=req.method==='GET'?'check':String(body.action||'create');
 const slug=validateSlug(req.method==='GET'?req.query.slug:body.slug);
 if(req.method==='POST'){
  const origin=req.headers.origin;
  if(origin){
   try{if(new URL(origin).host!==req.headers.host)return respond(res,403,{error:'Use the 8aPDF website to manage links.'})}
   catch{return respond(res,403,{error:'Invalid request origin'})}
  }
 }
 if(action==='check'){
  if(!slug)return respond(res,400,{error:'Invalid short-link name (3–32 letters, numbers or hyphens).'});
  const result=await supabase('check',{slug});
  if(result.status!==200)return respond(res,result.status,result.body);
  // Preserve old slugs when the historical Blob store is still connected.
  const legacy=result.body.available?await oldRecord(slug):null;
  if(legacy)return respond(res,200,{slug,available:false,message:'This name is already used'});
  return respond(res,result.status,result.body);
 }
 if(action==='list'){
  if(!ownerHash(body.ownerKey))return respond(res,400,{error:'Browser ownership key missing.'});
  const result=await supabase('list',{ownerKey:body.ownerKey});
  if(result.status!==200)return respond(res,result.status,result.body);
  const existing=Array.isArray(result.body.links)?result.body.links:[];
  const previously=await oldLinks(body.ownerKey);
  const unique=new Map(existing.map(x=>[x.slug,x]));
  for(const old of previously){
   if(unique.has(old.slug))continue;
   // When the legacy Blob store is available, automatically recover its
   // old slug into Supabase if its document still exists in the live library.
   if(old.documentId&&old.originalPdfUrl){
    const restored=await supabase('create',{slug:old.slug,
     documentId:old.documentId,pdfUrl:old.originalPdfUrl,ownerKey:body.ownerKey});
    if(restored.status===201||restored.status===409){
     if(restored.status===201){unique.set(old.slug,{
      slug:old.slug,documentId:old.documentId,title:old.title,
      createdAt:old.createdAt,shortUrl:old.shortUrl
     });continue}
    }
   }
   // Even PDFs not yet reimported remain shareable through the Blob fallback.
   unique.set(old.slug,{slug:old.slug,documentId:old.documentId,title:old.title,
    createdAt:old.createdAt,shortUrl:old.shortUrl});
  }
  return respond(res,200,{links:[...unique.values()].sort((a,b)=>
   String(b.createdAt||'').localeCompare(String(a.createdAt||'')))});
 }
 if(!slug)return respond(res,400,{error:'Invalid or missing short-link name.'});
 if(action==='delete'){
  const result=await supabase('delete',{slug,ownerKey:body.ownerKey});
  if(result.status===200)return respond(res,200,result.body);
  const old=await oldRecord(slug),digest=ownerHash(body.ownerKey);
  if(old&&digest&&old.ownerHash===digest){
   try{await del(OLD_ROOT+slug+'.json');return respond(res,200,{deleted:true,slug})}
   catch{return respond(res,503,{error:'Could not delete old Blob link; retry when legacy storage is connected.'})}
  }
  return respond(res,result.status,result.body);
 }
 if(action!=='create')return respond(res,400,{error:'Unknown short-link action.'});
 // If a historical Blob slug still exists, never overwrite it in Supabase.
 if(await oldRecord(slug))return respond(res,409,{error:'This short name already belongs to an older link.'});
 const result=await supabase('create',{
  slug,documentId:body.documentId,pdfUrl:body.pdfUrl,ownerKey:body.ownerKey
 });
 return respond(res,result.status,result.body);
}
