import {initializeApp,cert,getApps,applicationDefault} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {timingSafeEqual} from 'node:crypto';
import {supabaseMaterialsHandler} from './_supabase_materials.js';
import {supabaseAnnouncementsHandler} from './_supabase_announcements.js';
export const collections={materials:'study_materials',announcements:'announcements'};
export function reply(res,status,obj){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(obj,null,2)+'\n');}
export function auth(req){const expected=process.env.ADMIN_API_TOKEN||'';const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||String(req.headers['x-admin-token']||'');if(!expected||!supplied)return false;const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b)}
export function db(){if(!getApps().length){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;let credential;if(raw){const account=JSON.parse(raw);credential=cert(account)}else if(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY){credential=cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})}else if(process.env.GOOGLE_APPLICATION_CREDENTIALS){credential=applicationDefault()}else throw Object.assign(new Error('Firebase Admin credentials are not configured'),{status:503});initializeApp({credential})}return getFirestore()}
const banned=/^(?:password|secret|private.?key|access.?token|auth(?:orization)?|credential|api.?key)$/i;
export function clean(value){if(value===null||value===undefined)return value;if(typeof value?.toDate==='function')return value.toDate().toISOString();if(value instanceof Date)return value.toISOString();if(typeof value?.path==='string'&&typeof value?.id==='string')return value.path;if(Array.isArray(value))return value.map(clean);if(typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){if(!banned.test(k))out[k]=clean(v)}return out}return value}
export function shape(doc){return {...clean(doc.data()),id:doc.id}}
export function fail(res,error){console.error('8aPDF database API',error?.code||error?.message||error);const status=Number(error?.status)||(/permission-denied/.test(error?.code||'')?403:500);return reply(res,status,{success:false,error:{code:status===503?'CONFIGURATION_ERROR':status===403?'FORBIDDEN':'SERVER_ERROR',message:status===503?'Database service is not configured':status===403?'Database access denied':'Unable to complete database request'}})}
export function limitValue(v){const n=Number(v||100);return Number.isInteger(n)&&n>=1&&n<=200?n:null}
export function parseBody(req){let value=req.body;if(typeof value==='string'){if(value.length>100000)throw Object.assign(new Error('Request too large'),{status:413});try{value=JSON.parse(value)}catch{throw Object.assign(new Error('Invalid JSON body'),{status:400})}}if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('JSON object required'),{status:400});const str=JSON.stringify(value);if(str.length>100000)throw Object.assign(new Error('Request too large'),{status:413});if(Object.keys(value).some(k=>k==='id'||k==='__proto__'||k==='constructor'||k==='prototype'))throw Object.assign(new Error('Invalid record fields'),{status:400});return value}
export function validation(res,e){return reply(res,e.status||400,{success:false,error:{code:e.status===413?'PAYLOAD_TOO_LARGE':'VALIDATION_ERROR',message:e.message}})}
export async function handler(req,res,kind,id){if(kind==='materials')return supabaseMaterialsHandler(req,res,id,{auth,reply,clean,parseBody,validation});if(kind==='announcements')return supabaseAnnouncementsHandler(req,res,id,{auth,reply,clean,parseBody,validation});const collection=collections[kind];if(!collection)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Unknown resource'}});const method=req.method||'GET';if(!['GET','POST','PATCH','DELETE'].includes(method)){res.setHeader('Allow','GET, POST, PATCH, DELETE');return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Unsupported HTTP method'}})}
const allowed=auth(req);if(method!=='GET'&&!allowed)return reply(res,process.env.ADMIN_API_TOKEN?401:503,{success:false,error:{code:process.env.ADMIN_API_TOKEN?'UNAUTHORIZED':'CONFIGURATION_ERROR',message:process.env.ADMIN_API_TOKEN?'Admin bearer token required':'ADMIN_API_TOKEN not configured'}});
try{const ref=db().collection(collection);
if(method==='GET'&&id){const doc=await ref.doc(id).get();if(!doc.exists||(!allowed&&(kind==='announcements'?doc.data()?.published!==true:doc.data()?.published===false)))return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});return reply(res,200,{success:true,data:shape(doc)})}
if(method==='GET'){
const size=limitValue(req.query?.limit);
if(!size)return validation(res,new Error('limit must be an integer between 1 and 200'));
const cursor=String(req.query?.cursor||'');
if(cursor.length>250||cursor&&!/^[A-Za-z0-9_-]+$/.test(cursor))return validation(res,new Error('Invalid cursor'));
let query=ref.orderBy(FieldPath.documentId());
if(cursor)query=query.startAfter(cursor);
const data=[];let last=null;let exhausted=false;
while(data.length<size+1&&!exhausted){
 const batchSize=Math.min(200,Math.max(25,(size+1-data.length)*2));
 const snap=await query.limit(batchSize).get();
 if(snap.empty){exhausted=true;break}
 for(const doc of snap.docs){
  if(allowed||(kind==='announcements'?doc.data()?.published===true:doc.data()?.published!==false))data.push(shape(doc));
  if(data.length>=size+1)break;
 }
 last=snap.docs[snap.docs.length-1].id;
 if(snap.size<batchSize)exhausted=true;
 query=ref.orderBy(FieldPath.documentId()).startAfter(last);
}
const more=data.length>size;
const page=data.slice(0,size);
const nextCursor=more?page[page.length-1].id:null;
return reply(res,200,{success:true,data:page,count:page.length,nextCursor,hasMore:more,source:collection});
}
if(method!=='GET'&&req.headers['content-type']&&!String(req.headers['content-type']).toLowerCase().startsWith('application/json'))return reply(res,415,{success:false,error:{code:'UNSUPPORTED_MEDIA_TYPE',message:'Use Content-Type: application/json'}});
if(method==='POST'&&id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'POST at collection route only'}});
if(method==='POST'){let body;try{body=parseBody(req)}catch(e){return validation(res,e)}const doc=await ref.add({...body,createdAt:new Date(),updatedAt:new Date()});return reply(res,201,{success:true,data:shape(await doc.get())})}
if(!id)return reply(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Use an ID route for updates or deletion'}});if(!/^[A-Za-z0-9_-]{1,200}$/.test(id))return validation(res,new Error('Invalid record ID'));const doc=ref.doc(id);
if(method==='PATCH'){let body;try{body=parseBody(req)}catch(e){return validation(res,e)}if(!(await doc.get()).exists)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});await doc.update({...body,updatedAt:new Date()});return reply(res,200,{success:true,data:shape(await doc.get())})}
if(method==='DELETE'){if(!(await doc.get()).exists)return reply(res,404,{success:false,error:{code:'NOT_FOUND',message:'Record not found'}});await doc.delete();return reply(res,200,{success:true,deleted:true,id})}
}catch(e){if(e.status&&e.status<500)return validation(res,e);return fail(res,e)}}