/**
 * Vercel JSON API adapter for the Supabase study_materials table.
 * Public GET uses a publishable key and respects Supabase RLS.
 * Admin changes require both ADMIN_API_TOKEN and a SERVER-SIDE
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */
import {listStudyMaterials,SUPABASE_MATERIALS_URL} from '../supabase-materials.js';

function validId(id){return /^[A-Za-z0-9_-]{1,200}$/.test(String(id||''))}
function validLimit(value){
 const n=Number(value??100);
 return Number.isInteger(n)&&n>=1&&n<=200?n:null;
}
function validCursor(value){
 const cursor=String(value??'');
 if(!/^\d*$/.test(cursor)||cursor.length>9)return null;
 const n=Number(cursor||0);
 return Number.isSafeInteger(n)&&n>=0&&n<=1000000?n:null;
}
function adminKey(){return process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||''}
function supabaseError(e,res,reply){
 console.error('8aPDF Supabase materials API:',e?.message||e);
 return reply(res,502,{success:false,error:{code:'SUPABASE_UNAVAILABLE',message:'Unable to reach Supabase study_materials. Check the table, RLS policy, and API credentials.'}});
}
async function mutation(method,id,body){
 const key=adminKey();
 const url=new URL(SUPABASE_MATERIALS_URL);
 url.searchParams.set('select','*');
 if(method!=='POST')url.searchParams.set('id','eq.'+id);
 const headers={apikey:key,Accept:'application/json',Prefer:'return=representation'};
 // Old-style JWT service_role keys require bearer authorization. Modern
 // sb_secret_ keys use the apikey header on their own.
 if(key.split('.').length===3)headers.Authorization='Bearer '+key;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(url.toString(),{
  method,
  headers,
  body:body===undefined?undefined:JSON.stringify(body),
  cache:'no-store',
  signal:AbortSignal.timeout(20000)
 });
 let data=null;
 try{data=await response.json()}catch{}
 if(!response.ok)throw new Error('Supabase write HTTP '+response.status+': '+String(data?.message||data?.hint||'unknown error').slice(0,180));
 if(!Array.isArray(data))throw new Error('Supabase did not return a record list');
 return data;
}
export async function supabaseMaterialsHandler(req,res,id,{auth,reply,clean,parseBody,validation}){
 const method=req.method||'GET';
 if(!['GET','POST','PATCH','DELETE'].includes(method)){
  res.setHeader('Allow','GET, POST, PATCH, DELETE');
  return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Unsupported HTTP method'}});
 }
 const allowed=auth(req);
 if(method!=='GET'&&!allowed)return reply(res,process.env.ADMIN_API_TOKEN?401:503,{
  success:false,error:{code:process.env.ADMIN_API_TOKEN?'UNAUTHORIZED':'CONFIGURATION_ERROR',message:process.env.ADMIN_API_TOKEN?'Admin bearer token required':'ADMIN_API_TOKEN not configured'}
 });
 if(id&&!validId(id))return validation(res,Object.assign(new Error('Invalid record ID'),{status:400}));
 try{
  if(method==='GET'){
   if(id){
    const rows=await listStudyMaterials({id,limit:1});
    const row=rows.find(r=>allowed||r.published!==false);
    return row?reply(res,200,{success:true,data:clean(row)}):reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});
   }
   const size=validLimit(req.query?.limit);
   if(!size)return validation(res,new Error('limit must be an integer between 1 and 200'));
   const offset=validCursor(req.query?.cursor);
   if(offset===null)return validation(res,new Error('Invalid cursor'));
   const rows=await listStudyMaterials({offset,limit:size+1});
   const more=rows.length>size;
   const page=rows.slice(0,size).filter(r=>allowed||r.published!==false).map(clean);
   return reply(res,200,{success:true,data:page,count:page.length,nextCursor:more?String(offset+size):null,hasMore:more,source:'study_materials'});
  }
  if(!adminKey())return reply(res,503,{success:false,error:{code:'CONFIGURATION_ERROR',message:'Set SUPABASE_SECRET_KEY in Vercel for admin writes. Public publishable keys are read-only.'}});
  if(req.headers['content-type']&&!String(req.headers['content-type']).toLowerCase().startsWith('application/json'))
   return reply(res,415,{success:false,error:{code:'UNSUPPORTED_MEDIA_TYPE',message:'Use Content-Type: application/json'}});
  if(method==='POST'&&id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'POST at collection route only'}});
  if(method==='POST'||method==='PATCH'){
   if(method==='PATCH'&&!id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'PATCH requires an ID route'}});
   let body;try{body=parseBody(req)}catch(e){return validation(res,e)}
   const rows=await mutation(method,id,body);
   if(method==='PATCH'&&!rows.length)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});
   return reply(res,method==='POST'?201:200,{success:true,data:clean(rows[0])});
  }
  if(!id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'DELETE requires an ID route'}});
  const deleted=await mutation('DELETE',id);
  if(!deleted.length)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});
  return reply(res,200,{success:true,deleted:true,id});
 }catch(e){return supabaseError(e,res,reply)}
}
