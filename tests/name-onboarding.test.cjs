const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('name-onboarding.js', 'utf8');
const marker = '8apdf_premium_name_onboarding_v1';
function fixture(saved = {}, blocked = []) {
  const nodes = {};
  const node = id => nodes[id] ||= {
    value:'', dataset:{}, attrs:{}, handlers:{}, inert:false,
    classList:{add(){}, remove(){}},
    setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];},
    addEventListener(k,v){this.handlers[k]=v;}, removeEventListener(){},
    querySelector(sel){return node(sel);}, querySelectorAll(){return [node('nameInput'),node('button')];},
    focus(){document.activeElement=this;}
  };
  const document = {getElementById:node, documentElement:{dataset:{}},body:node('body'),addEventListener(){},removeEventListener(){}};
  document.activeElement=document.body;
  document.body.children=[node('main'),node('nameModal')];
  const local = new Map(Object.entries(saved)), session = new Map();
  const storage = (kind, map) => ({getItem(k){if(blocked.includes(kind))throw Error('blocked');return map.get(k)||null;},setItem(k,v){if(blocked.includes(kind))throw Error('blocked');map.set(k,v);}});
  const window={localStorage:storage('local',local),sessionStorage:storage('session',session)};
  const timers=[];let confirmations=0,finished=0;
  vm.runInNewContext(source,{window,localStorage:window.localStorage,sessionStorage:window.sessionStorage,document,MutationObserver:class{observe(){} disconnect(){}},matchMedia:()=>({matches:false}),setTimeout:fn=>timers.push(fn)});
  const opened=window.initNameOnboarding({onConfirm(){confirmations++;},onFinish(){finished++;}});
  return {nodes,local,session,opened,submit(value){node('nameInput').value=value;node('nameForm').handlers.submit({preventDefault(){}});},flush(){while(timers.length)timers.shift()();},get confirmations(){return confirmations;},get finished(){return finished;}};
}
let f=fixture();assert(f.opened);assert(!f.local.has(marker));
f.submit('   ');assert.equal(f.confirmations,0);assert.equal(f.nodes.nameInput.attrs['aria-invalid'],'true');assert(!f.local.has(marker));
f.submit('  अनन्या  李  ');assert.equal(f.local.get('eightapdf_user_name_v2'),'अनन्या  李');assert.equal(f.local.get(marker),'complete');
f.submit('Other');assert.equal(f.confirmations,1);f.flush();assert.equal(f.finished,1);assert(!f.nodes.main.inert);assert.equal(f.nodes.nameModal.attrs['aria-hidden'],'true');
for(const key of ['eightapdf_user_name','eightapdf_user_name_v2']){
 f=fixture({[key]:'Student',unrelated:'keep'});assert(f.opened);assert.equal(f.nodes.nameInput.value,'Student');assert(!f.local.has(marker));f.submit('Edited');assert.equal(f.local.get(key),'Edited');assert.equal(f.local.get('unrelated'),'keep');
}
f=fixture({[marker]:'complete'});assert(f.opened);assert.equal(f.nodes.nameInput.value,'');
f=fixture({[marker]:'complete','eightapdf_user_name_v2':'Kanish'});assert(!f.opened);
f=fixture({},['local']);f.submit('Name');assert.equal(f.session.get(marker),'complete');f.flush();assert.equal(f.finished,1);
f=fixture({},['local','session']);f.submit('<img onerror=alert(1)>');assert.equal(f.nodes.nameWelcomeTitle.textContent,'Welcome, <img onerror=alert(1)>.');f.flush();assert.equal(f.finished,1);
const removedAccountMarkers=['account-sync.js','account-ui.css','__8apdfAccount','__8apdfFinishAccountOnboarding','ap-onboard-google','ap-onboard-guest'];
assert(!source.includes('__8apdfFinishAccountOnboarding'),'Name-only onboarding must finish without an account step');
for(const file of ['index.html','classic.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const removed of removedAccountMarkers)assert(!html.includes(removed),`${file} still references removed Google account UI: ${removed}`);assert((file==='index.html'?fs.readFileSync('features/app-core.js','utf8'):html).includes('window.initNameOnboarding('));assert(!html.includes('function openOriginalName()'));assert(html.includes('aria-modal="true"'));assert(html.includes('for="nameInput"'));
}
console.log('PASS name-only onboarding: Unicode, returning user, safe text, storage fallbacks');
