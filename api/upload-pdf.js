// Authenticated manual PDF upload. Never allow unlimited public uploads by default.
// Required Vercel environment variables: PDF_UPLOAD_TOKEN, BLOB_READ_WRITE_TOKEN.
import {put} from '@vercel/blob';
import {randomBytes,timingSafeEqual} from 'node:crypto';
export const config={api:{bodyParser:false}};
const MAX=4*1024*1024;
function send(res,status,obj){return res.status(status).setHeader('Cache-Control','no-store').json(obj)}
function matches(given,expected){if(!given||!expected)return false;const a=Buffer.from(given),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)}
async function readStream(req){const chunks=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>MAX){const e=new Error('File exceeds 4 MB server upload limit');e.status=413;throw e}chunks.push(part)}return Buffer.concat(chunks)}
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'POST only'});
 if(!process.env.PDF_UPLOAD_TOKEN||!process.env.BLOB_READ_WRITE_TOKEN)return send(res,503,{error:'Set PDF_UPLOAD_TOKEN and BLOB_READ_WRITE_TOKEN in Vercel before enabling public uploads.'});
 if(!matches(String(req.headers['x-upload-token']||''),process.env.PDF_UPLOAD_TOKEN))return send(res,401,{error:'Incorrect upload authorization code.'});
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/pdf'))return send(res,415,{error:'PDF files only.'});
 const claimed=Number(req.headers['content-length']||0);if(claimed>MAX)return send(res,413,{error:'Maximum PDF upload size is 4 MB.'});
 let file;try{file=await readStream(req)}catch(e){return send(res,e.status||400,{error:e.message})}
 if(file.length<10||file.subarray(0,5).toString()!=='%PDF-')return send(res,415,{error:'Invalid PDF file. Please choose a real PDF.'});
 let name;try{name=decodeURIComponent(String(req.headers['x-filename']||'School PDF.pdf'))}catch{name='School PDF.pdf'}
 name=name.replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').trim().slice(0,100)||'School PDF.pdf';if(!name.toLowerCase().endsWith('.pdf'))name+='.pdf';
 const slug='p'+randomBytes(7).toString('hex');
 try{
  const blob=await put(`shared-pdfs/${slug}.pdf`,file,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'application/pdf',cacheControlMaxAge:31536000});
  const record=JSON.stringify({version:2,slug,documentId:null,url:blob.url,title:name,ownerHash:'manual-file',createdAt:new Date().toISOString()});
  await put(`short-links/v1/${slug}.json`,record,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60});
  return send(res,201,{shortUrl:`/${slug}`,pdfUrl:blob.url,title:name});
 }catch(e){console.error('8aPDF upload error',String(e));return send(res,502,{error:'PDF hosting or short-link storage is unavailable. Check Vercel Blob storage connection.'})}
}