/* Regression tests for the 8aPDF Music Catalog announcement.
 * No browser, Google Drive, Supabase, or Vercel credentials required.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('music-launch.js','utf8');
const css=fs.readFileSync('music-launch.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const classic=fs.readFileSync('classic.html','utf8');
new Function(source);
assert.match(html,/src="\/music-launch\.js\?v=1"/);
assert.match(html,/href="\/music-launch\.css\?v=1"/);
assert.match(classic,/src="\/music-launch\.js\?v=1"/);
assert.match(classic,/src="\/drive-music\.js\?v=3"/);
assert.match(css,/--ml-bg:var\(--bg/);
assert.match(css,/--ml-button:var\(--button/);
assert.match(css,/max-height:calc\(100dvh/);
assert.match(source,/classList\.contains\('locked'\)/);
assert.match(source,/name\?\.classList\.contains\('show'\)/);
assert.match(source,/window\.__8apdfDriveMusic\?\.open/);
assert.match(source,/Max-Age=157680000/);
function fixture(storage=new Map(),onboarding=false){
 let active=null,openMusicCalls=0,currentObserver=null,task=[],nodeIndex=0;
 const makeClass=initial=>{
  const set=new Set(initial||[]);
  return {add:(...a)=>a.forEach(x=>set.add(x)),remove:(...a)=>a.forEach(x=>set.delete(x)),contains:x=>set.has(x)};
 };
 const name={classList:makeClass(onboarding?['show']:[])};
 const body={
  classList:makeClass(onboarding?['locked']:[]),style:{overflow:''},inert:false,
  append(n){active=n},isConnected:true
 };
 const doc={
  readyState:'complete',
  body,
  cookie:'',
  documentElement:{dataset:{}},
  activeElement:{isConnected:true,focus(){}},
  getElementById:id=>id==='nameModal'?name:null,
  createElement(){
   const node={
    id:'',className:'',innerHTML:'',handlers:{},
    addEventListener(t,h){this.handlers[t]=h},
    removeEventListener(t){delete this.handlers[t]},
    remove(){if(active===node)active=null},
    querySelector(){return {focus(){}}},
    querySelectorAll(){return []}
   };
   nodeIndex++;
   return node;
  },
  addEventListener(){}
 };
 const localStorage={
  getItem(k){return storage.get(k)||null},
  setItem(k,v){storage.set(k,String(v))}
 };
 const context={
  document:doc,localStorage,location:{protocol:'https:'},
  window:{__8apdfDriveMusic:{open(){openMusicCalls++}}},
  MutationObserver:class {constructor(fn){currentObserver=fn}observe(){}disconnect(){}},
  setTimeout(fn){task.push(fn);return task.length},
  clearTimeout(){task=[]},
 };
 vm.runInNewContext(source,context);
 const api=context.window.__8apdfMusicLaunch;
 return {
  api,storage,doc,name,body,
  get node(){return active},
  get openMusicCalls(){return openMusicCalls},
  tick(){const callbacks=task;task=[];callbacks.forEach(fn=>fn())},
  changed(){currentObserver?.()},
  click(action){assert.ok(active);active.handlers.click({target:{closest:()=>({dataset:{mlAction:action}})}})},
  get nodeIndex(){return nodeIndex}
 };
}
const key='8apdf_music_catalog_launch_v1_dont_show';
const shared=new Map();
let f=fixture(shared);
assert.equal(f.node,null);
f.tick();
assert.ok(f.node);
assert.match(f.node.innerHTML,/97 songs/);
assert.match(f.node.innerHTML,/Don't show again/);
f.click('close');
assert.equal(f.node,null);
assert.equal(shared.has(key),false,'Close must not persist dismissal');
f=fixture(shared);
f.tick();
assert.ok(f.node,'Close should show the popup again on the next visit');
f.click('never');
assert.equal(shared.get(key),'1');
f=fixture(shared);
f.tick();
assert.equal(f.node,null,'Do not show again must persist across visits');
f=fixture(new Map());
f.tick();
f.click('explore');
assert.equal(f.openMusicCalls,1,'Explore must launch the existing music player');
assert.equal(f.storage.has(key),false,'Explore does not mean Never show again');
f=fixture(new Map(),true);
f.tick();
assert.equal(f.node,null,'Announcement must not cover student name onboarding');
f.name.classList.remove('show');
f.body.classList.remove('locked');
f.changed();
f.tick();
assert.ok(f.node,'Announcement opens only after onboarding finishes');
console.log('PASS Music Catalog announcement: repeat Close, permanent Never, Explore, name-gate, responsive theme and markup');
