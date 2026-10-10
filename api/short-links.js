import { get, put } from '@vercel/blob';

const ROOT = 'short-links/v1/';
const PROJECT = 'academyvault-5d1eb';
const PUBLIC_FIREBASE_KEY = 'AIzaSyATxKki6gkNWic_CnoGbZnOZjAUj1lbKGI';
const RESERVED = new Set(['api','app','admin','about','help','privacy','terms','settings','home','index','login','logout','register','signup','dashboard','library','timetable','announcement','announcements','pdf','pdfs','share','s','short','download','manifest','favicon','robots','sitemap','assets','static','public','support','contact','status','vercel','www']);
const pattern = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

function normalize(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function validSlug(value) { return pattern.test(value) && !RESERVED.has(value) && !value.includes('--'); }
function json(res, code, payload) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(code).json(payload);
}
async function existing(slug) { return get(`${ROOT}${slug}.json`, { access: 'private' }); }

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
    return target.toString();
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow','GET, POST');
    return json(res,405,{error:'Method not allowed'});
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res,503,{error:'Short links need Vercel Blob storage. Connect a private Blob store to this project first.'});
  const slug = normalize(req.method === 'GET' ? req.query.slug : req.body?.slug);
  if (!validSlug(slug)) return json(res,400,{error:'Use 3–32 characters: lowercase letters, numbers and single hyphens. Some names are reserved.'});
  try {
    if (req.method === 'GET') {
      const taken = !!(await existing(slug));
      return json(res,200,{ slug, available: !taken, message: taken ? 'This name is already used' : 'This name is available' });
    }
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res,403,{error:'Use the 8aPDF website to create links.'});
    const docId = req.body?.documentId;
    const pdfUrl = await findPublishedPdf(docId);
    if (!pdfUrl) return json(res,422,{error:'This PDF could not be verified in the live 8aPDF library.'});
    if (await existing(slug)) return json(res,409,{error:'This name is already used'});
    const record = JSON.stringify({version:1,slug,documentId:docId,url:pdfUrl,createdAt:new Date().toISOString()});
    try {
      await put(`${ROOT}${slug}.json`,record,{
        access:'private', addRandomSuffix:false, allowOverwrite:false,
        contentType:'application/json',cacheControlMaxAge:60
      });
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