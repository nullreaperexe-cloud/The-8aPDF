const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const dirname=path.join(__dirname,'..','api');
function load(fname,bindings){let code=fs.readFileSync(path.join(dirname,fname),'utf8');code=code.replace(/^import[^\n]*\n/gm,'').replace(/export const config=/,'const config=').replace(/export default async function handler/,'async function handler');return new Function(...Object.keys(bindings),code+'\nreturn {handler,config:typeof config!=="undefined"?config:null};')(...Object.values(bindings));}
function response(){let code=200,payload;return {status(n){code=n;return this},setHeader(){return this},json(obj){payload=obj;return this},result(){return {code,payload}}}}
async function* chunks(buf){yield buf}
function makeReq(body,token,more={}){return {method:'POST',headers:{'x-upload-token':token,'content-type':'application/pdf','x-filename':'school.pdf','content-length':body.length,...more},[Symbol.asyncIterator](){return chunks(body)}}}
(async()=>{
const stored=[];const put=async(path,data,options)=>{stored.push({path,data,options});return {url:'https://example.public.blob.vercel-storage.com/shared-pdfs/file.pdf'}};
const {handler,config}=load('upload-pdf.js',{put,randomBytes,timingSafeEqual,createHash,Buffer,process:{env:{PDF_UPLOAD_TOKEN:'sample-secret',BLOB_READ_WRITE_TOKEN:'sample-blob'}}});
assert.deepEqual(config,{api:{bodyParser:false}});
let result=response();await handler(makeReq(Buffer.from('%PDF-1.7\nHello'),'wrong'),result);assert.equal(result.result().code,401);
result=response();await handler(makeReq(Buffer.from('HACKSCRIPT'),'sample-secret'),result);assert.equal(result.result().code,415);
result=response();await handler(makeReq(Buffer.from('%PDF-1.7\nHello'), 'sample-secret',{'x-owner-key':'a'.repeat(64)}),result);assert.equal(result.result().code,201);assert.equal(stored.length,2);assert.equal(stored[0].options.contentType,'application/pdf');assert.equal(stored[1].options.contentType,'application/json');const record=JSON.parse(stored[1].data);assert.equal(record.ownerHash,createHash('sha256').update('a'.repeat(64)).digest('hex'));assert.match(result.result().payload.shortUrl,/^\/p[0-9a-f]{14}$/);
console.log('PASS upload auth, file type, public short link, owner linkage');
let geminiCalls=0;const fakefetch=async (url,options)=>{geminiCalls++;assert(url.includes('gemini-2.5-flash-lite'));return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Science Ch8: Example Summary'}]}}]})}};
const {handler:summary}=load('pdf-summarize.js',{fetch:fakefetch,process:{env:{GEMINI_API_KEY:'dummy'}} ,AbortController, setTimeout,clearTimeout, Date,Map, console});
result=response();await summary({method:'GET',headers:{}},result);assert.equal(result.result().payload.configured,true);
result=response();await summary({method:'POST',headers:{'x-forwarded-for':'unit-test'},body:{title:'Science',text:'Sentence '.repeat(30)}},result);assert.equal(result.result().code,200);assert.equal(geminiCalls,1);assert.match(result.result().payload.summary,/Science Ch8/);
console.log('PASS Gemini route configuration check and mocked generation');
})().catch(e=>{console.error(e);process.exit(1)});

// Static assertions prevent accidentally disconnecting original features.
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'workspace-upgrade.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(ui.includes('function buildSidebar()'));
assert(ui.includes('function summarize(doc)'));
assert(ui.includes('function settings()'));
assert(html.includes('/workspace-upgrade.js')&&html.includes('/workspace-upgrade.css'));
assert(html.includes('window.__8apdfStudyBridge='));
assert(html.includes('window.__8apdfZipExport=createPdfZip'));
console.log('PASS existing 8aPDF integration markers');