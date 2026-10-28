/* Real code regression: one-time consent UI, name-before-music sequencing,
 * silent-by-default background music and the 3-song source allowlist.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('music-choice.js','utf8');
const bgm=fs.readFileSync('bgm-howler.js','utf8');
new vm.Script(source);
new vm.Script(bgm);
function consentFixture(store=new Map(),nameVisible=false,welcomeVisible=false){
 const listeners={};const buttons={};
 const localStorage={
  getItem:k=>store.get(k)??null,
  setItem(k,v){store.set(k,String(v))}
 };
 const simple=visible=>({classList:{contains:k=>k==='show'&&visible}});
 let overlay=null,activated=null;
 for(const value of ['with','without'])buttons[value]={
  dataset:{musicChoice:value},handlers:{},focus(){},
  addEventListener(n,f){this.handlers[n]=f}
 };
 const body={children:[],classList:{add(){},remove(){}},appendChild(node){node.isConnected=true;this.children.push(node);overlay=node}};
 const document={
  body,activeElement:null,readyState:'loading',
  getElementById:id=>id==='nameModal'?simple(nameVisible):id==='welcomeScreen'?simple(welcomeVisible):null,
  createElement(){return{
   isConnected:false,innerHTML:'',setAttribute(){},remove(){this.isConnected=false;overlay=null},
   querySelectorAll:k=>k==='[data-music-choice]'?Object.values(buttons):[],
   querySelector:()=>buttons.with,contains:t=>Object.values(buttons).includes(t),
   focus(){}
  }},
  addEventListener(n,f){listeners[n]=f},removeEventListener(n){delete listeners[n]},
  dispatchEvent(e){activated=e.detail}
 };
 const window={addEventListener(){},__8apdfBackgroundAudio:{acceptChoice(v){activated={enabled:v}}}};
 const ctx={document,window,localStorage,sessionStorage:{getItem(){return null},setItem(){}},
  MutationObserver:class{observe(){} disconnect(){}},CustomEvent:class{constructor(n,o){this.detail=o.detail}}};
 vm.runInNewContext(source,ctx);
 return {store,document,window,buttons,api:window.__8apdfMusicConsent,
   get overlay(){return overlay},get activated(){return activated}};
}
const store=new Map();
let f=consentFixture(store,true,false);
assert.equal(f.api.request(),false,'Name screen must precede music choice');
f=consentFixture(store,false,true);
assert.equal(f.api.request(),false,'Returning-user welcome must finish first');
f=consentFixture(store,false,false);
assert.equal(f.api.request(),true,'First-ever visitor must choose music');
assert.ok(f.overlay,'Full-screen step must exist');
assert.match(f.overlay.innerHTML,/With Music/);
assert.match(f.overlay.innerHTML,/No Music/);
assert.match(f.overlay.innerHTML,/Would you like to enable background music/);
f.buttons.with.handlers.click();
assert.equal(store.get('8apdf_music_choice_v1'),'with');
assert.equal(f.overlay,null);
assert.equal(f.activated.enabled,true);
f=consentFixture(store);
assert.equal(f.api.request(),false,'A completed choice must never reappear');
store.clear();
f=consentFixture(store);f.api.request();f.buttons.without.handlers.click();
assert.equal(store.get('8apdf_music_choice_v1'),'without');
assert.equal(f.activated.enabled,false);
f=consentFixture(store);assert.equal(f.api.request(),false,'No Music persists over reload');

function bgFixture(store){
 const elements=new Map(),audio={src:'',volume:0,loop:false,style:{},listeners:{},plays:0,paused:true,
  addEventListener(n,f){this.listeners[n]=f},setAttribute(){},load(){},
  pause(){this.paused=true;this.listeners.pause?.()},
  play(){this.plays++;this.paused=false;this.listeners.playing?.();return Promise.resolve()},
  fire(n){this.listeners[n]?.()}
 };
 const elem=id=>{
  if(!elements.has(id))elements.set(id,{
   checked:false,disabled:false,textContent:'',innerHTML:'',value:'',
   listeners:{},addEventListener(n,f){this.listeners[n]=f}
  });return elements.get(id)
 };
 const doc={readyState:'complete',getElementById:elem,
  createElement:name=>name==='audio'?audio:elem('style'),head:{appendChild(){}},
  body:{appendChild(){}},addEventListener(){}};
 const window={addEventListener(){}};
 vm.runInNewContext(bgm,{document:doc,window,localStorage:{
  getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,String(v))}
 },sessionStorage:{getItem(){return null},setItem(){}},console,Promise});
 return {api:window.__8apdfBackgroundAudio,audio,elem};
}
store.clear();
store.set('8apdf_background_music_v1',JSON.stringify({enabled:true,volume:93,selectedTracks:['tum-hi-ho','khairiyat','saiyaara']}));
let b=bgFixture(store);
assert.equal(b.api.getState().enabled,false,'Old saved music ON must not bypass consent');
assert.equal(b.api.getState().consent,null);
assert.equal(b.audio.plays,0);
b.api.play();assert.equal(b.audio.plays,0,'A programmatic call cannot bypass first-time consent');
store.set('8apdf_music_choice_v1','without');
b.api.acceptChoice(false);
assert.equal(b.audio.plays,0,'No Music means no autoplay');
b.api.play();assert.equal(b.audio.plays,0);
b=bgFixture(store);
assert.equal(b.api.getState().enabled,false,'No Music must survive reload');
b.api.acceptChoice(true);
assert.equal(b.audio.plays,0,'Spoofed enable cannot change an explicit No Music decision');
store.set('8apdf_music_choice_v1','with');
b.api.acceptChoice(true);
assert.equal(b.api.getState().enabled,true);
assert.equal(b.audio.plays,1,'Choosing With Music is a direct interaction that can play music');
assert.equal(b.audio.src,'/assets/bgm/tum-hi-ho.mp3');
b.audio.fire('ended');
assert.equal(b.audio.src,'/assets/bgm/khairiyat.mp3');
b.audio.fire('ended');
assert.equal(b.audio.src,'/assets/bgm/saiyaara.mp3');
assert.deepEqual(Array.from(b.api.getState().tracks.map(t=>t.id)),['tum-hi-ho','khairiyat','saiyaara']);
b.elem('eightapdfBgmToggle').listeners.change({target:{checked:false}});
assert.equal(store.get('8apdf_music_choice_v1'),'without');
assert.equal(b.api.getState().enabled,false);
b.api.resetDefaults?.();
assert.equal(b.api.getState().enabled,false);
b.elem('eightapdfBgmToggle').listeners.change({target:{checked:true}});
assert.equal(store.get('8apdf_music_choice_v1'),'with');
assert.equal(b.api.getState().enabled,true);
for(const file of ['index.html','classic.html']){
 const html=fs.readFileSync(file,'utf8');
 assert.match(html,/src="\/music-choice\.js\?v=1"/);
 assert.match(html,/href="\/music-choice\.css\?v=1"/);
 assert.match(html,/window\.__8apdfMusicConsent\?\.request/);
}
const oldWidget=fs.readFileSync('music-player.html','utf8');
assert.doesNotMatch(oldWidget,/elfsightcdn\.com|elfsight-app-|music-autostart/);
console.log('PASS required one-time music choice, name-first order, silence persistence, settings override, and 3 local tracks');
