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

// Read only the saved Firestore PDF; a user-provided URL never proves publication.
let anonymousSession=null;
let anonymousRequest=null;
function verifyError(code,message,cause) {
  const error=new Error(message);
  error.code=code;
  if(cause)error.cause=cause;
  return error;
}
async function anonymousToken() {
  if(anonymousSession?.expiresAt>Date.now()+60000)return anonymousSession.token;
  if(anonymousRequest)return anonymousRequest;
  anonymousRequest=(async()=>{
    let response;
    try {
      response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(PUBLIC_FIREBASE_KEY),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({returnSecureToken:true}),signal:AbortSignal.timeout(7000)
      });
    }catch(error){throw verifyError('FIREBASE_AUTH_UNAVAILABLE','Anonymous Firebase sign-in could not connect',error)}
    if(!response.ok)throw verifyError('FIREBASE_AUTH_UNAVAILABLE','Anonymous Firebase sign-in returned HTTP '+response.status);
    const data=await response.json();
    if(typeof data.idToken!=='string'||!data.idToken)
      throw verifyError('FIREBASE_AUTH_UNAVAILABLE','Firebase did not provide an ID token');
    anonymousSession={token:data.idToken,expiresAt:Date.now()+1000*Math.max(60,Number(data.expiresIn)||3600)};
    return data.idToken;
  })();
  try{return await anonymousRequest}
  finally{anonymousRequest=null}
}
function verifiedRecord(fields,originalUrl) {
  const raw=fields?.pdf_url?.stringValue||fields?.pdfUrl?.stringValue||fields?.url?.stringValue;
  if(typeof raw!=='string')return null;
  try {
    const url=new URL(raw);
    const requested=new URL(originalUrl);
    if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password||url.toString()!==requested.toString())return null;
    return {url:url.toString(),title:String(fields.title?.stringValue||'School PDF').slice(0,180)};
  }catch{return null}
}
function parseFirebaseCredential(value) {
  let credential;
  try {
    credential=JSON.parse(String(value).trim());
    if(typeof credential==='string')credential=JSON.parse(credential);
  }catch(e){const err=new Error('Credential JSON parsing failed');err.code='FIREBASE_ADMIN_JSON_INVALID';throw err}
  if(!credential||credential.type!=='service_account'||!credential.client_email||!credential.private_key){
    const err=new Error('Missing required Firebase Admin credential fields');err.code='FIREBASE_ADMIN_MISSING_FIELDS';throw err;
  }
  if(credential.project_id!==PROJECT){
    const err=new Error('Firebase Admin project ID mismatch');err.code='FIREBASE_ADMIN_PROJECT_MISMATCH';throw err;
  }
  return {...credential,private_key:credential.private_key.replace(/\\n/g,'\n')};
}
async function findPublishedPdf(id,originalUrl) {
  if(typeof id!=='string'||!/^[\w-]{1,160}$/.test(id)||typeof originalUrl!=='string')return null;
  let adminFailed=false;
  let adminFailureCode='FIREBASE_ADMIN_UNAVAILABLE';
  if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const {initializeApp,cert,getApps}=await import('firebase-admin/app');
      const {getFirestore}=await import('firebase-admin/firestore');
      const credential=parseFirebaseCredential(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      const app=getApps().find(a=>a.name==='short-links-verifier')||initializeApp({credential:cert(credential)},'short-links-verifier');
      const snap=await getFirestore(app).collection('study_materials').doc(id).get();
      if(!snap.exists)return null;
      const doc=snap.data();
      const fields={title:{stringValue:doc.title},pdf_url:{stringValue:doc.pdf_url||doc.pdfUrl||doc.url}};
      return verifiedRecord(fields,originalUrl);
    } catch(error) {
      adminFailed=true;
      adminFailureCode=error?.code?.startsWith?.('FIREBASE_ADMIN_')?error.code:'FIREBASE_ADMIN_UNAVAILABLE';
      console.error('8aPDF PDF verification Admin SDK error:',error?.code||error?.name||'error',error?.message||'unknown');
      // If the server credential is invalid, authenticated Firestore rules may
      // still permit a read-only anonymous verification. Never skip verification.
    }
  }
  const endpoint='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/study_materials/'+encodeURIComponent(id)+'?key='+encodeURIComponent(PUBLIC_FIREBASE_KEY);
  let response;
  try {
    response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
    if(response.status===401||response.status===403) {
      const token=await anonymousToken();
      response=await fetch(endpoint,{headers:{Accept:'application/json',Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)});
    }
  } catch(error) {
    if(error?.code==='FIREBASE_AUTH_UNAVAILABLE')throw error;
    throw verifyError(adminFailed?adminFailureCode:'LIBRARY_UNAVAILABLE','Firebase document lookup failed',error);
  }
  if(response.status===404)return null;
  if(response.status===401||response.status===403)
    throw verifyError(adminFailed?adminFailureCode:'FIRESTORE_PERMISSION_DENIED','Firestore did not authorize a verified document read');
  if(!response.ok)throw verifyError(adminFailed?adminFailureCode:'LIBRARY_UNAVAILABLE','Firestore document lookup returned HTTP '+response.status);
  let record;
  try{record=await response.json()}
  catch(error){throw verifyError('LIBRARY_UNAVAILABLE','Firestore returned invalid JSON',error)}
  return verifiedRecord(record.fields,originalUrl);
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
    if(error?.code==='FIREBASE_ADMIN_JSON_INVALID')return json(res,503,{code:error.code,error:'Vercel Firebase service account is not valid JSON. Replace it with the downloaded JSON file content.'});
    if(error?.code==='FIREBASE_ADMIN_MISSING_FIELDS')return json(res,503,{code:error.code,error:'The Vercel variable is not a Firebase Admin service-account JSON. Download the correct key from Firebase Project Settings.'});
    if(error?.code==='FIREBASE_ADMIN_PROJECT_MISMATCH')return json(res,503,{code:error.code,error:'The Firebase service account belongs to a different project. Use the key from academyvault-5d1eb.'});
    if(error?.code==='FIREBASE_ADMIN_UNAVAILABLE')return json(res,503,{code:error.code,error:'Firebase Admin verification failed. Check the service-account JSON project ID and private key in Vercel, then redeploy.'});
    if(error?.code==='FIREBASE_AUTH_UNAVAILABLE')return json(res,503,{code:error.code,error:'Firebase anonymous authentication failed. Check Firebase Authentication → Sign-in method, or repair the Vercel service-account JSON.'});
    if(error?.code==='FIRESTORE_PERMISSION_DENIED')return json(res,503,{code:error.code,error:'Firestore rules denied PDF verification even after anonymous sign-in. Verify study_materials read rules or service-account access.'});
    if(error?.code==='LIBRARY_UNAVAILABLE')return json(res,503,{code:error.code,error:'Firebase PDF verification is temporarily unavailable. Check the Vercel function logs.'});
    return json(res,503,{code:'STORAGE_UNAVAILABLE',error:'Short-link storage is unavailable. Check the connected Vercel Blob store.'});
  }
}