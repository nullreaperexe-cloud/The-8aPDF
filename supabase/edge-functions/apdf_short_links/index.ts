import {createClient} from 'npm:@supabase/supabase-js@2.57.0';

// The service-role credential is provided by Supabase Edge Functions internally;
// it is NEVER exposed to Vercel, the browser or a public SQL policy.
const db=createClient(
 Deno.env.get('SUPABASE_URL')||'',
 Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
 {auth:{persistSession:false,autoRefreshToken:false}}
);
const reserved=new Set(['api','app','admin','about','help','privacy','terms','settings','home','index','login','logout','register','signup','dashboard','library','chatbot','timetable','updates','tasks','pdfs','classic','announcement','announcements','pdf','share','s','short','download','manifest','favicon','robots','sitemap','assets','static','public','support','contact','status','vercel','www','database','live-database','chat','school-calendar','school-reminders','my-short-links']);
const slugRegex=/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const response=(code:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{
 status:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
function slugOf(v:unknown):string{
 const slug=typeof v==='string'?v.trim().toLowerCase():'';
 if(!slugRegex.test(slug)||slug.includes('--')||reserved.has(slug))
  throw Object.assign(new Error('Invalid or reserved short name (3–32 characters).'),{status:400});
 return slug;
}
function httpsPDF(url:unknown):string|null{
 try{
  const u=new URL(String(url||''));
  if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password)return null;
  return u.toString();
 }catch{return null}
}
async function owner(v:unknown):Promise<string>{
 const key=String(v||'');
 if(!/^[a-f0-9]{64}$/.test(key))
  throw Object.assign(new Error('Invalid browser ownership key.'),{status:400});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function get(slug:string){
 const {data,error}=await db.from('short_links')
  .select('slug,document_id,url,title,created_at').eq('slug',slug).maybeSingle();
 if(error)throw Error('Short-link lookup failed: '+error.code);
 return data;
}
async function perform(arg:Record<string,unknown>){
 const action=String(arg.action||'check');
 if(action==='check'){
  const slug=slugOf(arg.slug);
  const taken=!!(await get(slug));
  return {status:200,data:{slug,available:!taken,
   message:taken?'This name is already used':'This name is available'}};
 }
 if(action==='resolve'){
  const slug=slugOf(arg.slug),record=await get(slug);
  if(!record)return {status:404,data:{code:'NOT_FOUND',error:'Short link not found'}};
  const url=httpsPDF(record.url);
  if(!url)return {status:404,data:{code:'INVALID_TARGET',error:'Invalid PDF target'}};
  return {status:200,data:{slug,url,title:record.title,documentId:record.document_id}};
 }
 if(action==='list'){
  const digest=await owner(arg.ownerKey);
  const {data,error}=await db.from('short_links')
   .select('slug,document_id,title,created_at').eq('owner_hash',digest)
   .order('created_at',{ascending:false}).limit(250);
  if(error)throw Error('Short-link list unavailable: '+error.code);
  return {status:200,data:{links:(data||[]).map(r=>({
   slug:r.slug,documentId:r.document_id,title:r.title,
   shortUrl:'https://8apdf.vercel.app/'+r.slug,createdAt:r.created_at
  }))}};
 }
 if(action==='create'){
  const slug=slugOf(arg.slug),digest=await owner(arg.ownerKey);
  const id=String(arg.documentId||''),requestUrl=httpsPDF(arg.pdfUrl);
  if(!/^[\w-]{1,200}$/.test(id)||!requestUrl)
   throw Object.assign(new Error('A valid existing school PDF is required.'),{status:422});
  const {data:school,error:schoolError}=await db.from('study_materials')
   .select('id,title,pdf_url,published').eq('id',id).maybeSingle();
  if(schoolError)throw Error('PDF validation unavailable: '+schoolError.code);
  if(!school||school.published===false||httpsPDF(school.pdf_url)!==requestUrl)
   throw Object.assign(new Error('This PDF is not available in the live school library.'),{status:422});
  const {count,error:quotaError}=await db.from('short_links')
   .select('slug',{head:true,count:'exact'}).eq('owner_hash',digest);
  if(quotaError)throw Error('Short-link quota unavailable: '+quotaError.code);
  if((count||0)>=100)
   throw Object.assign(new Error('Maximum of 100 links per browser.'),{status:429});
  const {data,error}=await db.from('short_links')
   .insert({slug,document_id:id,url:school.pdf_url,
    title:String(school.title||'School PDF').slice(0,180),owner_hash:digest})
   .select('slug').single();
  if(error){
   if(error.code==='23505')
    throw Object.assign(new Error('This short name is already used.'),{status:409});
   throw Error('Cannot create short link: '+error.code);
  }
  return {status:201,data:{slug:data.slug,shortUrl:'https://8apdf.vercel.app/'+slug,message:'Short link created'}};
 }
 if(action==='delete'){
  const slug=slugOf(arg.slug),digest=await owner(arg.ownerKey);
  const {data,error}=await db.from('short_links').delete()
   .eq('slug',slug).eq('owner_hash',digest).select('slug').maybeSingle();
  if(error)throw Error('Cannot delete short link: '+error.code);
  if(!data)throw Object.assign(new Error('Short link missing or not owned by this browser.'),{status:403});
  return {status:200,data:{deleted:true,slug}};
 }
 return {status:400,data:{code:'UNKNOWN_ACTION',error:'Unknown action.'}};
}
Deno.serve(async req=>{
 if(req.method!=='POST')return response(405,{error:'POST required'});
 try{
  const raw=await req.text();
  if(raw.length>16000)return response(413,{error:'Request too large'});
  const input=JSON.parse(raw);
  if(!input||typeof input!=='object'||Array.isArray(input))
   return response(400,{error:'Expected JSON object'});
  const result=await perform(input);
  return response(result.status,result.data);
 }catch(e){
  const ex=e as {status?:number,message?:string};
  const status=typeof ex?.status==='number'&&ex.status>=400&&ex.status<500?ex.status:500;
  if(status===500)console.error('8aPDF short links:',String(ex?.message||'unknown').slice(0,130));
  return response(status,{code:status===500?'STORAGE_UNAVAILABLE':status===409?'ALREADY_EXISTS':'VALIDATION_ERROR',
   error:status===500?'Short-link database temporarily unavailable.':String(ex?.message||'Invalid request').slice(0,190)});
 }
});
