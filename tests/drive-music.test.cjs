/* Offline, credential-free integration tests for Drive-backed music API.
 * Runs with mocked Google OAuth + Drive so no real secret/data is exposed.
 */
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {generateKeyPairSync}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
(async()=>{
 const src=readFileSync(resolve('drive-music.js'),'utf8');
 const home=readFileSync(resolve('index.html'),'utf8');
 new Function(src);
 assert.match(home,/id="studioDriveMusic"/);
 assert.match(home,/id="studioMobileDriveMusic"/);
 assert.match(home,/src="\/drive-music\.js\?v=2"/);
 assert.match(home,/href="\/drive-music\.css\?v=2"/);
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const previous={json:process.env.GOOGLE_SERVICE_ACCOUNT_JSON,folder:process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID,fetch:globalThis.fetch};
 process.env.GOOGLE_SERVICE_ACCOUNT_JSON=JSON.stringify({
  client_email:'unit-test@localhost.invalid',
  private_key:privateKey.export({type:'pkcs8',format:'pem'})
 });
 process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID='folder12345ABCDE';
 let calls=[],mediaRange='';
 globalThis.fetch=async(uri,options={})=>{
  const url=String(uri);calls.push(url);
  if(url.startsWith('https://oauth2.googleapis.com/token'))return new Response(JSON.stringify({access_token:'unit-test-access-token',expires_in:3600}),{status:200});
  if(url.includes('/drive/v3/files/folder12345ABCDE?'))return new Response(JSON.stringify({id:'folder12345ABCDE',name:'8aPDF Music',mimeType:'application/vnd.google-apps.folder'}),{status:200});
  if(url.startsWith('https://www.googleapis.com/drive/v3/files?')){
   assert.match(decodeURIComponent(url),/folder12345ABCDE/);
   return new Response(JSON.stringify({files:[
    {id:'song123456789ABC',name:'Punjabi Hit.mp3',mimeType:'audio/mpeg',size:'9000000'},
    {id:'notAnAudio12345',name:'private.pdf',mimeType:'application/pdf',size:'5000'}
   ]}),{status:200});
  }
  if(url.includes('song123456789ABC?alt=media')){
   mediaRange=options.headers.Range;
   assert.equal(mediaRange,'bytes=1024-3071');
   return new Response(Buffer.alloc(2048,10),{status:206,headers:{'content-range':'bytes 1024-3071/9000000'}});
  }
  throw Error('Unexpected Google request: '+url);
 };
 class FakeResponse extends EventEmitter{
  constructor(){super();this.headers={};this.statusCode=200;this.data=null;this.chunks=[];this.headersSent=false;this.destroyed=false;this.writableEnded=false}
  setHeader(k,v){this.headers[k.toLowerCase()]=v;return this}
  status(v){this.statusCode=v;return this}
  json(value){this.data=value;this.headersSent=true;this.writableEnded=true;return this}
  write(chunk){this.headersSent=true;this.chunks.push(Buffer.from(chunk));return true}
  end(){this.writableEnded=true;return this}
 }
 try{
  const mod=await import(pathToFileURL(resolve('api/music-search.js')).href);
  const handler=mod.default;
  const listed=new FakeResponse();
  await handler({method:'GET',query:{action:'tracks'},headers:{}},listed);
  assert.equal(listed.statusCode,200);
  assert.equal(listed.data.count,1);
  assert.equal(listed.data.tracks[0].title,'Punjabi Hit');
  const status=new FakeResponse();
  await handler({method:'GET',query:{action:'status'},headers:{}},status);
  assert.equal(status.data.folderName,'8aPDF Music');
  assert.ok(!JSON.stringify(listed.data).includes('unit-test-access-token'));
  const streamed=new FakeResponse();
  await handler({method:'GET',query:{action:'stream',id:'song123456789ABC'},headers:{range:'bytes=1024-3071'}},streamed);
  assert.equal(streamed.statusCode,206);
  assert.equal(streamed.headers['content-range'],'bytes 1024-3071/9000000');
  assert.equal(Buffer.concat(streamed.chunks).length,2048);
  const denied=new FakeResponse();
  await handler({method:'GET',query:{action:'stream',id:'notAnAudio12345'},headers:{}},denied);
  assert.equal(denied.statusCode,404);
  assert.equal(denied.data.code,'UNKNOWN_TRACK');
  const invalid=new FakeResponse();
  await handler({method:'GET',query:{action:'stream',id:'song123456789ABC'},headers:{range:'bytes=9000001-'}},invalid);
  assert.equal(invalid.statusCode,416);
  assert.equal(invalid.headers['content-range'],'bytes */9000000');
  assert.equal(mediaRange,'bytes=1024-3071');
  assert.equal(calls.filter(x=>x.includes('/token')).length,1,'OAuth token should be reused');
  console.log('PASS: Google Drive private music catalog, media byte-ranges, auth caching and invalid track denial');
 }finally{
  globalThis.fetch=previous.fetch;
  if(previous.json===undefined)delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;else process.env.GOOGLE_SERVICE_ACCOUNT_JSON=previous.json;
  if(previous.folder===undefined)delete process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID;else process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID=previous.folder;
 }
})().catch(error=>{console.error(error);process.exitCode=1});
