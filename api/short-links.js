import { get, put, del, list } from '@vercel/blob';
import { createHash } from 'node:crypto';

const ROOT = 'short-links/v1/';
const PROJECT = 'academyvault-5d1eb';
const PUBLIC_FIREBASE_KEY = 'AIzaSyATxKki6gkNWic_CnoGbZnOZjAUj1lbKGI';
const RESERVED = new Set(['api','app','admin','about','help','privacy','terms','settings','home','index','login','logout','register','signup','dashboard','library','chatbot','timetable','updates','tasks','pdfs','classic','announcement','announcements','pdf','pdfs','share','s','short','download','manifest','favicon','robots','sitemap','assets','static','public','support','contact','status','vercel','www']);
const pattern = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

function normalize(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function validSlug(value) { return pattern.test(value) && !RESERVED.has(value) && !value.includes('--'); }
function json(res, code, payload) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(code).json(payload);
}
function isConflict(error){return /already exists|BlobAlreadyExists|pathname is already|\b409\b/i.test(String(error?.name)+' '+String(error?.message))}
function storageError(operation,error){const e=new Error('Blob '+operation+' unavailable');e.code='STORAGE_UNAVAILABLE';e.cause=error;return e}
async function existing(slug){
  const pathname=ROOT+slug+'.json';
  try{return await get(pathname,{access:'public'})}
  catch(firstError){
    try{return await get(pathname,{access:'private'})}
    catch(secondError){throw storageError('read',secondError)}
  }
}
function ownerHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return null;
  return createHash('sha256').update(value).digest('hex');
}
async function recordFor(slug) {
  const file = await existing(slug);
  if (!file || file.statusCode !== 200 || !file.stream) return null;
  return JSON.parse(await new Response(file.stream).text());
}
async function myLinks(hash) {
  const output = [];
  let cursor;
  let count=0;
  do {
    const page = await list({ prefix: ROOT, limit: 1000, ...(cursor ? {cursor} : {}) });
    const files = page.blobs.filter(x=>x.pathname.endsWith('.json') && x.pathname.startsWith(ROOT));
    for(let i=0;i<files.length;i+=20){
      const batch=await Promise.all(files.slice(i,i+20).map(x=>recordFor(x.pathname.slice(ROOT.length,-5)).catch(()=>null)));
      for(const record of batch){
        if (record && record.ownerHash === hash) output.push({
          slug: record.slug, documentId:record.documentId, title:record.title || 'School PDF',
          shortUrl:'https://8apdf.vercel.app/'+record.slug, createdAt:record.createdAt
        });
      }
    }
    cursor=page.cursor;
    count++;
    if(!page.hasMore)break;
  } while(cursor && count<10);
  return output.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Verify each PDF against Firestore through the server-only Firebase Admin SDK.
// Firebase Anonymous Authentication is intentionally not used.
function verificationError(code,reason,cause){
  const error=new Error(reason);
  error.code=code;
  if(cause)error.cause=cause;
  return error;
}
function serviceCredential(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw verificationError('FIREBASE_ADMIN_NOT_CONFIGURED','Server credential is missing');
  let data;
  try{
    data=JSON.parse(String(raw).trim().replace(/^\uFEFF/,''));
    if(typeof data==='string')data=JSON.parse(data);
  }catch(cause){throw verificationError('FIREBASE_ADMIN_JSON_INVALID','Credential is not a valid JSON object',cause)}
  if(!data||typeof data!=='object'||data.type!=='service_account'||!data.client_email||!data.private_key)
    throw verificationError('FIREBASE_ADMIN_MISSING_FIELDS','Expected a service-account credential');
  if(data.project_id!==PROJECT)
    throw verificationError('FIREBASE_ADMIN_PROJECT_MISMATCH','Credential belongs to a different Firebase project');
  const privateKey=String(data.private_key).replace(/\\n/g,'\n');
  if(!privateKey.includes('BEGIN PRIVATE KEY')||!privateKey.includes('END PRIVATE KEY'))
    throw verificationError('FIREBASE_ADMIN_KEY_INVALID','PEM private key is incomplete');
  return {...data,private_key:privateKey};
}
function classifyAdminFailure(error){
  if(error?.code?.startsWith?.('FIREBASE_ADMIN_'))return error;
  const reason=String(error?.code||'')+' '+String(error?.message||'');
  if(/permission.denied|missing or insufficient permissions|does not have permission|permission denied/i.test(reason))
    return verificationError('FIREBASE_ADMIN_PERMISSION_DENIED','Service-account access is denied',error);
  if(/invalid.grant|invalid.jwt|unauthenticated|invalid.credential|jwt signature|key has been revoked|invalid.sign/i.test(reason))
    return verificationError('FIREBASE_ADMIN_AUTH_FAILED','Google rejected the server credential',error);
  if(/invalid.pem|private.key|DECODER routines|certificate|key must be/i.test(reason))
    return verificationError('FIREBASE_ADMIN_KEY_INVALID','Service-account private key could not be parsed',error);
  if(/database.*not found|database.*does not exist|NOT_FOUND.*database/i.test(reason))
    return verificationError('FIREBASE_DATABASE_NOT_FOUND','Default Firestore database was not found',error);
  if(/deadline.exceeded|timeout|econnreset|unavailable|network|enotfound/i.test(reason))
    return verificationError('FIREBASE_ADMIN_NETWORK','Firebase Admin could not connect in time',error);
  return verificationError('FIREBASE_ADMIN_UNAVAILABLE','Firebase Admin read failed',error);
}
// Use Google OAuth + Firestore REST instead of Firebase Admin Firestore's gRPC client.
// This relies only on the Vercel service account; Firebase Anonymous Auth is never required.
function checkedPdf(fields,originalUrl){
  const raw=fields?.pdf_url?.stringValue||fields?.pdfUrl?.stringValue||fields?.url?.stringValue;
  if(typeof raw!=='string')return null;
  try{
    const stored=new URL(raw);
    const requested=new URL(originalUrl);
    if(stored.protocol!=='https:'||!stored.hostname.includes('.')||stored.username||stored.password||stored.toString()!==requested.toString())return null;
    return {url:stored.toString(),title:String(fields?.title?.stringValue||'School PDF').slice(0,180)};
  }catch{return null}
}
function firestoreHttpError(status,apiStatus){
  if(status===401||apiStatus==='UNAUTHENTICATED')
    return verificationError('FIREBASE_ADMIN_AUTH_FAILED','Google rejected the service-account access token');
  if(status===403||apiStatus==='PERMISSION_DENIED')
    return verificationError('FIREBASE_ADMIN_PERMISSION_DENIED','Service account is not allowed to access Firestore');
  if(apiStatus==='NOT_FOUND')
    return verificationError('FIREBASE_DATABASE_NOT_FOUND','Firestore project/database could not be found');
  if(status===429||status>=500)
    return verificationError('FIREBASE_ADMIN_NETWORK','Firestore temporarily unavailable');
  return verificationError('FIREBASE_ADMIN_HTTP_ERROR','Firestore REST returned HTTP '+status);
}
async function findPublishedPdf(id,originalUrl){
  if(typeof id!=='string'||!/^[\w-]{1,160}$/.test(id)||typeof originalUrl!=='string')return null;
  try{
    const credential=serviceCredential();
    const {cert}=await import('firebase-admin/app');
    // CertCredential exchanges the server-side service-account private key for an
    // OAuth token; neither the credential nor the token is sent to the browser.
    const tokenData=await cert(credential).getAccessToken();
    if(!tokenData?.access_token)throw verificationError('FIREBASE_ADMIN_AUTH_FAILED','Google did not issue an access token');
    const endpoint='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/study_materials/'+encodeURIComponent(id);
    let response;
    try{
      response=await fetch(endpoint,{
        headers:{Accept:'application/json',Authorization:'Bearer '+tokenData.access_token},
        signal:AbortSignal.timeout(10000)
      });
    }catch(error){throw verificationError('FIREBASE_ADMIN_NETWORK','Firestore HTTPS request failed',error)}
    if(response.status===404)return null;
    if(!response.ok){
      const payload=await response.json().catch(()=>({}));
      throw firestoreHttpError(response.status,payload?.error?.status);
    }
    const payload=await response.json();
    return checkedPdf(payload?.fields,originalUrl);
  }catch(error){
    const classified=classifyAdminFailure(error);
    console.error('8aPDF short-links Firebase REST verification:',classified.code,
      error?.response?.status||error?.status||'');
    throw classified;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow','GET, POST');
    return json(res,405,{error:'Method not allowed'});
  }
  const action=req.method==='POST' ? (req.body?.action || 'create') : 'check';
  if (action === 'list') {
    const hash=ownerHash(req.body?.ownerKey);
    if(!hash)return json(res,400,{error:'Missing link-manager ownership key.'});
    try{return json(res,200,{links:await myLinks(hash)});}
    catch(e){console.error('8aPDF links list:',e);return json(res,503,{code:'STORAGE_UNAVAILABLE',error:'Short-link storage is unavailable. Check the connected Vercel Blob store.'});}
  }
  const slug = normalize(req.method === 'GET' ? req.query.slug : req.body?.slug);
  if (!validSlug(slug)) return json(res,400,{error:'Use 3–32 characters: lowercase letters, numbers and single hyphens. Some names are reserved.'});
  try {
    if (req.method === 'GET') {
      const taken = !!(await existing(slug));
      return json(res,200,{ slug, available: !taken, message: taken ? 'This name is already used' : 'This name is available' });
    }
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res,403,{error:'Use the 8aPDF website to create links.'});
    const hash=ownerHash(req.body?.ownerKey);
    if(!hash)return json(res,400,{error:'Missing link-manager ownership key. Refresh 8aPDF and retry.'});
    if(action==='delete'){
      const item=await recordFor(slug);
      if(!item)return json(res,404,{error:'This short link no longer exists.'});
      if(!item.ownerHash || item.ownerHash!==hash)return json(res,403,{error:'Only the browser that created this link can delete it.'});
      await del(`${ROOT}${slug}.json`);
      return json(res,200,{deleted:true,slug});
    }
    if(action!=='create')return json(res,400,{error:'Unknown action.'});
    const docId = req.body?.documentId;
    const verified = await findPublishedPdf(docId,req.body?.pdfUrl);
    if (!verified) return json(res,422,{error:'This PDF could not be verified in the live 8aPDF library.'});
    if (await existing(slug)) return json(res,409,{error:'This name is already used'});
    const record = JSON.stringify({version:2,slug,documentId:docId,url:verified.url,title:verified.title,ownerHash:hash,createdAt:new Date().toISOString()});
    try {
      const options={addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60};
      try{await put(ROOT+slug+'.json',record,{...options,access:'private'})}
      catch(error){
        if(isConflict(error))throw error;
        throw storageError('write',error);
      }
    } catch (error) {
      if (isConflict(error)) {
        return json(res,409,{error:'This name is already used'});
      }
      throw error;
    }
    return json(res,201,{slug,shortUrl:`https://8apdf.vercel.app/${slug}`,message:'Short link created'});
  } catch (error) {
    console.error('8aPDF short-link API:',error?.code||'UNKNOWN',error?.cause?.message||error?.message||error);
    const adminMessages={
      FIREBASE_ADMIN_NOT_CONFIGURED:'FIREBASE_SERVICE_ACCOUNT_JSON is missing in Vercel Production environment.',
      FIREBASE_ADMIN_JSON_INVALID:'Firebase service-account JSON is invalid. Replace the Vercel variable with a freshly downloaded JSON key.',
      FIREBASE_ADMIN_MISSING_FIELDS:'The Vercel variable is not a Firebase service-account JSON. Use Firebase Project settings → Service accounts.',
      FIREBASE_ADMIN_PROJECT_MISMATCH:'Service account is from the wrong Firebase project. Use academyvault-5d1eb.',
      FIREBASE_ADMIN_KEY_INVALID:'Firebase service-account private key is invalid. Generate a fresh service-account JSON key and update Vercel.',
      FIREBASE_ADMIN_AUTH_FAILED:'Google rejected the Firebase service-account credential. Generate a fresh JSON key and redeploy.',
      FIREBASE_ADMIN_PERMISSION_DENIED:'Firebase service account cannot read Firestore. Check its Cloud IAM Firestore access.',
      FIREBASE_DATABASE_NOT_FOUND:'The default Firestore database could not be found in academyvault-5d1eb.',
      FIREBASE_ADMIN_NETWORK:'Firebase Admin could not reach Firestore. Check Vercel function logs and retry.',
      FIREBASE_ADMIN_HTTP_ERROR:'Firestore returned an unexpected response. Check the Firestore database in Firebase Console.',
      FIREBASE_ADMIN_UNAVAILABLE:'Firebase Admin failed unexpectedly. Open Vercel Runtime Logs for /api/short-links.'
    };
    if(Object.hasOwn(adminMessages,error?.code))
      return json(res,503,{code:error.code,error:adminMessages[error.code]});
    return json(res,503,{code:'STORAGE_UNAVAILABLE',error:'Short-link storage is unavailable. Check the connected Vercel Blob store.'});
  }
}