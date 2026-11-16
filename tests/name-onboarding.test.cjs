/* 8aPDF regression tests: optional, anonymous and accessible name entry. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('name-onboarding.js','utf8');
const NAME='8apdf_crimson_fresh_name_v20261115',GUEST='8apdf_guest_browse_v1';
function fixture(initial={},blocked=[]){
 const local=new Map(Object.entries(initial)),session=new Map(),nodes={};
 const get=id=>nodes[id]||=(()=>{
  const classes=new Set(),events={};
  return {id,dataset:{},value:'',readOnly:false,disabled:false,inert:false,isConnected:true,attrs:{},events,
   classList:{add(...a){a.forEach(x=>classes.add(x))},remove(...a){a.forEach(x=>classes.delete(x))},
    contains(x){return classes.has(x)}},
   setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
   addEventListener(k,v){events[k]=v},removeEventListener(k){delete events[k]},
   querySelector(sel){return sel==='[type="submit"]'?get('button'):get(sel)},
   querySelectorAll(){return [get('nameInput'),get('button'),get('skipNameOnboarding')]},
   getClientRects(){return [{}]},focus(){document.activeElement=this},
  };
 })();
 get('nameForm').querySelector=sel=>sel==='[type="submit"]'?get('button'):get(sel);
 get('button').querySelector=()=>get('buttonLabel');
 const listeners={};
 const document={
  body:get('body'),documentElement:{dataset:{entryPending:'name'}},activeElement:get('body'),
  getElementById:get,dispatchEvent(){},addEventListener(k,v){listeners[k]=v},
  removeEventListener(k){delete listeners[k]}
 };
 document.body.children=[get('main'),get('nameModal'),get('panel')];
 get('panel').inert=true;
 const storage=(kind,map)=>({
  getItem(k){if(blocked.includes(kind))throw Error('blocked');return map.get(k)??null},
  setItem(k,v){if(blocked.includes(kind))throw Error('blocked');map.set(k,String(v))},
  removeItem(k){if(blocked.includes(kind))throw Error('blocked');map.delete(k)}
 });
 const timers=[],window={
  localStorage:storage('local',local),sessionStorage:storage('session',session),
  setTimeout(fn){timers.push(fn)},matchMedia(){return {matches:false}}
 };
 let confirmed=0,done=[];
 vm.runInNewContext(source,{window,document,MutationObserver:class{observe(){}disconnect(){}},
  Event:class{constructor(type){this.type=type}}});
 const opened=window.initNameOnboarding({onConfirm(){confirmed++},onFinish(data){done.push(data)}});
 return {window,document,local,session,nodes,opened,
  flush(){let safety=40;while(timers.length&&safety--)timers.shift()();assert(safety>0)},
  input(name){get('nameInput').value=name;get('nameInput').events.input?.()},
  submit(){get('nameForm').events.submit?.({preventDefault(){}})},
  skip(){get('skipNameOnboarding').events.click?.()},
  get confirmed(){return confirmed},get done(){return done}
 };
}
let f=fixture();assert.equal(f.opened,true);
f.skip();f.flush();
assert.equal(f.local.get(GUEST),'1');
assert.equal(f.local.get(NAME),undefined,'Guest must not be a named completed profile');
assert.equal(f.confirmed,0);
assert.equal(f.done.length,1);assert.equal(f.done[0].skipped,true);
assert.equal(f.nodes.main.inert,false);assert.equal(f.nodes.panel.inert,true);
assert.equal(f.nodes.nameModal.attrs['aria-hidden'],'true');
assert.equal(f.document.documentElement.dataset.entryPending,undefined);
assert.equal(f.nodes.body.classList.contains('locked'),false);
f=fixture({[GUEST]:'1'});assert.equal(f.opened,false,'Guest persists without reopen');
f=fixture();f.input('   ');f.submit();
assert.equal(f.nodes.nameInput.attrs['aria-invalid'],'true');
f.input('  ਅਨਨਿਆ  ');f.submit();f.flush();
assert.equal(f.confirmed,1);
assert.equal(f.local.get(NAME),'complete');
assert.equal(f.local.get('eightapdf_user_name_v2'),'ਅਨਨਿਆ');
assert.equal(f.done[0].skipped,false);
f=fixture({[NAME]:'complete','eightapdf_user_name_v2':'Kanish'});assert.equal(f.opened,false);
f=fixture({},['local']);f.skip();f.flush();
assert.equal(f.session.get(GUEST),'1','Session fallback works');
f=fixture({},['local','session']);f.skip();f.flush();
assert.equal(f.window.__8apdfGuest.isGuest(),true,'In-memory guest works when storage blocked');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/8apdf_guest_browse_v1/,'Early first paint checks guest');
assert.match(html,/id="skipNameOnboarding"/);
assert.match(html,/id="nameInput"/);
assert.match(html,/onboarding-optional\.css/);
console.log('PASS optional name entry, guest state, storage fallback, focus/lock cleanup, reload and first-paint guard');
