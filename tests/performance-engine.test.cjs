/* Keep the modularized 8aPDF homepage visually identical and boot-safe. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const modules=[
 ['8apdf-experience-script','features/study-experience.js'],
 ['8apdf-studio-ui-controller','features/studio-controls.js'],
 ['8apdf-sidebar-toggle-controller','features/sidebar-toggle.js'],
 ['8apdf-chatbot-client','features/ai-chat-client.js'],
 ['8apdf-workspace-navigation','features/workspace-navigation.js'],
 ['8apdf-page-router','features/page-router.js'],
 ['8apdf-mobile-ai-viewport-controller','features/mobile-ai-viewport.js'],
 ['8apdf-school-planner','features/school-planner.js']
];
let last=-1;
for(const [id,path] of modules){
 const tag='<script id="'+id+'" defer src="/'+path+'?v=performance-20261030"></script>';
 const pos=html.indexOf(tag);
 assert(pos>last,'Feature order or defer tag changed: '+path);
 last=pos;
 assert(fs.statSync(path).size>100,'Missing feature logic: '+path);
 new vm.Script(fs.readFileSync(path,'utf8'),{filename:path});
}
const styles=[
 ['8apdf-experience-style','features/study-experience.css'],
 ['8apdf-sidebar-toggle-polish','features/sidebar-polish.css'],
 ['8apdf-about-automation-style','features/about-automation.css'],
 ['8apdf-mobile-ai-keyboard-repair','features/mobile-ai-keyboard.css'],
 ['8apdf-sidebar-subjects-premium','features/sidebar-subjects.css'],
 ['8apdf-full-todo-premium','features/study-todo.css']
];
for(const [id,path] of styles){
 assert(html.includes('href="/performance-home.css?v=20261030v2"') && fs.readFileSync('performance-home.css','utf8').includes(path),'Bundled feature CSS missing: '+path);
 assert(fs.statSync(path).size>500,'Extracted CSS is empty: '+path);
}
assert(html.includes('id="8apdf-first-paint-guard"'),'First-paint cover missing');
assert(html.includes("dataset.entryPending=known?'welcome':'name'"),'Welcome vs name must be decided before paint');
assert(html.indexOf('id="8apdf-ui-early"')<html.indexOf('<body>'),'Startup guard must be in document head');
assert(html.indexOf('id="8apdf-welcome-first-paint"')<html.indexOf('id="nameModal"'),'Welcome must be initialized before name onboarding markup');
assert(html.includes('delete document.documentElement.dataset.entryPending;'),'Early screen must release after startup');
assert(html.includes('if(now-lastFrame<cadence()){scheduleFrame();return}'),'Glow uses adaptive scheduling');
assert(html.length<170000,'HTML should stay lean following stylesheet bundling');
const worker=fs.readFileSync('sw.js','utf8');
new vm.Script(worker,{filename:'sw.js'});
assert(worker.includes("request.mode==='navigate'"),'Never cache HTML navigation');
assert(worker.includes("url.pathname.startsWith('/api/')"),'Never cache APIs');
assert(worker.includes("url.searchParams.has('v')"),'Cache only explicitly versioned assets');
const callback={};const self={location:{origin:'https://www.8apdf.me'},addEventListener:(type,fn)=>callback[type]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}};
vm.runInNewContext(worker,{self,URL,fetch:()=>Promise.resolve({ok:true,type:'basic',clone(){return this}})});
for(const url of ['https://www.8apdf.me/','https://www.8apdf.me/api/materials','https://www.8apdf.me/sw.js','https://other.site/file.js?v=1','https://www.8apdf.me/file.pdf?v=1']){
 let invoked=false;
 callback.fetch({request:{method:'GET',mode:url.endsWith('/')?'navigate':'cors',url},respondWith(){invoked=true}});
 assert.equal(invoked,false,'Private or non-static requests cannot be SW-cached: '+url);
}
assert(html.includes('features/static-cache-register.js'),'Idle cache registration missing');
assert(!fs.readFileSync('features/static-cache-register.js','utf8').includes('Notification.requestPermission'),'Static cache must not request push notifications');
console.log('PASS modular scripts, CSS parity, instant onboarding cover, adaptive animation and safe static cache');
