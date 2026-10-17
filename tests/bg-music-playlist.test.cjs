/* Regression test for the ACTUAL 8aPDF background music player, without browser/network dependencies. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('bgm-howler.js','utf8');
new vm.Script(source,{filename:'bgm-howler.js'});
const storage=new Map();
function start(){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   value:'',checked:false,disabled:false,textContent:'',innerHTML:'',
   listeners:{},addEventListener(name,callback){this.listeners[name]=callback},
   event(name){this.listeners[name]?.({target:this})}
  });
  return elements.get(id);
 };
 const audio={
  src:'',loop:false,volume:1,style:{},listeners:{},paused:true,
  addEventListener(name,callback){this.listeners[name]=callback},
  event(name){this.listeners[name]?.()},
  setAttribute(){},load(){},
  pause(){this.paused=true;this.event('pause')},
  play(){this.paused=false;this.event('playing');return Promise.resolve()}
 };
 const document={
  readyState:'complete',getElementById:element,
  createElement:name=>name==='audio'?audio:element(name),
  head:{appendChild(){}},body:{appendChild(){}},
  addEventListener(){}
 };
 const context={document,window:{addEventListener(){}},localStorage:{
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,String(value))
 },console,Promise};
 vm.runInNewContext(source,context,{filename:'bgm-howler.js'});
 return {audio,elements,api:context.window.__8apdfBackgroundAudio};
}
const seq=s=>Array.from(s.api.getState().selectedTracks);
const first=start();
assert.deepEqual(seq(first),['tum-hi-ho','khairiyat','saiyaara']);
assert.equal(first.audio.src,'/assets/bgm/tum-hi-ho.mp3');
assert.equal(first.audio.loop,false);
first.audio.event('ended');
assert.equal(first.audio.src,'/assets/bgm/khairiyat.mp3');
first.audio.event('ended');
assert.equal(first.audio.src,'/assets/bgm/saiyaara.mp3');
first.audio.event('ended');
assert.equal(first.audio.src,'/assets/bgm/tum-hi-ho.mp3');
first.api.select('khairiyat');
assert.deepEqual(seq(first),['khairiyat']);
assert.equal(first.audio.loop,true);
assert.equal(first.audio.src,'/assets/bgm/khairiyat.mp3');
const reload=start();
assert.deepEqual(seq(reload),['khairiyat']);
assert.equal(reload.audio.loop,true);
assert.equal(reload.audio.src,'/assets/bgm/khairiyat.mp3');
reload.api.setSongs(['saiyaara','tum-hi-ho']);
assert.deepEqual(seq(reload),['tum-hi-ho','saiyaara']);
assert.equal(reload.audio.loop,false);
reload.audio.event('ended');
assert.equal(reload.audio.src,'/assets/bgm/saiyaara.mp3');
reload.audio.event('ended');
assert.equal(reload.audio.src,'/assets/bgm/tum-hi-ho.mp3');
const again=start();
assert.deepEqual(seq(again),['tum-hi-ho','saiyaara']);
assert.equal(source.includes('meri-duniya-tu-hi-re'),false);
for(const name of ['tum-hi-ho','khairiyat','saiyaara'])
 assert(fs.existsSync('assets/bgm/'+name+'.mp3'),'Original MP3 missing: '+name);
console.log('PASS 3-track order, solo looping, 2-song selection, saved settings and removed song');
