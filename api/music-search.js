/* 8aPDF — private Google Drive music backend.
 * Server-only credentials: GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_MUSIC_FOLDER_ID.
 * A single Vercel function handles listing and byte-range MP3 streaming so Hobby's
 * 12-function limit is respected. Never return Drive OAuth tokens to clients.
 * This is meant for music the operator is authorized to stream.
 */
import { createSign } from 'node:crypto';

const ROOT='https://www.googleapis.com/drive/v3/files';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const AUDIO_TYPES=new Set(['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/flac','application/ogg']);
const AUDIO_EXT=/\.(mp3|m4a|aac|ogg|wav|flac)$/i;
const ID_RE=/^[A-Za-z0-9_-]{10,180}$/;
const MAX_CHUNK=2*1024*1024;
const MAX_RESULTS=1000;
let auth={token:null,expires:0};
let libraryCache={folder:null,items:null,expires:0};
const error=(code,status,message)=>Object.assign(new Error(message),{code,status});
const safeError=(e)=>{if(e?.status)return e;return error('DRIVE_UNAVAILABLE',502,'Google Drive could not be reached. Try again shortly.')};
function config(){
 // Music folder ID is not secret. Use the owner-confirmed location if a
 // Production Environment Variable is missing or pasted as a full Drive URL.
 const verifiedFolder='1GiJCrqQ-WYt-013sy37UJVkK9H2cGWDm';
 const configuredFolder=String(process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID||'').trim();
 const folderUrlMatch=configuredFolder.match(/\/folders\/([A-Za-z0-9_-]{10,180})/);
 const candidate=folderUrlMatch?.[1]||configuredFolder;
 const folder=ID_RE.test(candidate)?candidate:verifiedFolder;
 const raw=String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();
 if(!raw||raw==='null'||raw==='{}'||raw==='[SENSITIVE]')throw error('DRIVE_KEY_MISSING',503,'Google Drive service account key is missing in Vercel Production. Re-save the original JSON key as GOOGLE_SERVICE_ACCOUNT_JSON, then redeploy.');
 let service;
 try{
  service=JSON.parse(raw);
  // Vercel values sometimes contain a double-encoded JSON string.
  if(typeof service==='string')service=JSON.parse(service);
  if(service&&typeof service==='object'&&!service.private_key&&service.credentials?.private_key)service=service.credentials;
 }catch{throw error('DRIVE_CREDENTIAL_INVALID',503,'GOOGLE_SERVICE_ACCOUNT_JSON in Vercel Production is not valid JSON. Re-save the original service-account key file and redeploy.')}
 if(typeof service?.client_email!=='string'||!service.client_email.trim()||
    typeof service?.private_key!=='string'||!service.private_key.includes('BEGIN PRIVATE KEY')){
  throw error('DRIVE_KEY_MISSING_FIELDS',503,'GOOGLE_SERVICE_ACCOUNT_JSON is present but missing client_email/private_key. Upload the complete original Google Cloud service-account JSON to Vercel Production and redeploy.');
 }
 return {service,folder};
}
function base64url(value){return Buffer.from(value).toString('base64url')}
async function tokenFor(service){
 if(auth.token&&Date.now()<auth.expires)return auth.token;
 const now=Math.floor(Date.now()/1000);
 const header=base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const payload=base64url(JSON.stringify({
  iss:service.client_email,
  scope:'https://www.googleapis.com/auth/drive.readonly',
  aud:TOKEN_URL,iat:now,exp:now+3500
 }));
 const unsigned=header+'.'+payload;
 let signature;
 try{const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();signature=signer.sign(service.private_key).toString('base64url')}
 catch{throw error('DRIVE_CREDENTIAL_INVALID',503,'Google Drive service account private key is invalid.')}
 const response=await fetch(TOKEN_URL,{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),
  signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw error('DRIVE_AUTH_FAILED',503,'Google rejected the Drive service account. Check the key, API and folder sharing permissions.');
 const data=await response.json();
 if(!data.access_token)throw error('DRIVE_AUTH_FAILED',503,'Google did not return a Drive access token.');
 auth={token:data.access_token,expires:Date.now()+Math.max(60,(Number(data.expires_in)||3600)-120)*1000};
 return auth.token;
}
async function driveGet(url,token,extraHeaders){
 const resp=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json',...extraHeaders},signal:AbortSignal.timeout(20000)});
 if(resp.status===401)auth={token:null,expires:0};
 if(!resp.ok){
  if(resp.status===403)throw error('DRIVE_PERMISSION_DENIED',403,'Music folder access denied. Share the folder with the service account as Viewer and enable Drive API.');
  if(resp.status===404)throw error('DRIVE_NOT_FOUND',404,'Drive folder or song was not found by the service account.');
  if(resp.status===429)throw error('DRIVE_RATE_LIMITED',429,'Google Drive temporarily rate-limited playback. Please retry shortly.');
  throw error('DRIVE_API_ERROR',502,'Google Drive returned HTTP '+resp.status+'.');
 }
 return resp;
}
const validTrack=file=>{
 const mime=String(file.mimeType||'').toLowerCase(),name=String(file.name||'');
 return ID_RE.test(file.id||'')&&
  (AUDIO_TYPES.has(mime)||AUDIO_EXT.test(name))&&
  Number.isFinite(Number(file.size))&&Number(file.size)>0;
};
const publicTrack=file=>({
 id:file.id,name:String(file.name||'Untitled').slice(0,180),
 title:String(file.name||'Untitled').replace(/\.(mp3|m4a|aac|ogg|wav|flac)$/i,'').replace(/_/g,' ').slice(0,180),
 size:Number(file.size)||0,mimeType:AUDIO_TYPES.has(file.mimeType)?file.mimeType:'audio/mpeg'
});
async function listTracks(config,force=false){
 const now=Date.now();
 if(!force&&libraryCache.folder===config.folder&&libraryCache.items&&now<libraryCache.expires)return libraryCache.items;
 const token=await tokenFor(config.service),found=[],seen=new Set();
 // Validate the actual folder instead of treating an incorrect folder ID as an empty playlist.
 const folderResponse=await driveGet(ROOT+'/'+encodeURIComponent(config.folder)+'?fields=id,name,mimeType&supportsAllDrives=true',token);
 const folderMetadata=await folderResponse.json();
 if(folderMetadata.mimeType!=='application/vnd.google-apps.folder')throw error('DRIVE_FOLDER_INVALID',400,'The configured Google Drive ID is not a folder.');
 let nextPage='';
 do{
  const params=new URLSearchParams({
   q:"'"+config.folder+"' in parents and trashed = false",
   pageSize:'200',
   fields:'nextPageToken,files(id,name,mimeType,size)',
   orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'
  });
  if(nextPage)params.set('pageToken',nextPage);
  const response=await driveGet(ROOT+'?'+params,token);
  const json=await response.json();
  for(const f of Array.isArray(json.files)?json.files:[]){
   if(validTrack(f)&&!seen.has(f.id)){found.push(publicTrack(f));seen.add(f.id)}
   if(found.length>=MAX_RESULTS)break;
  }
  nextPage=typeof json.nextPageToken==='string'?json.nextPageToken:'';
 }while(nextPage&&found.length<MAX_RESULTS);
 const items=found.sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true}));
 libraryCache={folder:config.folder,folderName:String(folderMetadata.name||'Google Drive Music').slice(0,120),items,expires:now+70000};
 return items;
}
function readRange(value,total){
 if(!value)return {start:0,end:Math.min(MAX_CHUNK,total)-1};
 const match=/^bytes=(\d*)-(\d*)$/.exec(String(value).trim());
 if(!match||(match[1]===''&&match[2]===''))return null;
 let start,end;
 if(match[1]===''){
  const suffix=Number(match[2]);
  if(!Number.isSafeInteger(suffix)||suffix<=0)return null;
  start=Math.max(0,total-suffix);end=total-1;
 }else{
  start=Number(match[1]);end=match[2]!==''?Number(match[2]):total-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return null;
 }
 if(start>=total||start<0||end<start)return null;
 return {start,end:Math.min(end,total-1,start+MAX_CHUNK-1)};
}
async function stream(req,res,conf,id){
 if(!ID_RE.test(id))throw error('INVALID_TRACK',400,'Invalid song ID.');
 let files=await listTracks(conf),track=files.find(x=>x.id===id);
 if(!track){files=await listTracks(conf,true);track=files.find(x=>x.id===id)}
 if(!track)throw error('UNKNOWN_TRACK',404,'This song is not in your 8aPDF Music folder.');
 const range=readRange(req.headers.range,track.size);
 res.setHeader('Accept-Ranges','bytes');
 if(!range){
  res.setHeader('Content-Range','bytes */'+track.size);
  return res.status(416).end();
 }
 const {start,end}=range,length=end-start+1;
 const token=await tokenFor(conf.service);
 // Google Drive supports RFC 7233 Range on alt=media; never fetch the complete MP3.
 const upstream=await fetch(ROOT+'/'+encodeURIComponent(id)+'?alt=media&supportsAllDrives=true',{
  headers:{Authorization:'Bearer '+token,Range:'bytes='+start+'-'+end},
  signal:AbortSignal.timeout(25000)
 });
 if(!upstream.ok){
  if(upstream.body)await upstream.body.cancel().catch(()=>{});
  if(upstream.status===403||upstream.status===404)throw error('DRIVE_PERMISSION_DENIED',403,'Google Drive could not provide this song. Verify folder sharing.');
  throw error('DRIVE_STREAM_ERROR',502,'Google Drive stream unavailable (HTTP '+upstream.status+').');
 }
 // If Drive ignores Range, a seek would return wrong data; reject it.
 if(upstream.status!==206&&start!==0){
  await upstream.body?.cancel().catch(()=>{});
  throw error('DRIVE_RANGE_UNSUPPORTED',502,'Google Drive did not honor the requested audio range.');
 }
 const googleRange=upstream.headers.get('content-range');
 if(googleRange&&Number((/bytes (\d+)-/.exec(googleRange)||[])[1])!==start){
  await upstream.body?.cancel().catch(()=>{});
  throw error('DRIVE_RANGE_MISMATCH',502,'Google Drive returned incorrect audio range.');
 }
 res.status(206);
 res.setHeader('Content-Type',track.mimeType||'audio/mpeg');
 res.setHeader('Content-Length',String(length));
 res.setHeader('Content-Range','bytes '+start+'-'+end+'/'+track.size);
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='HEAD'){await upstream.body?.cancel().catch(()=>{});return res.end()}
 if(!upstream.body)throw error('DRIVE_EMPTY_STREAM',502,'Google Drive returned an empty stream.');
 const reader=upstream.body.getReader();let left=length;
 try{
  while(left>0){
   if(res.destroyed)break;
   const {done,value}=await reader.read();if(done)break;
   const segment=value.byteLength>left?value.subarray(0,left):value;
   if(segment.byteLength){
    left-=segment.byteLength;
    if(!res.write(Buffer.from(segment)))await new Promise(resolve=>res.once('drain',resolve));
   }
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 if(!res.destroyed)res.end();
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Method not allowed'})}
 try{
  const conf=config();
  const action=String(req.query?.action||'tracks');
  if(action==='tracks'||action==='status'){
   const tracks=await listTracks(conf,String(req.query?.refresh||'')==='1');
   res.setHeader('Cache-Control','private, max-age=0, must-revalidate');
   if(action==='status')return res.status(200).json({ok:true,source:'Google Drive',count:tracks.length,folderConnected:true,folderName:libraryCache.folderName});
   return res.status(200).json({tracks,count:tracks.length,source:'Google Drive',maxRangeBytes:MAX_CHUNK});
  }
  if(action==='stream')return await stream(req,res,conf,String(req.query?.id||''));
  return res.status(400).json({error:'Unknown music action'});
 }catch(e){
  const err=safeError(e);
  console.error('8aPDF Music:',err.code||'DRIVE_ERROR',String(e?.message||'').slice(0,120));
  if(res.headersSent){if(!res.writableEnded)res.end();return}
  return res.status(err.status).json({error:err.message,code:err.code});
 }
}
