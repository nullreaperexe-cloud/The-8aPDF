/**
 * 8aPDF Supabase school-announcements API.
 * Public GET respects RLS; admin writes require ADMIN_API_TOKEN plus
 * a server-side SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.
 */
import {randomUUID} from 'node:crypto';
import {listSupabaseAnnouncements,normalizeSupabaseAnnouncement,SUPABASE_ANNOUNCEMENTS_URL} from '../supabase-announcements.js';

function safeId(id){return /^[A-Za-z0-9_-]{1,200}$/.test(String(id??''))}
function pageNumber(v,def,max){
 const n=Number(v??def);
 return Number.isInteger(n)&&n>=0&&n<=max?n:null;
}
function secret(){return process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||''}
async function change(method,id,body){
 const key=secret();
 const url=new URL(SUPABASE_ANNOUNCEMENTS_URL);
 url.searchParams.set('select','*');
 if(method!=='POST')url.searchParams.set('id','eq.'+id);
 const headers={apikey:key,Accept:'application/json',Prefer:'return=representation'};
 if(key.split('.').length===3)headers.Authorization='Bearer '+key;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(url.toString(),{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'
 });
 let value;
 try{value=await response.json()}catch{value=[]}
 if(!response.ok)throw new Error('Supabase announcement write failed (HTTP '+response.status+')');
 if(!Array.isArray(value))throw new Error('Supabase announcement response is invalid');
 return value;
}
function mapped(body,{partial=false}={}){
 const keys=['title','description','subject','category','published','original_message','attachment_url','has_attachment','priority','ai_model','ai_status','source_message_id','created_at','message_date'];
 const next={};
 for(const k of keys)if(Object.prototype.hasOwnProperty.call(body,k))next[k]=body[k];
 const fromCamel={
  originalMessage:'original_message',attachmentUrl:'attachment_url',hasAttachment:'has_attachment',
  sourceMessageId:'source_message_id',createdAt:'created_at',messageDate:'message_date',
  aiStatus:'ai_status',aiModel:'ai_model'
 };
 for(const [camel,snake] of Object.entries(fromCamel)){
  if(Object.prototype.hasOwnProperty.call(body,camel)&&!(snake in next))next[snake]=body[camel];
 }
 for(const k of ['created_at','message_date']){
  const v=next[k];
  if(v&&typeof v==='object'&&typeof v.seconds==='number'){
   next[k]=new Date(v.seconds*1000+Math.floor((v.nanoseconds||0)/1e6)).toISOString();
  }
 }
 if(Object.prototype.hasOwnProperty.call(body,'raw'))next.raw=body.raw;
 else if(!partial)next.raw={...body};
 if(!partial&&(!next.title||typeof next.title!=='string'))throw Object.assign(new Error('Announcement title required'),{status:400});
 return next;
}
export async function supabaseAnnouncementsHandler(req,res,id,{auth,reply,clean,parseBody,validation}){
 const method=req.method||'GET';
 if(!['GET','POST','PATCH','DELETE'].includes(method)){
  res.setHeader('Allow','GET, POST, PATCH, DELETE');
  return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Unsupported HTTP method'}});
 }
 if(id&&!safeId(id))return validation(res,new Error('Invalid record ID'));
 const allowed=auth(req);
 if(method!=='GET'&&!allowed)return reply(res,process.env.ADMIN_API_TOKEN?401:503,{
  success:false,error:{code:process.env.ADMIN_API_TOKEN?'UNAUTHORIZED':'CONFIGURATION_ERROR',message:'Admin bearer token is required'}
 });
 try{
  if(method==='GET'){
   if(id){
    const rows=await listSupabaseAnnouncements({limit:1,id});
    const row=rows[0];
    return row?reply(res,200,{success:true,data:clean(normalizeSupabaseAnnouncement(row))}):reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Announcement not found'}});
   }
   const size=pageNumber(req.query?.limit,100,200);
   if(!size)return validation(res,new Error('limit must be between 1 and 200'));
   const offset=pageNumber(req.query?.cursor,0,1000000);
   if(offset===null)return validation(res,new Error('Invalid cursor'));
   const rows=await listSupabaseAnnouncements({limit:size+1,offset});
   const more=rows.length>size;
   const page=rows.slice(0,size).filter(x=>x.published===true).map(x=>clean(normalizeSupabaseAnnouncement(x)));
   return reply(res,200,{success:true,data:page,count:page.length,nextCursor:more?String(offset+size):null,hasMore:more,source:'announcements'});
  }
  if(!secret())return reply(res,503,{success:false,error:{code:'CONFIGURATION_ERROR',message:'Set a server-side SUPABASE_SECRET_KEY in Vercel for admin writes'}});
  if(req.headers['content-type']&&!String(req.headers['content-type']).toLowerCase().startsWith('application/json'))
   return reply(res,415,{success:false,error:{code:'UNSUPPORTED_MEDIA_TYPE',message:'Content-Type: application/json required'}});
  if(method==='POST'){
   if(id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Use collection URL for POST'}});
   let body;try{body=mapped(parseBody(req))}catch(e){return validation(res,e)}
   body.id=randomUUID();
   body.created_at=body.created_at||new Date().toISOString();
   const rows=await change('POST',null,body);
   return reply(res,201,{success:true,data:clean(normalizeSupabaseAnnouncement(rows[0]))});
  }
  if(!id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Record ID required'}});
  if(method==='PATCH'){
   let rawInput,body;
   try{rawInput=parseBody(req);body=mapped(rawInput,{partial:true})}catch(e){return validation(res,e)}
   const prev=await listSupabaseAnnouncements({limit:1,id});
   if(!prev.length)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Announcement not found'}});
   body.raw={
    ...(prev[0].raw&&typeof prev[0].raw==='object'?prev[0].raw:{}),
    ...rawInput
   };
   const rows=await change('PATCH',id,body);
   return reply(res,200,{success:true,data:clean(normalizeSupabaseAnnouncement(rows[0]))});
  }
  const removed=await change('DELETE',id);
  if(!removed.length)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Announcement not found'}});
  return reply(res,200,{success:true,deleted:true,id});
 }catch(e){
  console.error('8aPDF Supabase announcement API failure:',e?.message||'unknown');
  return reply(res,502,{success:false,error:{code:'SUPABASE_UNAVAILABLE',message:'Unable to complete announcements request'}});
 }
}
