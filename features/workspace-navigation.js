(()=>{'use strict';
const byId=id=>document.getElementById(id);
const chatLayer=byId('pdfAiLayer'),chatInput=byId('pdfAiInput'),chatFeed=byId('pdfAiFeed'),nav=byId('pdfAiNav');
const localKey='8apdf_ai_pdf_recent_queries_v1';
function readRecent(){try{const data=JSON.parse(localStorage.getItem(localKey)||'[]');return Array.isArray(data)?data.filter(x=>typeof x==='string').slice(0,7):[]}catch{return []}}
function saveRecent(value){try{const text=String(value||'').trim().slice(0,120);if(!text)return;const list=[text,...readRecent().filter(x=>x.toLowerCase()!==text.toLowerCase())].slice(0,7);localStorage.setItem(localKey,JSON.stringify(list));renderRecent()}catch{}}
function submitPrompt(prompt){chatInput.value=prompt;chatLayer.classList.remove('ai-nav-expanded');byId('pdfAiNavToggle').setAttribute('aria-expanded','false');byId('pdfAiForm').requestSubmit()}
function renderRecent(){const el=byId('pdfAiRecent');if(!el)return;const arr=readRecent();el.replaceChildren();if(!arr.length){const p=document.createElement('p');p.className='ai-nav-placeholder';p.textContent='Your recent searches will appear here.';el.append(p);return}
for(const q of arr){const b=document.createElement('button');b.type='button';b.title=q;b.textContent='⌕  '+q;b.addEventListener('click',()=>submitPrompt(q));el.append(b)}}
renderRecent();
byId('pdfAiForm').addEventListener('submit',()=>saveRecent(chatInput.value),{capture:true});
byId('pdfAiBack').addEventListener('click',()=>byId('pdfAiClose').click());
byId('pdfAiFocusInput').addEventListener('click',()=>{chatLayer.classList.remove('ai-nav-expanded');chatInput.focus()});
byId('pdfAiNewChat').addEventListener('click',()=>{
 chatFeed.querySelectorAll(':scope > .pdf-ai-message').forEach(m=>m.remove());
 const first=byId('pdfAiWelcome');if(first)first.hidden=false;
 chatFeed.scrollTop=0;chatInput.value='';chatLayer.classList.remove('ai-nav-expanded');
 chatInput.focus();
});
byId('pdfAiOpenSettings').addEventListener('click',()=>{chatLayer.classList.remove('ai-nav-expanded');byId('settingsBtn').click()});
byId('pdfAiNavToggle').addEventListener('click',()=>{const open=chatLayer.classList.toggle('ai-nav-expanded');byId('pdfAiNavToggle').setAttribute('aria-expanded',String(open))});
byId('pdfAiClose').addEventListener('click',()=>chatLayer.classList.remove('ai-nav-expanded'));
// Reuse existing live settings controls and persistence, just organize into responsive full-page categories.
const panel=byId('settingsPanel'),body=panel?.querySelector('.setting-body');
if(panel&&body){
 const names={
 general:['General','Choose your default workspace, navigation and everyday layout.'],
 appearance:['Appearance','Personalize the complete website color palette.'],
 glass:['Liquid Glass','Control glass depth, ambient light and fluid motion.'],
 interface:['Interface & Layout','Fine-tune typography, spacing, shape and animations.'],
 study:['Study Experience','Personal productivity tools and focus preferences.'],
 accessibility:['Accessibility','Comfortable reading, text sizes and motion controls.'],
 music:['Music','Select one song on loop or play three in order; adjust volume or pause.']};
 const groups=[...body.children].filter(x=>x.classList?.contains('setting-group'));
 // Existing groups in original page order; never remove or recreate any input or listener.
 const categories=['general','general','glass','glass','appearance','appearance','general','interface','study','accessibility','interface','interface','music'];
 if(groups.length===categories.length){groups.forEach((g,i)=>{g.dataset.settingsCategory=categories[i]});
   function pick(page){if(!names[page])return;for(const g of groups)g.hidden=(g.dataset.settingsCategory!==page);
     panel.querySelectorAll('[data-settings-page]').forEach(b=>{const active=b.dataset.settingsPage===page;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
     byId('settingsPageTitle').textContent=names[page][0];byId('settingsPageSubtitle').textContent=names[page][1];body.scrollTop=0;
   }
   panel.querySelectorAll('[data-settings-page]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.settingsPage)));
   pick('general');
 }else{console.warn('8aPDF settings grouping changed; showing original controls safely.');}
 byId('settingsBack').addEventListener('click',()=>byId('closeSettings').click());
}
})();
