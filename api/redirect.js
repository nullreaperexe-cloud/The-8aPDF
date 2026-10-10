import { get } from '@vercel/blob';
const ROOT='short-links/v1/';
const VALID=/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
export default async function handler(req,res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).end();
  }
  const slug=typeof req.query.slug==='string'?req.query.slug.trim().toLowerCase():'';
  if(!VALID.test(slug)||slug.includes('--'))return res.status(404).send('8aPDF short link not found.');
  if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).send('8aPDF short links are not configured yet.');
  try {
    let item;try{item=await get(`${ROOT}${slug}.json`,{access:'private'})}catch(error){if(!/\b(public|private)\b/i.test(String(error?.message||''))||!/\b(access|store|mode|blob)\b/i.test(String(error?.message||'')))throw error}if(!item){try{item=await get(`${ROOT}${slug}.json`,{access:'public'})}catch(error){if(!/\b(public|private)\b/i.test(String(error?.message||''))||!/\b(access|store|mode|blob)\b/i.test(String(error?.message||'')))throw error}}
    if(!item||item.statusCode!==200)return res.status(404).send('8aPDF short link not found.');
    const record=JSON.parse(await new Response(item.stream).text());
    const u=new URL(record.url);
    if(record.slug!==slug||u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password) {
      return res.status(404).send('Invalid 8aPDF short link.');
    }
    res.setHeader('Location',u.toString());
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(302).end();
  } catch(error) {
    console.error('8aPDF short redirect:',error?.message||error);
    return res.status(503).send('Could not resolve this short link right now.');
  }
}