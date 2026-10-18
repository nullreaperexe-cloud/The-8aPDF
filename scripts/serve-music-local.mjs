/* 8aPDF local music development server.
 * VS Code Live Server serves HTML/CSS/JS but cannot execute /api/music-search.
 * Run "npm run dev:music" after pulling .env.local from Vercel.
 * Uses Node core only; credentials stay in .env.local, never delivered to browsers.
 */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ENV=resolve(ROOT,'.env.local');
if(existsSync(ENV)&&typeof process.loadEnvFile==='function')process.loadEnvFile(ENV);
const PORT=Number(process.env.PORT)||4173;
const types={
 '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon',
 '.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2',
 '.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'
};
function json(res,code,payload){
 res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))
}
const routes=new Set(['/','/pdfs','/settings','/announcements','/updates','/tasks','/chatbot','/tests','/important-messages','/school-reminders','/notification-settings','/pdf-explorer','/school-calendar']);
const handlerModule=()=>import(pathToFileURL(resolve(ROOT,'api/music-search.js')).href);
const server=createServer(async(req,res)=>{
 let path,uri;
 try{uri=new URL(req.url,'http://localhost:'+PORT);path=decodeURIComponent(uri.pathname)}
 catch{return json(res,400,{error:'Invalid URL'})}
 if(!['GET','HEAD'].includes(req.method)){
  res.setHeader('Allow','GET, HEAD');return json(res,405,{error:'Method not allowed'})
 }
 if(path==='/api/music-search'){
  const query=Object.fromEntries(uri.searchParams.entries());
  req.query=query;
  res.status=function(code){this.statusCode=code;return this};
  res.json=function(payload){json(this,this.statusCode||200,payload);return this};
  try{const {default:handler}=await handlerModule();await handler(req,res)}
  catch(err){console.error('[8aPDF dev] Drive music API:',err.code||err.message);if(!res.headersSent)json(res,500,{error:'Local Drive music backend failed; check terminal.'});else if(!res.writableEnded)res.end()}
  return
 }
 if(path.startsWith('/api/'))return json(res,501,{error:'This lightweight local music server serves the Music API only. For all 8aPDF Vercel APIs use "npx vercel dev".'});
 if(path==='/__music/health')return json(res,200,{ok:true,folderConfigured:Boolean(process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID),serviceAccountConfigured:Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)});
 let requested=routes.has(path)?'/index.html':path;
 if(path==='/database'||path==='/live-database')requested='/database.html';
 if(path==='/classic')requested='/classic.html';
 // Never expose service keys or other hidden repository files via the dev HTTP server.
 if(requested.split('/').some(segment=>segment.startsWith('.'))||requested.startsWith('/scripts/')||requested.startsWith('/tests/')||
    requested.startsWith('/api/')||requested==='/package.json'||requested==='/package-lock.json'||
    requested==='/vercel.json'||requested==='/README.md')return json(res,404,{error:'Not found'});
 const file=resolve(ROOT,'.'+requested);
 if(file!==ROOT&&!file.startsWith(ROOT+sep))return json(res,403,{error:'Forbidden'});
 try{
  const info=await stat(file);if(!info.isFile())return json(res,404,{error:'Not a file'});
  const body=await readFile(file);
  res.setHeader('Content-Type',types[extname(file).toLowerCase()]||'application/octet-stream');
  res.setHeader('Cache-Control','no-cache');
  res.statusCode=200;
  res.end(req.method==='HEAD'?undefined:body);
 }catch{json(res,404,{error:'File not found'})}
});
server.listen(PORT,'127.0.0.1',()=>{
 const ready=Boolean(process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID)&&Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
 console.log('\n🎵 8aPDF local Drive music dev server: http://localhost:'+PORT);
 console.log('   Google Drive credentials: '+(ready?'PRESENT ✓':'MISSING — run npx vercel env pull .env.local --environment=production'));
 console.log('   Test: http://localhost:'+PORT+'/api/music-search?action=status\n');
});
