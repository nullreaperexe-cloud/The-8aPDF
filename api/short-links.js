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
function isBlobModeMismatch(error){const message=String(error?.message||'');return /\b(public|private)\b/i.test(message)&&/\b(access|store|mode|blob)\b/i.test(message)}
async function existing(slug) { const pathname=`${ROOT}${slug}.json`;try{const item=await get(pathname,{access:'private'});if(item)return item}catch(error){if(!isBlobModeMismatch(error))throw error}try{return await get(pathname,{access:'public'})}catch(error){if(isBlobModeMismatch(error))return null;throw error} }
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

async function findPublishedPdf(id) {
  if (typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id)) return null;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/study_materials/${encodeURIComponent(id)}?key=${PUBLIC_FIREBASE_KEY}`;
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore verification failed: ${response.status}`);
  const data = await response.json();
  const raw = data.fields?.pdf_url?.stringValue;
  if (typeof raw !== 'string') return null;
  try {
    const target = new URL(raw);
    if (target.protocol !== 'https:' || !target.hostname.includes('.') || target.username || target.password) return null;
    return {url:target.toString(),title:String(data.fields?.title?.stringValue||'School PDF').slice(0,180)};
  } catch { return null; }
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
    catch(e){console.error('8aPDF links list:',e);return json(res,503,{error:'Could not load your links right now.'});}
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
    const verified = await findPublishedPdf(docId);
    if (!verified) return json(res,422,{error:'This PDF could not be verified in the live 8aPDF library.'});
    if (await existing(slug)) return json(res,409,{error:'This name is already used'});
    const record = JSON.stringify({version:2,slug,documentId:docId,url:verified.url,title:verified.title,ownerHash:hash,createdAt:new Date().toISOString()});
    try {
      const options={addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60};
      try{await put(`${ROOT}${slug}.json`,record,{...options,access:'private'})}
      catch(error){if(!isBlobModeMismatch(error))throw error;await put(`${ROOT}${slug}.json`,record,{...options,access:'public'})}
    } catch (error) {
      if (/already exists|BlobAlreadyExists|pathname is already/i.test(String(error?.name)+' '+String(error?.message))) {
        return json(res,409,{error:'This name is already used'});
      }
      throw error;
    }
    return json(res,201,{slug,shortUrl:`https://8apdf.vercel.app/${slug}`,message:'Short link created'});
  } catch (error) {
    console.error('8aPDF short-link API:',error?.message || error);
    return json(res,503,{error:'Short-link service is temporarily unavailable. Please try again.'});
  }
}