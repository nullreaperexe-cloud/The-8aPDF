/* Shared JSON API helpers. Both collections now use the dedicated 8aPDF Supabase project. */
import {timingSafeEqual} from 'node:crypto';
import {supabaseMaterialsHandler} from './_supabase_materials.js';
import {supabaseAnnouncementsHandler} from './_supabase_announcements.js';

export const collections={materials:'study_materials',announcements:'announcements'};
export function reply(res,status,obj){
 res.statusCode=status;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify(obj,null,2)+'\n');
}
export function auth(req){
 const expected=process.env.ADMIN_API_TOKEN||'';
 const supplied=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'')||String(req.headers?.['x-admin-token']||'');
 if(!expected||!supplied)return false;
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
const banned=/^(?:password|secret|private.?key|access.?token|auth(?:orization)?|credential|api.?key)$/i;
export function clean(value){
 if(value===null||value===undefined)return value;
 if(typeof value?.toDate==='function')return value.toDate().toISOString();
 if(value instanceof Date)return value.toISOString();
 if(Array.isArray(value))return value.map(clean);
 if(typeof value==='object'){
  const out={};for(const [k,v] of Object.entries(value))if(!banned.test(k))out[k]=clean(v);
  return out;
 }
 return value;
}
export function parseBody(req){
 let value=req.body;
 if(typeof value==='string'){
  if(value.length>100000)throw Object.assign(new Error('Request too large'),{status:413});
  try{value=JSON.parse(value)}catch{throw Object.assign(new Error('Invalid JSON body'),{status:400})}
 }
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('JSON object required'),{status:400});
 if(JSON.stringify(value).length>100000)throw Object.assign(new Error('Request too large'),{status:413});
 if(Object.keys(value).some(k=>['id','__proto__','constructor','prototype'].includes(k)))throw Object.assign(new Error('Invalid record fields'),{status:400});
 return value;
}
export function validation(res,e){
 return reply(res,e.status||400,{success:false,error:{code:e.status===413?'PAYLOAD_TOO_LARGE':'VALIDATION_ERROR',message:e.message}});
}
export async function handler(req,res,kind,id){
 const deps={auth,reply,clean,parseBody,validation};
 if(kind==='materials')return supabaseMaterialsHandler(req,res,id,deps);
 if(kind==='announcements')return supabaseAnnouncementsHandler(req,res,id,deps);
 return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Unknown resource'}});
}
