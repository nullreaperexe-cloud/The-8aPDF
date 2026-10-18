/* Smoke tests for the VS Code local Drive music dev server — no credentials required. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createServer}=require('node:net');
(async()=>{
 const temp=createServer();
 await new Promise(resolve=>temp.listen(0,'127.0.0.1',resolve));
 const port=temp.address().port;
 await new Promise(resolve=>temp.close(resolve));
 const child=spawn(process.execPath,['scripts/serve-music-local.mjs'],{
  cwd:process.cwd(),env:{...process.env,PORT:String(port)},
  stdio:['ignore','pipe','pipe']
 });
 let output='',errs='';
 child.stdout.on('data',d=>output+=String(d));
 child.stderr.on('data',d=>errs+=String(d));
 const base='http://127.0.0.1:'+port;
 try{
  let ok=false;
  for(let i=0;i<75;i++){
   if(child.exitCode!==null)throw Error('dev server exited early: '+errs);
   try{const r=await fetch(base+'/__music/health');if(r.ok){ok=true;break}}catch{}
   await new Promise(r=>setTimeout(r,80));
  }
  assert.ok(ok,'dev server did not start: '+output+' '+errs);
  const health=await (await fetch(base+'/__music/health')).json();
  assert.equal(health.ok,true);
  assert.equal(typeof health.folderConfigured,'boolean');
  assert.equal(typeof health.serviceAccountConfigured,'boolean');
  const home=await fetch(base+'/');
  assert.equal(home.status,200);
  assert.match(await home.text(),/studioDriveMusic/);
  const script=await fetch(base+'/drive-music.js');
  assert.equal(script.status,200);
  assert.match(await script.text(),/Google Drive/);
  const style=await fetch(base+'/drive-music.css');
  assert.equal(style.status,200);
  const leaked=await fetch(base+'/.env.local');
  assert.equal(leaked.status,404);
  const blocked=await fetch(base+'/api/materials');
  assert.equal(blocked.status,501);
  console.log('PASS local VS Code server serves player and music API health without exposing secrets');
 }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1400)})}
})().catch(e=>{console.error(e);process.exitCode=1});
