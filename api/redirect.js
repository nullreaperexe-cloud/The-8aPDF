import {get} from '@vercel/blob';
const EDGE='https://xudhjwojgxblbsebkzso.supabase.co/functions/v1/apdf_short_links';
const ROOT='short-links/v1/';
const VALID=/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
function safeURL(value){
 try{
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password)return null;
  return url.toString();
 }catch{return null}
}
async function fromSupabase(slug){
 let response;
 try{
  response=await fetch(EDGE,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'resolve',slug}),
   cache:'no-store',signal:AbortSignal.timeout(12000)
  });
 }catch{return {status:503,url:null}}
 if(response.status!==200)return {status:response.status,url:null};
 try{
  const data=await response.json();
  return {status:200,url:data.slug===slug?safeURL(data.url):null};
 }catch{return {status:503,url:null}}
}
async function fromOldBlob(slug){
 if(!process.env.BLOB_READ_WRITE_TOKEN)return null;
 for(const access of ['private','public']){
  try{
   const item=await get(ROOT+slug+'.json',{access});
   if(item?.statusCode!==200||!item.stream)continue;
   const record=JSON.parse(await new Response(item.stream).text());
   if(record.slug===slug){
    const url=safeURL(record.url);
    if(url)return url;
   }
  }catch{/* Keep old slugs recoverable if the original Blob connection returns. */}
 }
 return null;
}
export default async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){
  res.setHeader('Allow','GET, HEAD');return res.status(405).end();
 }
 const slug=typeof req.query.slug==='string'?req.query.slug.trim().toLowerCase():'';
 if(!VALID.test(slug)||slug.includes('--'))return res.status(404).send('8aPDF short link not found.');
 const current=await fromSupabase(slug);
 const url=current.url||await fromOldBlob(slug);
 if(!url){
  if(current.status!==404)return res.status(503).send('Short link is temporarily unavailable. Try again later.');
  return res.status(404).send('8aPDF short link not found.');
 }
 res.setHeader('Location',url);
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(302).end();
}
