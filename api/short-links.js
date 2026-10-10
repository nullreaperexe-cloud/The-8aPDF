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
  try{return await get(pathname,{access:'private'})}
  catch(firstError){
    try{return await get(pathname,{access:'public'})}
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

function trustedSchoolPdf(input) {
  try {
    const url=new URL(String(input||''));
    return url.protocol==='https:' && url.hostname==='edusecure.org' &&
      /^\/ManavMangal88\/StudentInfo\/Homework\/[a-f0-9]{32}\.pdf$/i.test(url.pathname) &&
      !url.search && !url.hash && !url.username && !url.password ? url.toString() : null;
  } catch { return null }
}
async function findPublishedPdf(id,originalUrl) {
  if(typeof id!=='string'||!/^[\w-]{1,160}$/.test(id))return null;
  const trusted=trustedSchoolPdf(originalUrl);
  const endpoint='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/study_materials/'+encodeURIComponent(id)+'?key='+PUBLIC_FIREBASE_KEY;
  let response;
  try {
    response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(trusted?3500:8000)});
  }catch(error){
    if(trusted)return {url:trusted,title:'School PDF',verifiedBy:'trusted-school-host'};
    const e=new Error('School library API unavailable');e.code='LIBRARY_UNAVAILABLE';e.cause=error;throw e;
  }
  if(response.status===404)return null;
  if(!response.ok){
    if((response.status===400||response.status===401||response.status===403||response.status===429||response.status>=500)&&trusted)
      return {url:trusted,title:'School PDF',verifiedBy:'trusted-school-host'};
    const e=new Error('School library verification failed: '+response.status);e.code='LIBRARY_UNAVAILABLE';throw e;
  }
  const data=await response.json();
  const raw=data.fields?.pdf_url?.stringValue;
  if(typeof raw!=='string')return null;
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password)return null;
    if(originalUrl&&new URL(String(originalUrl)).toString()!==url.toString())return null;
    return {url:url.toString(),title:String(data.fields?.title?.stringValue||'School PDF').slice(0,180),verifiedBy:'firestore'};
  } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow','GET, POST');
    return json(res,405,{error:'Method not allowed'});
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res,503,{error:'Short links need Vercel Blob storage. Connect a private Blob store to this project first.'});
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
        try{await put(ROOT+slug+'.json',record,{...options,access:'public'})}
        catch(second){
          if(isConflict(second))throw second;
          throw storageError('write',second);
        }
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
    if(error?.code==='LIBRARY_UNAVAILABLE')return json(res,503,{code:error.code,error:'Could not verify this PDF in the school library. Use Original PDF Link or retry later.'});
    return json(res,503,{code:'STORAGE_UNAVAILABLE',error:'Short-link storage is unavailable. Check the connected Vercel Blob store.'});
  }
}