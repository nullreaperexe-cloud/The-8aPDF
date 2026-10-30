// Production 8aPDF interface. Appearance settings, selected timetable day and personal notes stay on this device.
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ico=n=>`<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validURL=s=>{try{let u=new URL(s);return /^https?:$/.test(u.protocol)}catch{return false}};
const store={get(k,fall){try{const v=localStorage.getItem(k);return v===null?fall:JSON.parse(v)}catch{return fall}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const fmtDate=v=>{try{const ms=dateMs(v);return ms?new Date(ms).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}):''}catch{return ''}};
const today=new Date();$('#year').textContent=today.getFullYear();
// The offline placeholders below are based on the website screenshot provided in this chat,
// and are never passed off as a fresh Firestore sync. Real document URLs load from the Supabase materials table.
const previewDocuments=[{"id": "archived-0", "subject": "Hindi", "title": "पाठ मत बांधो कविता के प्रश्न उत्तर की पीडीएफ को संलग्न किया गया है।", "description": "पाठ मत बांधो कविता के प्रश्न उत्तर की पीडीएफ को संलग्न किया गया है।", "createdAt": "Oct 8, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/59bc32da221747bd853a3deea5e4f609.pdf", "order": 0}, {"id": "archived-1", "subject": "Punjabi", "title": "ਪਾਠ - ਮਾਂ ਦਾ ਸਾਰ ਲਿਖਵਾਇਆ ਗਿਆ।", "description": "ਪਾਠ - ਮਾਂ ਦਾ ਸਾਰ ਲਿਖਵਾਇਆ ਗਿਆ।", "createdAt": "Oct 8, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/18338abc46ab4f2682a454668d82d4eb.pdf", "order": 1}, {"id": "archived-2", "subject": "Computer", "title": "Read chapter 5 - Decorate the Term 2 in Computer Notebook and bring on day 5. Write Programs from the given PDF in", "description": "Read chapter 5 - Decorate the Term 2 in Computer Notebook and bring on day 5. Write Programs from the given PDF in", "createdAt": "Oct 8, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/c30018ded7334d1a9cb854fa8bc77169.pdf", "order": 2}, {"id": "archived-3", "subject": "English", "title": "Question answers of chapter 15 were completed (PDF attached)", "description": "Question answers of chapter 15 were completed (PDF attached)", "createdAt": "Oct 7, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/4bacf78a7b3b448d84930a043e5f5527.pdf", "order": 3}, {"id": "archived-4", "subject": "Science", "title": "notes of chapter 3", "description": "notes of chapter 3", "createdAt": "Oct 6, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/8e668c7338b64686aab8c0c66765fb01.pdf", "order": 4}, {"id": "archived-5", "subject": "Computer", "title": "Read chapter 5 - Decorate the Term 2 in Computer Notebook and bring on day 3. Write Programs from the given PDF in", "description": "Read chapter 5 - Decorate the Term 2 in Computer Notebook and bring on day 3. Write Programs from the given PDF in", "createdAt": "Oct 6, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/f61ae28ad4e74704b3bf7e5fee224840.pdf", "order": 5}, {"id": "archived-6", "subject": "Hindi", "title": "कक्षा पुनरावृत्ति पीडीएफ संलग्न की गई हैं। पाठ 7 का वाचन करें", "description": "कक्षा पुनरावृत्ति पीडीएफ संलग्न की गई हैं। पाठ 7 का वाचन करें", "createdAt": "Oct 6, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/5def79600911436d83dca42207f0931c.pdf", "order": 6}, {"id": "archived-7", "subject": "Punjabi", "title": "ਪਾਠ 10 ਮਾ ਪੜ੍ਹਾਇਆ ਗਿਆ।", "description": "ਪਾਠ 10 ਮਾ ਪੜ੍ਹਾਇਆ ਗਿਆ।", "createdAt": "Oct 6, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/a685ea1470684702979b6d10f16b2e5a.pdf", "order": 7}, {"id": "archived-8", "subject": "Circular", "title": "– Regarding Punctual Arrival", "description": "– Regarding Punctual Arrival", "createdAt": "Oct 6, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/27035faf909d43c9adace8a7b10bc25c.pdf", "order": 8}, {"id": "archived-9", "subject": "English", "title": "Exercises of Prepositions were completed today. (PDF attached)", "description": "Exercises of Prepositions were completed today. (PDF attached)", "createdAt": "Oct 5, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/f6d49a3eaaa444fb85e4971a438b8ddf.pdf", "order": 9}, {"id": "archived-10", "subject": "Hindi", "title": "Bring your Hindi test notebook for ch-6 tomorrow (6.10.26)", "description": "Bring your Hindi test notebook for ch-6 tomorrow (6.10.26)", "createdAt": "Oct 5, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/50740d87d9184e938215d41bcca4a7f8.pdf", "order": 10}, {"id": "archived-11", "subject": "Social Science", "title": "Geography - find the attached PDF of the Q/Ans of Ch 1 - as done in the class. Note - Notebook submission will be on", "description": "Geography - find the attached PDF of the Q/Ans of Ch 1 - as done in the class. Note - Notebook submission will be on", "createdAt": "Oct 5, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/da8a69ed461143809500c777241daa30.pdf", "order": 11}, {"id": "archived-12", "subject": "Art", "title": "NO BAG DAY (Classes III to VIII)", "description": "NO BAG DAY (Classes III to VIII)", "createdAt": "Oct 3, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/fa3a1eae04f541d4abfd9092f73f08ea.pdf", "order": 12}, {"id": "archived-13", "subject": "Punjabi", "title": "ਕਿਰਿਆ ਅਤੇ ਕਾਲ ਦੀਆਂ ਕਿਸਮਾਂ ਕਰਵਾਈਆਂ ਗਈਆਂ।", "description": "ਕਿਰਿਆ ਅਤੇ ਕਾਲ ਦੀਆਂ ਕਿਸਮਾਂ ਕਰਵਾਈਆਂ ਗਈਆਂ।", "createdAt": "Oct 3, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/82440f0611b24ac5afaba823400c8ba7.pdf", "order": 13}, {"id": "archived-14", "subject": "English", "title": "Explanation of literature chapter 15 was given through PPT (attached)", "description": "Explanation of literature chapter 15 was given through PPT (attached)", "createdAt": "Oct 3, 2026", "pdfUrl": "https://edusecure.org/ManavMangal88/StudentInfo/Homework/97e170d4ce5b40da916a0de5dfc87276.pdf", "order": 14}];
// Exact transcription of user's updated Class Timetable image (Day 1–Day 6, P0–P8).
// No weekday or period-clock assumption: the source only specifies a rotating Day number.
const timetable=[
  ['—','Science','Science','Hindi','Science (Lab)','Hindi','Computer (Lab)','Punjabi','Drawing'],
  ['—','English','English','Games','Maths','SSP','Social Science','Social Science','Maths'],
  ['—','Science','Science','Hindi','English (Public Speaking)','Hindi','Computer (Lab)','Punjabi','Drawing'],
  ['—','English','English','Games','Maths','Maths (Aptitude)','Social Science','Social Science','Maths'],
  ['—','Science','Science','Hindi (G)','English (Library)','Hindi (G)','Computer','Punjabi (G)','Drawing'],
  ['—','English','English','Games','Maths','Maths (Lab)','Social Science','Social Science','Maths']
];
let selectedSchoolDay=Number(store.get('8apdf_selected_school_day_v1',1));
if(!Number.isInteger(selectedSchoolDay)||selectedSchoolDay<1||selectedSchoolDay>6)selectedSchoolDay=1;
$('#daySelect').value=String(selectedSchoolDay);
$('#daySelect').onchange=e=>{selectedSchoolDay=Number(e.target.value);store.set('8apdf_selected_school_day_v1',selectedSchoolDay);renderTimetable()};
const cats=['All','Tests','Exams','Homework','Assignments','Projects','Important','Events','Holidays','Timetable','Results','Activities','Competitions','General'];
const existingUserName=()=>{try{return localStorage.getItem('eightapdf_user_name_v2')||localStorage.getItem('eightapdf_user_name')||'Student'}catch{return 'Student'}};
const previewMode=location.protocol==='file:'||location.protocol==='about:';
const TERM_BOUNDARY='2026-09-28'; // 28 Sep inclusive in Term 1; 29 Sep begins Term 2.
// Start on All PDFs; old Term 2 preference must not hide migrated records.
const storedTerm=store.get('8apdf_term_choice_v3',null);
const defaultTerm=['all','term1','term2','undated'].includes(storedTerm)?storedTerm:'all';
const state={materials:previewMode?previewDocuments:[],live:false,error:false,filter:'All Subjects',term:defaultTerm,query:'',sort:'new',visible:12,announcements:[],annCategory:'All',annVisible:9,annLoading:false,annReady:false,saved:store.get('8apdf_saved_v1',[]),recent:store.get('8apdf_recent_v1',[]),tasks:store.get('8apdf_tasks_v1',[]),name:existingUserName()};
const defaults={theme:'pure-black',density:'comfortable',layout:'grid',sidebar:false,reading:false,motion:false,large:false,contrast:false,fontSize:100,customColor:'#7364cf',customMode:'dark',customStrength:65,glass:true,glassIntensity:100,glassMotion:true,glow:true,glowIntensity:100,glowSize:840,glowSpeed:100,glowCursor:true,glowScroll:true,glowIdle:true,glowColorMode:'theme',glowCustomColor:'#e9e9e9',cornerRadius:36,animationSpeed:3,fontChoice:'modern',showActions:true,showSuggestions:true,stickyNav:true};
let settings={...defaults,...store.get('8apdf_classic_glass_settings_v2',{})};
// One-time upgrade: match the approved Radiant default on this device without discarding other preferences.
if(!store.get('8apdf_radiant_default_migrated_v1',false)){
 Object.assign(settings,{glow:true,glowIntensity:100,glowSize:840,glowSpeed:100,glowCursor:true,glowScroll:true,glowIdle:true,glowColorMode:'theme',glass:true,glassIntensity:100,glassMotion:true});
 store.set('8apdf_classic_glass_settings_v2',settings);
 store.set('8apdf_radiant_default_migrated_v1',true);
}
// 6 neutral five-color palettes + 12 color families × 6 combinations = EXACTLY 78 themes.
// Every theme has five independently defined palette anchors:
// [page background, surface, readable text, action, highlight].
const monoThemes=[
 {id:'dark',name:'Neutral Night',type:'mono',tone:'dark',colors:['#101116','#1e1f26','#f5f5f7','#e3e5ea','#9a9da8']},
 {id:'pure-black',name:'Pure Black',type:'mono',tone:'dark',colors:['#000000','#161616','#ffffff','#e5e5e5','#8b8b8b']},
 {id:'graphite',name:'Graphite',type:'mono',tone:'dark',colors:['#11151c','#252b35','#f2f6fa','#bfd1df','#8092a3']},
 {id:'light',name:'Light',type:'mono',tone:'light',colors:['#ffffff','#f2f4f7','#171b23','#344251','#9cabbc']},
 {id:'paper',name:'Warm Paper',type:'mono',tone:'light',colors:['#fbf7ed','#f0e8da','#242a23','#566d52','#adbd9d']},
 {id:'silver',name:'Soft Silver',type:'mono',tone:'light',colors:['#edf1f5','#dee5ed','#222b38','#536780','#abc0d7']}
];
const comboFamilies=[
 ['Emerald Aurora','#3bdfa3','#a2e8c5'],
 ['Sunset Ember','#fb875d','#ffca77'],
 ['Violet Pulse','#a890ff','#6dd4ff'],
 ['Ocean Signal','#4abaf5','#63dac6'],
 ['Rose Quartz','#f68ab1','#c7a2ff'],
 ['Citrus Shift','#e1d65f','#85d5a0'],
 ['Copper Night','#e9a174','#e2c6ae'],
 ['Royal Sapphire','#678cfc','#bca8ff'],
 ['Forest Mint','#54c98a','#afe2a0'],
 ['Crimson Bloom','#ee7897','#f4bb78'],
 ['Peach Lavender','#f0a58f','#a9a1ff'],
 ['Arctic Sky','#77c7e0','#bec5f5']
];
const colorThemeVariants=[
 {key:'midnight',name:'Midnight',type:'dark',tone:'dark'},
 {key:'dusk',name:'Dusk',type:'dark',tone:'dark'},
 {key:'velvet',name:'Velvet',type:'dark',tone:'dark'},
 {key:'daylight',name:'Daylight',type:'light',tone:'light'},
 {key:'mist',name:'Mist',type:'light',tone:'light'},
 {key:'paper',name:'Paper',type:'light',tone:'light'}
];
function ensureHex(value){return /^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():'#181818'}
function rgbOf(hex){let s=ensureHex(hex);return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16))}
function mixHex(a,b,r){const left=rgbOf(a),right=rgbOf(b),ratio=Math.max(0,Math.min(1,r));return '#'+left.map((v,i)=>Math.round(v*(1-ratio)+right[i]*ratio).toString(16).padStart(2,'0')).join('')}
function alphaHex(hex,opacity){return 'rgb('+rgbOf(hex).join(' ')+' / '+opacity+')'}
function luminance(hex){return rgbOf(hex).map(v=>{const s=v/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)}).reduce((acc,v,i)=>acc+v*[.2126,.7152,.0722][i],0)}
function contrastInk(hex){return luminance(hex)>.18?'#000000':'#ffffff'}
function comboColors(primary,highlight,variation){
 const p=ensureHex(primary),h=ensureHex(highlight);
 switch(variation){
  case 'midnight':return [mixHex('#070a11',h,.045),mixHex('#161923',p,.11),'#f6f7fd',p,h];
  case 'dusk':return [mixHex('#17111a',p,.12),mixHex('#29212d',h,.12),'#fff6fc',mixHex(p,'#ffffff',.10),mixHex(h,p,.10)];
  case 'velvet':return [mixHex('#090e16',h,.15),mixHex('#1b1b2a',p,.20),'#f1f5fc',mixHex(p,h,.22),mixHex(h,'#ffffff',.15)];
  case 'daylight':return [mixHex('#fcfdff',p,.10),mixHex('#ffffff',h,.09),'#17212c',mixHex(p,'#101827',.36),mixHex(h,'#17212c',.22)];
  case 'mist':return [mixHex('#f0f4f9',h,.13),mixHex('#ffffff',p,.04),'#17232c',mixHex(p,'#101827',.29),mixHex(h,p,.17)];
  default:return [mixHex('#fdf8ee',h,.09),mixHex('#ffffff',p,.08),'#26242c',mixHex(p,'#211b28',.33),mixHex(h,'#384139',.20)];
 }
}
const colorThemes=comboFamilies.flatMap(([name,primary,highlight],i)=>colorThemeVariants.map(v=>({
 id:'combo-'+i+'-'+v.key,name:name+' '+v.name,type:v.type,tone:v.tone,
 colors:comboColors(primary,highlight,v.key)
})));
const allThemes=[...monoThemes,...colorThemes]; // 6+72 = 78, not 79.
const roleDefs=[
 ['page','Page background','--bg'],
 ['backgroundAlt','Secondary background','--bg-alt'],
 ['surface','Card surfaces','--surface'],
 ['raised','Raised panels','--surface-high'],
 ['soft','Soft panels','--surface-soft'],
 ['text','Main text','--text'],
 ['textSoft','Secondary text','--text-soft'],
 ['muted','Muted text','--muted'],
 ['action','Primary actions','--button'],
 ['accent','Accent & tags','--pill']
];
const paletteVars=['--bg','--bg-alt','--surface','--surface-high','--surface-soft','--surface-glass','--text','--text-soft','--muted','--line','--line-bold','--button','--button-text','--pill','--hover','--shadow','--hero-glow','--primary','--primary-dark'];
function roleColors(t){
 const [background,surface,text,button,highlight]=(t.colors||monoThemes[1].colors).map(ensureHex);
 return {
  page:background,
  backgroundAlt:mixHex(background,surface,.32),
  surface,
  raised:mixHex(surface,text,t.tone==='light'?.025:.085),
  soft:mixHex(background,surface,.68),
  text,
  textSoft:mixHex(text,background,t.tone==='light'?.27:.18),
  muted:mixHex(text,background,t.tone==='light'?.43:.34),
  action:t.tone==='light'?mixHex(button,'#0a0c16',.15):button,
  accent:mixHex(surface,highlight,t.tone==='light'?.28:.32)
 };
}
function paletteFor(t){
 const r=t.roles||roleColors(t);
 return {
 '--bg':r.page,'--bg-alt':r.backgroundAlt,'--surface':r.surface,
 '--surface-high':r.raised,'--surface-soft':r.soft,
 '--surface-glass':alphaHex(r.surface,.95),
 '--text':r.text,'--text-soft':r.textSoft,'--muted':r.muted,
 '--line':alphaHex(r.text,.13),'--line-bold':alphaHex(r.text,.26),
 '--button':r.action,'--button-text':contrastInk(r.action),
 '--pill':r.accent,'--hover':mixHex(r.surface,r.accent,.30),
 '--shadow':'0 18px 56px '+alphaHex(r.page,t.tone==='light'?.15:.42),
 '--hero-glow':alphaHex(r.accent,t.tone==='light'?.16:.19),
 '--primary':r.action,'--primary-dark':mixHex(r.action,r.page,.24)
 };
}
function selectedTheme(){
 if(settings.theme==='personal-mix'){
  const valid=roleDefs.every(([key])=>/^#[0-9a-f]{6}$/i.test(settings.personalColors?.[key]||''));
  if(valid){const roles=Object.fromEntries(roleDefs.map(([key])=>[key,ensureHex(settings.personalColors[key])]));return {id:'personal-mix',name:'My 10-Color Theme',type:'personal',tone:luminance(roles.page)>.32?'light':'dark',colors:[roles.page,roles.surface,roles.text,roles.action,roles.accent],roles}}
 }
 if(settings.theme==='custom'){
  // Keep users' previously saved custom shade functional after the migration.
  const accent=ensureHex(settings.customColor||'#7364cf');
  const light=settings.customMode==='light';
  const colors=comboColors(accent,mixHex(accent,light?'#ffffff':'#7cd2ff',.45),light?'mist':'midnight');
  return {id:'custom',name:'Legacy Custom',type:'personal',tone:light?'light':'dark',colors};
 }
 const known=allThemes.find(t=>t.id===settings.theme);
 if(known)return known;
 const old=String(settings.theme||'').match(/^color-(dark|light)-(\d+)$/);
 if(old){const family=Number(old[2])%comboFamilies.length,variant=old[1]==='light'?'mist':'midnight';return allThemes.find(t=>t.id==='combo-'+family+'-'+variant)||monoThemes[1]}
 return allThemes.find(t=>t.id==='pure-black')||monoThemes[1];
}
function applySitePalette(){
 const t=selectedTheme(),root=document.documentElement;
 root.dataset.theme=t.id;root.dataset.tone=t.tone;root.style.colorScheme=t.tone;
 const values=paletteFor(t);
 paletteVars.forEach(key=>root.style.setProperty(key,values[key]));
 document.querySelector('meta[name="theme-color"]').content=values['--bg'];
 $('#selectedThemeName').textContent=t.name;
}
let activePaletteFilter='all',lastSelectedPreset=allThemes.some(t=>t.id===settings.lastPresetTheme)?settings.lastPresetTheme:(allThemes.some(t=>t.id===settings.theme)?settings.theme:'pure-black');
function renderRoleEditors(){
 const host=$('#themeRoleGrid');if(!host)return;
 const selected=selectedTheme(),colors=selected.roles||roleColors(selected);
 if(!host.children.length){
  host.innerHTML=roleDefs.map(([key,label])=>'<div class="theme-role-field"><input type="color" id="themeRole-'+key+'" data-theme-role="'+key+'" aria-label="'+label+' color"><span class="theme-role-field-text"><label for="themeRole-'+key+'">'+label+'</label><code id="themeRoleHex-'+key+'"></code></span></div>').join('');
 }
 for(const [key] of roleDefs){
  const input=$('#themeRole-'+key),hex=$('#themeRoleHex-'+key);
  if(input&&document.activeElement!==input)input.value=colors[key];
  if(hex)hex.textContent=colors[key].toUpperCase();
 }
 const st=$('#themeRoleState');
 if(st)st.textContent=settings.theme==='personal-mix'?'Personal theme · saved':'10 colors · live changes';
}
function renderPalette(){
 const query=$('#paletteSearch').value.toLowerCase().trim();
 const themes=allThemes.filter(t=>(activePaletteFilter==='all'||t.type===activePaletteFilter)&&(!query||t.name.toLowerCase().includes(query)));
 $('#themeCount').textContent=allThemes.length+' themes';
 $('#themeGrid').innerHTML=themes.length?themes.map(t=>{
  const chips=t.colors.map(c=>'<i style="background:'+c+'"></i>').join('');
  return '<button type="button" class="theme-item '+(settings.theme===t.id?'active':'')+'" data-theme-choice="'+t.id+'" aria-pressed="'+(settings.theme===t.id)+'" title="Apply '+safe(t.name)+' five-color combination"><span class="theme-swatches" aria-hidden="true">'+chips+'</span><span class="theme-name-text">'+safe(t.name)+'</span></button>'
 }).join(''):'<p class="setting-explainer">No matching themes.</p>';
 $$('#paletteFilters [data-palette-filter]').forEach(b=>b.classList.toggle('active',b.dataset.paletteFilter===activePaletteFilter));
 renderRoleEditors();
}
$('#paletteFilters').onclick=e=>{const button=e.target.closest('[data-palette-filter]');if(button){activePaletteFilter=button.dataset.paletteFilter;renderPalette()}};
$('#paletteSearch').oninput=renderPalette;
$('#themeGrid').onclick=e=>{
 const button=e.target.closest('[data-theme-choice]');if(!button)return;
 settings.theme=button.dataset.themeChoice;lastSelectedPreset=settings.theme;settings.lastPresetTheme=settings.theme;setSettings();document.dispatchEvent(new Event('8apdf:palette-customized'));
};
$('#themeRoleGrid').addEventListener('input',e=>{
 const key=e.target.dataset.themeRole;
 if(!roleDefs.some(([role])=>role===key)||!/^#[0-9a-f]{6}$/i.test(e.target.value))return;
 // Start an independent ten-color mix from the current five-color preset.
 if(settings.theme!=='personal-mix'){
  const t=selectedTheme();settings.personalColors={...roleColors(t)};lastSelectedPreset=t.id==='custom'?'pure-black':t.id;settings.lastPresetTheme=lastSelectedPreset;
 }
 settings.personalColors[key]=e.target.value.toLowerCase();
 settings.theme='personal-mix';
 setSettings();document.dispatchEvent(new Event('8apdf:palette-customized'));
});
$('#themeRoleReset').onclick=()=>{
 settings.theme=allThemes.some(t=>t.id===lastSelectedPreset)?lastSelectedPreset:'pure-black';
 delete settings.personalColors;
 setSettings();document.dispatchEvent(new Event('8apdf:palette-customized'));toast('Restored selected five-color preset');
};
function toast(message){let el=document.createElement('div');el.className='toast';el.textContent=message;$('#toastArea').append(el);setTimeout(()=>el.remove(),3600)}
function scrollToSection(sel){const e=$(sel);if(e)e.scrollIntoView({behavior:settings.motion?'auto':'smooth',block:'start'})}

function setLiquidExperience(){
 const root=document.documentElement;
 const v=Math.min(100,Math.max(0,Number(settings.glassIntensity ?? 100)));
 const reduced=settings.motion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 root.dataset.glass=settings.glass?'on':'off';
 root.dataset.fluid=settings.glass && settings.glassMotion && !reduced ? 'on':'off';
 root.style.setProperty('--liquid-blur',(10+Math.round(v*.37))+'px');
 root.style.setProperty('--liquid-saturation',(112+Math.round(v*.95))+'%');
 root.style.setProperty('--liquid-solidity',(91-Math.round(v*.45))+'%');
 root.style.setProperty('--liquid-highlight',(v*.0047).toFixed(3));
 root.style.setProperty('--liquid-sheen',(v*.0028).toFixed(3));
 $('#liquidToggle').checked=!!settings.glass;
 $('#liquidRange').value=v;
 $('#liquidRange').disabled=!settings.glass;
 $('#fluidToggle').checked=!!settings.glassMotion;
 $('#fluidToggle').disabled=!settings.glass;
 $('#liquidValue').textContent=v+'%';
 $$('#liquidPresets [data-glass-preset]').forEach(b=>b.classList.toggle('active',Math.abs(v-Number(b.dataset.glassPreset))<7));
 $('#liquidPresets').style.opacity=settings.glass?'1':'.52';
}
$('#liquidToggle').addEventListener('change',e=>{settings.glass=e.target.checked;setSettings()});
$('#fluidToggle').addEventListener('change',e=>{settings.glassMotion=e.target.checked;setSettings()});
$('#liquidRange').addEventListener('input',e=>{settings.glassIntensity=Number(e.target.value);setSettings()});
$('#liquidPresets').addEventListener('click',e=>{const b=e.target.closest('[data-glass-preset]');if(!b)return;settings.glass=true;settings.glassIntensity=Number(b.dataset.glassPreset);setSettings()});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>setLiquidExperience());


function setPersonalization(){
 const root=document.documentElement;
 settings.glowIntensity=Math.max(0,Math.min(100,Number(settings.glowIntensity??55)));
 settings.glowSize=Math.max(260,Math.min(1100,Number(settings.glowSize??600)));
 settings.glowSpeed=Math.max(10,Math.min(100,Number(settings.glowSpeed??40)));
 root.dataset.glow=settings.glow?'on':'off';
 root.dataset.fontChoice=settings.fontChoice||'modern';
 root.dataset.hideActions=settings.showActions?'off':'on';
 root.dataset.hideSuggestions=settings.showSuggestions?'off':'on';
 root.dataset.stickyNav=settings.stickyNav?'on':'off';
 root.style.setProperty('--glow-opacity',String(settings.glowIntensity/100));
 root.style.setProperty('--glow-size',settings.glowSize+'px');
 root.style.setProperty('--glow-ink',settings.glowColorMode==='custom'?settings.glowCustomColor:'var(--text)');
 root.style.setProperty('--user-radius',settings.cornerRadius+'px');
 root.style.setProperty('--duration',({1:160,2:240,3:420}[settings.animationSpeed]||240)+'ms');
 root.style.setProperty('--fluid-speed',({1:240,2:440,3:650}[settings.animationSpeed]||440)+'ms');
 $('#glowToggle').checked=!!settings.glow;
 for(const [id,val] of [['glowIntensity',settings.glowIntensity],['glowSize',settings.glowSize],['glowSpeed',settings.glowSpeed],['cornerRadius',settings.cornerRadius],['animationSpeed',settings.animationSpeed]])$('#'+id).value=String(val);
 $('#glowIntensityValue').textContent=settings.glowIntensity+'%';
 $('#glowSizeValue').textContent=settings.glowSize+'px';
 $('#glowSpeedValue').textContent=settings.glowSpeed<=30?'Slow':settings.glowSpeed>=70?'Fast':'Normal';
 $('#cornerRadiusValue').textContent=settings.cornerRadius+'px';
 $('#animationSpeedValue').textContent=({1:'Snappy',2:'Balanced',3:'Relaxed'}[settings.animationSpeed]||'Balanced');
 $('#glowCursorToggle').checked=!!settings.glowCursor;
 $('#glowScrollToggle').checked=!!settings.glowScroll;
 $('#glowIdleToggle').checked=!!settings.glowIdle;
 $('#glowColorMode').value=settings.glowColorMode;
 $('#glowCustomColor').value=settings.glowCustomColor;
 $('#glowCustomColorWrap').classList.toggle('visible',settings.glowColorMode==='custom');
 $('#fontChoice').value=settings.fontChoice;
 for(const [id,k] of [['showActionsToggle','showActions'],['showSuggestionsToggle','showSuggestions'],['stickyNavToggle','stickyNav']])$('#'+id).checked=!!settings[k];
 $$('#glowPresets [data-glow-preset]').forEach(b=>b.classList.toggle('active',Math.abs(settings.glowIntensity-Number(b.dataset.glowPreset))<7));
 for(const id of ['glowIntensity','glowSize','glowSpeed','glowCursorToggle','glowScrollToggle','glowIdleToggle','glowColorMode','glowCustomColor'])$('#'+id).disabled=!settings.glow;
}
$('#glowToggle').onchange=e=>{settings.glow=e.target.checked;setSettings();document.dispatchEvent(new Event('8apdf:glow-change'))};
for(const [id,k] of [['glowIntensity','glowIntensity'],['glowSize','glowSize'],['glowSpeed','glowSpeed'],['cornerRadius','cornerRadius'],['animationSpeed','animationSpeed']])$('#'+id).oninput=e=>{settings[k]=Number(e.target.value);setSettings()};
for(const [id,k] of [['glowCursorToggle','glowCursor'],['glowScrollToggle','glowScroll'],['glowIdleToggle','glowIdle'],['showActionsToggle','showActions'],['showSuggestionsToggle','showSuggestions'],['stickyNavToggle','stickyNav']])$('#'+id).onchange=e=>{settings[k]=e.target.checked;setSettings()};
$('#glowColorMode').onchange=e=>{settings.glowColorMode=e.target.value;setSettings()};
$('#glowCustomColor').oninput=e=>{settings.glowCustomColor=e.target.value;setSettings()};
$('#fontChoice').onchange=e=>{settings.fontChoice=e.target.value;setSettings()};
$('#glowPresets').onclick=e=>{const btn=e.target.closest('[data-glow-preset]');if(!btn)return;settings.glow=true;settings.glowIntensity=Number(btn.dataset.glowPreset);setSettings();document.dispatchEvent(new Event('8apdf:glow-change'))};

function setSettings(){
 applySitePalette();setLiquidExperience();setPersonalization();document.documentElement.dataset.density=settings.density;document.documentElement.dataset.layout=settings.layout;document.documentElement.dataset.motion=settings.motion?'off':'on';document.documentElement.dataset.sidebar=settings.sidebar?'on':'off';document.documentElement.dataset.reading=settings.reading?'on':'off';document.documentElement.dataset.contrast=settings.contrast?'high':'normal';document.documentElement.dataset.font=settings.large?'large':'normal';document.documentElement.style.setProperty('--scale',String((settings.fontSize||100)/100*(settings.large?1.05:1)));
 if($('#settingsPanel').classList.contains('open'))renderPalette();$('[data-density-choice]').forEach(el=>el.classList.toggle('active',el.dataset.densityChoice===settings.density));$$('[data-card-choice]').forEach(el=>el.classList.toggle('active',el.dataset.cardChoice===settings.layout));$('#compactToggle').checked=settings.density==='compact';$('#sidebarToggle').checked=settings.sidebar;$('#readingToggle').checked=settings.reading;$('#motionToggle').checked=settings.motion;$('#largeTextToggle').checked=settings.large;$('#contrastToggle').checked=settings.contrast;$('#fontRange').value=settings.fontSize;$('#gridBtn').classList.toggle('active',settings.layout==='grid');$('#listBtn').classList.toggle('active',settings.layout==='list');store.set('8apdf_classic_glass_settings_v2',settings)
}
try{setSettings()}catch(error){console.error('8aPDF appearance setup failed; study library will still start',error)}$('#profileBtn').textContent=state.name[0].toUpperCase();
function openSettings(){closeCommand();$('#settingsPanel').classList.add('open');renderPalette();$('#settingsPanel').setAttribute('aria-hidden','false');$('#drawerMask').classList.add('open')}
function closeSettings(){ $('#settingsPanel').classList.remove('open');$('#settingsPanel').setAttribute('aria-hidden','true');$('#drawerMask').classList.remove('open') }
$('#settingsBtn').onclick=openSettings;$('#closeSettings').onclick=closeSettings;$('#saveSettings').onclick=()=>{closeSettings();toast('Appearance saved on this device')};$('#drawerMask').onclick=closeSettings;$('#resetSettings').onclick=()=>{settings={...defaults};setSettings();toast('Default appearance restored')};
$$('[data-density-choice]').forEach(b=>b.onclick=()=>{settings.density=b.dataset.densityChoice;setSettings()});$$('[data-card-choice]').forEach(b=>b.onclick=()=>{settings.layout=b.dataset.cardChoice;setSettings()});
for(const [id,key] of [['sidebarToggle','sidebar'],['readingToggle','reading'],['motionToggle','motion'],['largeTextToggle','large'],['contrastToggle','contrast']])$('#'+id).onchange=e=>{settings[key]=e.target.checked;setSettings()};
$('#compactToggle').onchange=e=>{settings.density=e.target.checked?'compact':'comfortable';setSettings()};$('#fontRange').oninput=e=>{settings.fontSize=+e.target.value;setSettings()};$('#themeShortcut').onclick=()=>{settings.theme=selectedTheme().tone==='light'?'pure-black':'light';setSettings()};
function closeModal(){$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')}
function showModal(title,html,actions=''){$('#modalTitle').textContent=title;$('#modalContent').innerHTML=html;$('#modalActions').innerHTML=actions;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.classList.add('no-scroll')}
$('#modalClose').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
function showTimetable(){
 const header=['DAY','P0','P1','P2','P3','P4','P5','P6','P7','P8'].map(t=>`<th scope="col">${t}</th>`).join('');
 const rows=timetable.map((periods,i)=>`<tr class="${i+1===selectedSchoolDay?'selected-day':''}"><th scope="row">DAY ${i+1}</th>${periods.map((subject,p)=>`<td class="${p===0?'dash-period':''}">${safe(subject).replace(/ \(([^)]+)\)/g,'<span class="detail">($1)</span>')}</td>`).join('')}</tr>`).join('');
 showModal('Class Timetable — Day 1 to Day 6',`<p class="timetable-help">Your updated six-day rotating school timetable. P0 has no class; choose the current school day from the dashboard.</p><div class="timetable-scroll"><table class="timetable-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div><p class="timetable-help">On smaller screens, swipe horizontally to view all periods. Recess timing has not been specified.</p>`,`<button class="solid" id="timetableDone">Done</button>`);
 $('#timetableDone').onclick=closeModal;document.dispatchEvent(new Event('8apdf:timetable-open'))
}
function renderTimetable(){
 $('#daySelect').value=String(selectedSchoolDay);
 const subjects=timetable[selectedSchoolDay-1];
 $('#todayList').innerHTML=subjects.slice(1,6).map((sub,i)=>`<button class="list-row" data-go="timetable"><span class="timestamp">P${i+1}</span><span class="item-body"><strong>${safe(sub)}</strong><span>Day ${selectedSchoolDay} · Period ${i+1}</span></span></button>`).join('');
}
function keywords(x){return [x.title,x.subject,x.description,x.className||'',x.chapter||'',x.language||'',...(x.tags||[])].join(' ').toLowerCase()}
function sortedDocs(){
 let a=state.materials.filter(x=>(state.term==='all'||termOfPdf(x)===state.term)&&
 (state.filter==='All Subjects'||x.subject.toLowerCase()===state.filter.toLowerCase())&&
 (!state.query||keywords(x).includes(state.query.toLowerCase())));
 const chrono=comparePdfUploads;
 if(state.sort==='old')a.sort((x,y)=>-chrono(x,y));
 else if(state.sort==='az')a.sort((x,y)=>x.title.localeCompare(y.title));
 else if(state.sort==='default')a.sort((x,y)=>x.order-y.order||chrono(x,y));
 else a.sort(chrono);
 return a;
}
function dateMs(v){try{if(v==null||v==='')return 0;
  if(typeof v==='number')return v>1e12?v:v>1e9?v*1000:0;
  if(typeof v==='object'&&v!==null){
    const sec=v.seconds??v._seconds;
    if(sec!==undefined&&Number.isFinite(Number(sec)))
      return Number(sec)*1000+Math.floor(Number(v.nanoseconds??v._nanoseconds??0)/1e6);
  }
  const dt=v?.toDate?v.toDate():new Date(v);
  const ms=dt.getTime();return Number.isFinite(ms)?ms:0;
}catch{return 0}}
function pdfUploadMs(x){return dateMs(x.uploadedAt)||dateMs(x.createdAt)}
function comparePdfUploads(x,y){return pdfUploadMs(y)-pdfUploadMs(x)||
 dateMs(y.createdAt)-dateMs(x.createdAt)||(x.order-y.order)||
 x.title.localeCompare(y.title)||x.id.localeCompare(y.id)}
function pdfDateYMD(v){
 try{
  if(v==null||v==='')return '';
  if(typeof v==='string'){
   const m=v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
   if(m&&(!v.includes('T')&&!v.includes('Z')&&!v.includes('+')))return [m[1],m[2],m[3]].join('-');
  }
  const ms=dateMs(v);if(!ms)return '';
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const lookup=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return lookup.year+'-'+lookup.month+'-'+lookup.day;
 }catch{return ''}
}
function termOfPdf(x){const day=pdfDateYMD(x.createdAt);return !day?'undated':day<=TERM_BOUNDARY?'term1':'term2'}
function termDocuments(){return state.materials.filter(x=>state.term==='all'||termOfPdf(x)===state.term)}
function termTitle(){return state.term==='all'?'All dates':state.term==='term1'?'Term 1':state.term==='term2'?'Term 2':'Undated'}
function renderTermSwitch(){
 const undated=state.materials.filter(x=>termOfPdf(x)==='undated').length;
 const bar=$('#schoolTermBar');if(!bar)return;
 bar.querySelectorAll('[data-school-term]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.schoolTerm===state.term);btn.setAttribute('aria-pressed',String(btn.dataset.schoolTerm===state.term))});
 const unknownButton=bar.querySelector('[data-school-term="undated"]');
 unknownButton.hidden=!undated&&state.term!=='undated';
 $('#termContext').textContent=state.term==='all'?state.materials.length+' PDFs · newest first':state.term==='term1'?'Up to 28 Sep 2026':state.term==='term2'?'From 29 Sep 2026':undated+' PDF(s) without a reliable date';
}
$('#schoolTermBar').addEventListener('click',event=>{
 const button=event.target.closest('[data-school-term]');if(!button)return;
 const newTerm=button.dataset.schoolTerm;if(!['all','term1','term2','undated'].includes(newTerm)||newTerm===state.term)return;
 state.term=newTerm;store.set('8apdf_term_choice_v3',state.term);state.visible=12;state.filter='All Subjects';renderMaterials();
});
function card(x){const saved=state.saved.includes(x.id);return `<article class="pdf-card"><div class="pdf-top"><span class="doc-tile">${ico('file')}</span><span class="tag">${safe(x.subject)}</span><button class="bookmark ${saved?'saved':''}" data-bookmark="${safe(x.id)}" aria-label="${saved?'Remove bookmark':'Save bookmark'}" title="${saved?'Remove bookmark':'Save bookmark'}">${ico('bookmark')}</button></div><h3 title="${safe(x.title)}">${safe(x.title)}</h3><p class="description">${safe(x.description||'Study material from your school library.')}</p><div class="meta-line">${ico('calendar')} ${safe(fmtDate(x.createdAt)||'Date unavailable')}${x.className?' · '+safe(x.className):''}${x.chapter?' · '+safe(x.chapter):''}</div><div class="card-actions"><button class="action" data-pdf="preview" data-id="${safe(x.id)}">${ico('eye')} Preview</button><button class="action primary" data-pdf="download" data-id="${safe(x.id)}">${ico('download')} Download</button><button class="action wide" data-pdf="share" data-id="${safe(x.id)}">${ico('share')} Share</button></div><button class="pdf-summary-utility" data-pdf="summary" data-id="${safe(x.id)}" type="button">✧ Summarize PDF</button></article>`}
function renderSubjectFilters(){const subs=['All Subjects',...new Set(state.materials.map(x=>x.subject).filter(Boolean))].sort((a,b)=>a==='All Subjects'?-1:b==='All Subjects'?1:a.localeCompare(b));$('#subjectFilters').innerHTML=subs.map(v=>'<button class="chip '+(v===state.filter?'active':'')+'" data-subject="'+safe(v)+'">'+safe(v)+'</button>').join('');const sidebar=$('#studioSubjects');if(sidebar)sidebar.innerHTML=subs.map(v=>'<button type="button" class="studio-side-link '+(v===state.filter?'active':'')+'" data-sidebar-subject="'+safe(v)+'"><svg><use href="#i-file"/></svg><span>'+safe(v)+'</span></button>').join('');}
function renderMaterials(){const a=sortedDocs(),shown=a.slice(0,state.visible);renderTermSwitch();$('#pdfGrid').innerHTML=shown.length?shown.map(card).join(''):'<div class="empty">No PDFs match '+termTitle()+' in this '+(state.live?'library':'local preview')+'. '+(state.live?'Try another subject or check Undated PDFs.':'The downloaded preview contains archived October samples; live PDFs sync when hosted.')+'</div>';$('#pdfCount').textContent=state.live?`${termDocuments().length} PDFs · ${termTitle()}`:previewMode?`${termDocuments().length} archived PDFs · ${termTitle()}`:state.error?'Library unavailable':'Loading PDFs…';$('#libraryStatus').innerHTML=`<span class="dot"></span> ${state.live?'Live school library · '+a.length+' '+termTitle()+' matches':previewMode?'Local HTML preview · Real PDFs sync on the hosted website':state.error?'Could not connect to school PDFs. Please refresh.':'Connecting to real school PDFs…'}`;$('#moreWrap').style.display=a.length>state.visible?'block':'none';renderSubjectFilters();renderRecent()}
function normalizeDoc(d){
 const schoolDate=d.source_date||d.date_iso||d.date_display||
  d.raw?.source_date||d.raw?.date_iso||d.raw?.createdAt||d.raw?.date||
  d.created_at||d.createdAt||d.uploaded_at||d.uploadDate||null;
 const uploadedAt=[d.inserted_at,d.uploaded_at,d.uploadedAt,d.uploadDate,
  d.created_at,d.createdAt,d.raw?.uploadedAt,d.raw?.createdAt]
  .find(value=>dateMs(value)>0)||schoolDate;
 return{id:String(d.id??''),title:String(d.title||d.name||'Untitled Material'),
  subject:String(d.subject||d.subject_name||'Other'),
  description:String(d.description||d.summary||''),
  pdfUrl:String(d.pdf_url||d.pdfUrl||d.file_url||d.fileUrl||''),
  className:String(d.class_name||d.className||''),chapter:String(d.chapter||d.chapter_name||''),
  language:String(d.language||''),tags:Array.isArray(d.tags)?d.tags:[],
  order:d.order!=null&&Number.isFinite(Number(d.order))?Number(d.order):Number.MAX_SAFE_INTEGER,
  createdAt:schoolDate,uploadedAt};
}
$('#pdfGrid').onclick=e=>{const bm=e.target.closest('[data-bookmark]');if(bm){let id=bm.dataset.bookmark;state.saved=state.saved.includes(id)?state.saved.filter(v=>v!==id):[...state.saved,id];store.set('8apdf_saved_v1',state.saved);renderMaterials();toast(state.saved.includes(id)?'Saved to bookmarks':'Removed from bookmarks');return}let btn=e.target.closest('[data-pdf]');if(!btn)return;const x=state.materials.find(i=>i.id===btn.dataset.id);if(!x)return;pdfAction(x,btn.dataset.pdf)};
function rememberRecent(x){state.recent=[x.id,...state.recent.filter(id=>id!==x.id)].slice(0,20);store.set('8apdf_recent_v1',state.recent);renderRecent();document.dispatchEvent(new Event('8apdf:document-opened'))}
async function pdfAction(x,what){if(!validURL(x.pdfUrl)){toast('This screenshot-only preview has no PDF link yet. Live Supabase data is required.');return}if(what==='summary'){await summarizePdf(x);return}if(what==='preview'){rememberRecent(x);const w=window.open(x.pdfUrl,'_blank','noopener,noreferrer');if(!w)toast('Allow pop-ups to preview the PDF');return}if(what==='download'){rememberRecent(x);const fname=(x.title||'study-material').replace(/[\\/:*?"<>|]/g,'-').trim().slice(0,125)+'.pdf';const url='/api/download?url='+encodeURIComponent(x.pdfUrl)+'&filename='+encodeURIComponent(fname);const w=window.open(url,'_blank','noopener,noreferrer');if(!w)toast('Please allow downloads and pop-ups for this site');return}if(what==='share' && typeof window.__8aPDFShortLinks==='function'){window.__8aPDFShortLinks(x);return;}if(what==='share'){const txt=x.title+'\n'+x.pdfUrl+'\nby 8aPDF';try{if(navigator.share)await navigator.share({title:x.title,text:txt,url:x.pdfUrl});else if(navigator.clipboard){await navigator.clipboard.writeText(txt);toast('PDF link copied to clipboard')}else window.prompt('Copy this link',txt)}catch(e){if(e.name!=='AbortError')toast('Unable to share right now')}}}

async function createPdfZip(selectedIds,onReady){
 if(!Array.isArray(selectedIds)){window.__8apdfOpenPage?.('/pdf-explorer?select=zip');return;}
 const selection=new Set(selectedIds.map(String));
 const button=$('#zipExport'),original=button?.textContent||'Download ZIP';
 const files=state.materials.filter(x=>selection.has(String(x.id))&&validURL(x.pdfUrl));
 if(!files.length){toast('No school PDFs available to export.');return}
 if(button){button.disabled=true;button.textContent='Preparing PDFs…'}
 let saved=0,skipped=0,parts=0;
 try{
  const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  let zip=new JSZip(),size=0,count=0;
  async function flush(){
   if(!count)return;
   parts++;
   if(button)button.textContent='Building ZIP '+parts+'…';
   const output=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
   const url=URL.createObjectURL(output),a=document.createElement('a');
   a.href=url;a.download='8aPDF-Selected-PDFs'+(files.length>20?'-part-'+parts:'')+'.zip';if(typeof onReady==='function')onReady({url,filename:a.download});
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),300000);
   zip=new JSZip();size=0;count=0;
  }
  for(let i=0;i<files.length;i++){
   const x=files[i];
   if(button)button.textContent='Downloading '+(i+1)+'/'+files.length;
   try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
    let response;try{response=await fetch('/api/download?url='+encodeURIComponent(x.pdfUrl)+'&filename=file.pdf',{signal:ctrl.signal})}finally{clearTimeout(timer)}
    if(!response.ok)throw Error('PDF unavailable');
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength>50000000||!buffer.byteLength)throw Error('PDF size unsupported');
    if(count&&(size+buffer.byteLength>45000000||count>=20))await flush();
    const filename=String(x.title||'School PDF').replace(/[\\/:*?"<>|]+/g,'-').slice(0,65);
    zip.file(String(i+1).padStart(3,'0')+'-'+filename+'.pdf',buffer);
    size+=buffer.byteLength;count++;saved++;
   }catch(e){skipped++;console.warn('8aPDF ZIP skipped PDF:',x.title,e?.message)}
  }
  await flush();
  if(!saved)throw Error('No PDFs could be retrieved.');
  toast(saved+' of '+files.length+' PDFs exported'+(parts>1?' in '+parts+' ZIP parts (browser may ask to allow multiple downloads)':'')+(skipped?' · '+skipped+' unavailable.':''));return {saved,skipped,parts};
 }catch(error){console.warn('8aPDF ZIP error:',error);toast('ZIP export could not finish. Try again or download PDFs individually.');return {error:'ZIP export could not finish. Try again or download PDFs individually.'}}
 finally{if(button){button.disabled=false;button.textContent=original}}
}
window.__8apdfZipExport=createPdfZip;
$('#zipExport')?.addEventListener('click',createPdfZip);
async function summarizePdf(x){
 showModal('PDF Highlights','<p>Reading the first pages of this PDF…</p>');
 const root=$('#modalContent');
 try{
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const response=await fetch('/api/download?url='+encodeURIComponent(x.pdfUrl)+'&filename=summary.pdf');
  if(!response.ok)throw new Error('PDF download unavailable');
  const buffer=await response.arrayBuffer();if(buffer.byteLength>12000000)throw new Error('Large PDF');
  const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;
  const sentences=[];
  for(let index=1;index<=Math.min(3,pdf.numPages);index++){
   const page=await pdf.getPage(index),items=await page.getTextContent();
   const text=items.items.map(x=>x.str||'').join(' ').replace(/\s+/g,' ').trim();
   sentences.push(...text.split(/(?<=[.!?])\s+/).filter(v=>v.length>45&&v.length<360));
  }
  if(!$('#modal').classList.contains('open')||root!==$('#modalContent'))return;
  const highlighted=[...new Set(sentences)].slice(0,5);
  root.innerHTML='<p style="font-size:.8rem;color:var(--muted)">Extracted highlights from the first '+Math.min(3,pdf.numPages)+' pages · Not AI-generated.</p>'+
     (highlighted.length?'<ul>'+highlighted.map(v=>'<li style="margin:10px 0">'+safe(v)+'</li>').join('')+'</ul>':'<p>This document may be scanned. Text extraction found no readable sentences.</p>');
 }catch(error){
  if(root===$('#modalContent')&&$('#modal').classList.contains('open'))
   root.innerHTML='<p>Automatic extraction unavailable for this PDF. Use Preview to read the original.</p><p>'+safe(x.description||'')+'</p>';
 }
}

$('#subjectFilters').onclick=e=>{let b=e.target.closest('[data-subject]');if(!b)return;state.filter=b.dataset.subject;state.visible=12;renderMaterials()};document.addEventListener('click',e=>{const b=e.target.closest('[data-sidebar-subject]');if(!b)return;state.filter=b.dataset.sidebarSubject;state.visible=12;showLibrary();renderMaterials();scrollToSection('#library');if(window.matchMedia('(max-width:810px)').matches&&document.documentElement.dataset.studioMobileMenu==='open')$('#studioSidebarClose')?.click()});$('#morePdf').onclick=()=>{state.visible+=12;renderMaterials()};$('#sortSelect').onchange=e=>{state.sort=e.target.value;renderMaterials()};
function setLayout(l){settings.layout=l;setSettings()}$('#gridBtn').onclick=()=>setLayout('grid');$('#listBtn').onclick=()=>setLayout('list');
$('#searchInput').oninput=e=>{state.query=e.target.value.trim();state.visible=12;renderMaterials();if($('#announcements').style.display!=='none')renderAnnouncements()};$('#searchForm').onsubmit=e=>{e.preventDefault();showLibrary();scrollToSection('#library')};
$$('[data-search]').forEach(el=>el.onclick=()=>{$('#searchInput').value=el.dataset.search;$('#searchInput').dispatchEvent(new Event('input'));showLibrary();scrollToSection('#library')});
function renderRecent(){const list=termDocuments().slice().sort(comparePdfUploads).slice(0,4);$('#recentWidget').innerHTML=list.slice(0,4).map(x=>`<button class="list-row" data-openpdf="${safe(x.id)}"><span class="small-icon">${ico('file')}</span><span class="item-body"><strong>${safe(x.title)}</strong><span>${safe(x.subject)} · ${safe(fmtDate(x.createdAt))}</span></span></button>`).join('')||'<div class="load-state">No recent PDFs yet.</div>'}
$('#recentWidget').onclick=e=>{let b=e.target.closest('[data-openpdf]');if(!b)return;const x=state.materials.find(i=>i.id===b.dataset.openpdf);if(x)pdfAction(x,'preview')};
function showLibrary(){ $('#library').style.display='';$('#announcements').style.display='none';$$('[data-go]').forEach(x=>{if(x.classList.contains('nav-link'))x.classList.toggle('active',x.dataset.go==='library')}) }
function showAnnouncements(){ $('#announcements').style.display='';$('#library').style.display='none';renderAnnouncements();scrollToSection('#announcements');$$('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.go==='announcements')) }

function showAbout8aPDF(){
 const features=[
 ['📚 PDF Study Library','Browse school materials by subject, search for topics, and filter by Term 1 or Term 2.'],
 ['🔍 Fast Search','Find titles, subjects and chapters using the library search and shortcuts.'],
 ['🤖 AI PDF Finder','Ask for school PDFs in a dedicated chat workspace; local matches work without a paid AI request. Optional Groq assistance depends on server setup.'],
 ['📄 Preview & Download','Open a PDF preview, download it, or share it directly from its study-material card.'],
 ['🔗 Smart Share & Short Links','Choose the original PDF link or create a custom short URL. Your browser can manage its own newly created short links.'],
 ['📢 School Announcements','See published school notices, updates, events and circulars in one place.'],
 ['📅 School Timetable','View the six-day rotating timetable in a readable interactive table.'],
 ['🔖 Bookmarks & Recent PDFs','Save useful materials and return to recently opened items on this device.'],
 ['⏱ Focus Studio','Use focus sessions, revision tools and personal study goals with progress kept locally.'],
 ['🎨 Personalize Your Workspace','Switch Studio/Classic layouts, dark/light palettes, Liquid Glass, typography and accessibility preferences.'],
 ['🔔 Optional Notifications','Choose whether to allow website notifications when your browser supports them.']
 ];
 const cards=features.map(([title,desc])=>'<article class="about-feature"><strong>'+title+'</strong><p>'+desc+'</p></article>').join('');
 const content='<div class="about-8apdf">'+
 '<div class="about-hero"><span class="about-eyebrow">8aPDF · YOUR STUDY WORKSPACE</span>'+
 '<h3>Everything you need to study, in one place.</h3>'+
 '<p>Made for students: a searchable school library, announcements, a real timetable, flexible themes and helpful study tools.</p></div>'+
 '<div class="about-section-label">WEBSITE FEATURES</div><div class="about-feature-grid">'+cards+'</div>'+
 '<div class="about-automation"><span class="about-eyebrow">AUTOMATED SCHOOL UPDATES</span>'+
 '<h3>Designed for round-the-clock monitoring.</h3>'+
 '<p>Our EduSecure GitHub workflow is configured to check for updates approximately every 5 minutes while its worker runs, with an hourly backup schedule and automatic hand-off between worker runs. Actual availability depends on GitHub Actions and successful workflow runs.</p>'+
 '<div class="about-automation-actions"><a class="about-automation-button" href="https://github.com/nullreaperexe-cloud/edusecure-pdf-sync/actions/workflows/sync.yml" target="_blank" rel="noopener noreferrer">↗ View Automation Runs on GitHub</a>'+
 '<span>Public workflow history lets you inspect runs and their results. A configured schedule alone does not guarantee 100% uptime.</span></div></div>'+
 '</div>';
 const closeSidebar=document.getElementById('studioSidebarClose');
 if(document.documentElement.dataset.studioMobileMenu==='open'&&closeSidebar)closeSidebar.click();
 showModal('About 8aPDF',content);
}
function nav(go){closeSettings();if(go==='tasks'){window.__8apdfOpenTasks?.();return}if(go==='zip'){window.__8apdfZipExport?.();return}if(go==='about'){showAbout8aPDF();return}if(go==='timetable'){showTimetable();return}if(go==='settings'){openSettings();return}if(go==='announcements'){showAnnouncements();return}if(go==='saved'){showLibrary();state.filter='All Subjects';state.query='';$('#searchInput').value='';state.visible=10000;const a=state.materials.filter(x=>state.saved.includes(x.id)&&termOfPdf(x)===state.term);$('#pdfGrid').innerHTML=a.length?a.map(card).join(''):'<div class="empty">No saved PDFs yet. Use the bookmark icon on a PDF card to save it.</div>';$('#libraryStatus').textContent='Saved PDFs · '+a.length;$('#moreWrap').style.display='none';scrollToSection('#library');return}if(go==='search'){openCommand();return}if(go==='latest'){state.filter='All Subjects';state.query='';$('#searchInput').value='';state.sort='new';$('#sortSelect').value='new';showLibrary();renderMaterials();scrollToSection('#library');return}if(go==='home'){showLibrary();scrollToSection('#home');$$('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.go==='home'));return}if(go==='library'){showLibrary();renderMaterials();scrollToSection('#library')}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;e.preventDefault();nav(b.dataset.go)});
// Published teacher announcements come from 8aPDF Supabase.
const AFormat=window.__8aPDFAnnouncementFormat;
function announcementTime(x){return dateMs(x.messageDate)||dateMs(x.eventDate)||dateMs(x.createdAt)||0}
function aText(x){return [x.title,x.description,x.category,x.subject,x.message,x.fullMessage].join(' ').toLowerCase()}
function renderAnnouncementFilters(){$('#announcementFilters').innerHTML=cats.map(c=>`<button class="chip ${c===state.annCategory?'active':''}" data-cat="${safe(c)}">${safe(c)}</button>`).join('')}
function filteredAnnouncements(){return state.announcements.filter(x=>!AFormat.blocked(x)&&(state.annCategory==='All'||x.category===state.annCategory)&&(!state.query||aText(x).includes(state.query.toLowerCase())))}
function renderAnnouncements(){if(state.annReady&&state.announcements.length){try{localStorage.setItem('8a_cache_messages',JSON.stringify(state.announcements.filter(x=>!AFormat.blocked(x)).slice(0,150)))}catch{}}renderAnnouncementFilters();let a=filteredAnnouncements().sort((x,y)=>announcementTime(y)-announcementTime(x)||String(x.title||'').localeCompare(String(y.title||'')));$('#announcementCount').textContent=state.annReady?`${a.length} announcements loaded`:'Connecting…';$('#announcementGrid').innerHTML=state.annReady?(a.length?a.slice(0,state.annVisible).map(x=>`<article class="notice-card"><div class="pdf-top"><span class="doc-tile">${ico('megaphone')}</span><span class="tag">${safe(x.category||'General')}</span></div><h3>${safe(x.title||'School announcement')}</h3><p>${safe(AFormat.preview(x,165))}</p><div class="meta-line">${ico('calendar')} ${safe(fmtDate(x.messageDate||x.eventDate||x.createdAt))}</div><button class="action primary" data-ann="${safe(x.id)}">Read Announcement ${ico('arrow')}</button></article>`).join(''):'<div class="empty">No announcements in this category or search.</div>'):'<div class="empty">Loading latest school announcements…</div>';$('#moreAnnouncementsWrap').style.display=a.length>state.annVisible?'block':'none';renderAnnouncementsWidget();document.dispatchEvent(new CustomEvent("8apdf:teacher-data",{detail:state.announcements}))}
function renderAnnouncementsWidget(){const a=state.announcements.slice(0,5);$('#announcementsWidget').innerHTML=a.length?a.map(x=>`<button class="list-row" data-ann="${safe(x.id)}"><span class="small-icon">${ico('file')}</span><span class="item-body"><strong>${safe(x.title)}</strong><span>${safe(fmtDate(x.messageDate||x.createdAt))} · ${safe(x.category||'General')}</span></span></button>`).join(''):'<div class="list-row" style="color:var(--muted)">Latest announcements load from your existing Firestore library when connected.</div>'}
function openAnnouncement(x){if(AFormat.blocked(x))return;const share=AFormat.toWhatsApp(x),attachment=x.hasAttachment&&validURL(x.attachmentUrl);showModal(String(x.title||'Announcement'),AFormat.toHtml(x),`<button class="solid" id="copyAnnouncement">Copy for WhatsApp</button><button type="button" id="shareWhatsAppAnnouncement">Share on WhatsApp</button>${attachment?`<a class="solid" target="_blank" rel="noopener noreferrer" href="${safe(x.attachmentUrl)}" style="display:grid;place-items:center">Open Attachment</a>`:''}`);$('#copyAnnouncement').onclick=async()=>{try{await navigator.clipboard.writeText(share);toast('WhatsApp-ready announcement copied')}catch{window.prompt('Copy message:',share)}};$('#shareWhatsAppAnnouncement').onclick=()=>{const url='https://api.whatsapp.com/send?text='+encodeURIComponent(share);const w=window.open(url,'_blank','noopener,noreferrer');if(!w)window.location.assign(url)}}
$('#announcementFilters').onclick=e=>{let b=e.target.closest('[data-cat]');if(!b)return;state.annCategory=b.dataset.cat;state.annVisible=9;renderAnnouncements()};$('#moreAnnouncements').onclick=()=>{state.annVisible+=9;renderAnnouncements()};
for(const target of ['#announcementGrid','#announcementsWidget'])$(target).onclick=e=>{let b=e.target.closest('[data-ann]');if(!b)return;const x=state.announcements.find(a=>a.id===b.dataset.ann);if(x)openAnnouncement(x)};
// Quick notes are local-only: no Firestore writes or hidden shared data.
function renderNotes(){$('#notesList').innerHTML=state.tasks.length?state.tasks.map(t=>`<label class="task-row"><input type="checkbox" data-task-check="${safe(t.id)}" ${t.done?'checked':''}><span class="${t.done?'done':''}">${safe(t.text)}</span><button type="button" data-task-delete="${safe(t.id)}" aria-label="Delete task">×</button></label>`).join(''):'<div class="load-state">Your study to-dos will appear here. Only saved on this device.</div>'}
function saveTasks(){store.set('8apdf_tasks_v1',state.tasks);renderNotes()}
$('#noteForm').onsubmit=e=>{e.preventDefault();const v=$('#newNote').value.trim();if(!v)return;state.tasks.unshift({id:String(Date.now())+Math.random().toString(16).slice(2,6),text:v.slice(0,170),done:false});$('#newNote').value='';saveTasks()};
$('#notesList').onchange=e=>{let id=e.target.dataset.taskCheck;if(!id)return;let t=state.tasks.find(x=>x.id===id);if(t){t.done=e.target.checked;saveTasks()}};$('#notesList').onclick=e=>{let id=e.target.dataset.taskDelete;if(!id)return;state.tasks=state.tasks.filter(t=>t.id!==id);saveTasks()};$('#clearCompleted').onclick=()=>{state.tasks=state.tasks.filter(x=>!x.done);saveTasks()};
function openProfile(){showModal('Your 8aPDF Profile',`<p>Your name is saved privately on this device.</p><input id="editName" maxlength="40" value="${safe(state.name)}" placeholder="Your name">`,`<button class="solid" id="saveProfile">Save Profile</button>`);$('#saveProfile').onclick=()=>{const n=$('#editName').value.replace(/[<>]/g,'').trim().slice(0,40);if(!n){toast('Please enter a name');return}state.name=n;try{localStorage.setItem('eightapdf_user_name_v2',n);localStorage.setItem('eightapdf_user_name',n)}catch{}$('#profileBtn').textContent=n[0].toUpperCase();closeModal();document.dispatchEvent(new Event('8apdf:profile-changed'));toast('Profile updated')}}
$('#profileBtn').onclick=openProfile;
function askNotification(){if(window.__8apdfPush){window.__8apdfOpenPage?.('/notification-settings');return;}if(!('Notification' in window)){toast('Notifications are not supported by this browser');return}if(Notification.permission==='granted'){toast('Open notification settings to enable background updates.');return}if(Notification.permission==='denied'){toast('Notifications are blocked. Enable them in browser site settings.');return}if(!window.isSecureContext){toast('Notification permission needs HTTPS or localhost.');return}Notification.requestPermission().then(x=>toast(x==='granted'?'Notifications enabled for this browser':'Notifications not enabled'))}
$('#notificationsBtn').onclick=askNotification;$('#footerBell').onclick=askNotification;
function closeCommand(){$('#command').classList.remove('open')}
function openCommand(){closeSettings();$('#command').classList.add('open');$('#commandInput').value='';renderCommand();setTimeout(()=>$('#commandInput').focus(),35)}
function renderCommand(){const q=$('#commandInput').value.toLowerCase().trim();const items=[{title:'Go to PDF Library',act:'library',icon:'file'},{title:'View Announcements',act:'announcements',icon:'megaphone'},{title:'Open Timetable',act:'timetable',icon:'calendar'},{title:'Open Appearance Settings',act:'settings',icon:'settings'},{title:'Saved PDF Bookmarks',act:'saved',icon:'bookmark'},...state.materials.filter(x=>!q||keywords(x).includes(q)).slice(0,8).map(x=>({title:x.title,subtitle:x.subject,searchText:keywords(x),id:x.id,icon:'file'})),...state.announcements.filter(x=>q&&aText(x).includes(q)).slice(0,6).map(x=>({title:x.title,subtitle:'Teacher Message',searchText:aText(x),annId:x.id,icon:'megaphone'}))].filter(x=>!q||[x.title,x.subtitle||'',x.searchText||''].join(' ').toLowerCase().includes(q));$('#commandResults').innerHTML=items.length?items.map((x,i)=>`<button class="command-result" data-cmd="${x.id?'pdf:'+safe(x.id):x.annId?'ann:'+safe(x.annId):x.act}">${ico(x.icon)}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safe(x.title)}</span><small style="color:var(--muted)">${safe(x.subtitle||'')}</small></button>`).join(''):'<div class="empty">No matching commands or PDFs.</div>'}
$('#topSearch').onclick=openCommand;$('#commandInput').oninput=renderCommand;$('#command').onclick=e=>{if(e.target===$('#command'))closeCommand();let b=e.target.closest('[data-cmd]');if(!b)return;const a=b.dataset.cmd;closeCommand();if(a.startsWith('pdf:')){const x=state.materials.find(x=>x.id===a.slice(4));if(x)pdfAction(x,'preview')}else if(a.startsWith('ann:')){const x=state.announcements.find(x=>x.id===a.slice(4));if(x)openAnnouncement(x)}else nav(a)};
$('#commandInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#commandResults [data-cmd]')?.click()}};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}if(e.key==='Escape'){closeCommand();closeSettings();closeModal()}});
$('#menuBtn').onclick=()=>showModal('Navigate 8aPDF',`<div style="display:grid;gap:8px"><button class="solid" data-menu-go="home">Home</button><button class="solid" data-menu-go="library">Study Material</button><button class="solid" data-menu-go="announcements">Announcements</button><button class="solid" data-menu-go="timetable">School Timetable</button><button class="solid" data-menu-go="settings">Customize Appearance</button></div>`);
$('#modalContent').onclick=e=>{let b=e.target.closest('[data-menu-go]');if(b){closeModal();nav(b.dataset.menuGo)}};
$('#supportLink').addEventListener('click',e=>{e.preventDefault();toast('Support email is not configured in the current repository. Please use the existing site contact method.')} );

// Original SITEGRAB welcome screen retained: same markup, timing, typography, and transitions.
// Every fresh open shows a personalized welcome. New visitors enter their name once.
const originalWelcome=$('#welcomeScreen'), originalNameModal=$('#nameModal');
let welcomeTimer;
let pendingFirstPdfRender=false,pendingFirstAnnouncementsRender=false;
function welcomeBlocksCatalogPaint(){
 return document.getElementById('welcomeScreen')?.classList.contains('show') ||
        document.getElementById('nameModal')?.classList.contains('show');
}
function flushFirstCatalogRender(){
 if(welcomeBlocksCatalogPaint())return;
 if(pendingFirstPdfRender){pendingFirstPdfRender=false;renderMaterials()}
 if(pendingFirstAnnouncementsRender){pendingFirstAnnouncementsRender=false;renderAnnouncements()}
}
function scheduleFirstCatalogRender(){
 requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(flushFirstCatalogRender,60)));
}
function closeOriginalWelcome(){
  // Preserve the full welcome until the async stylesheet is applied.
  if(originalWelcome.classList.contains('show')&&!window.__8apdfHomeStyleReady&&Date.now()-Number(window.__8apdfHomeStyleStart||0)<9000){setTimeout(closeOriginalWelcome,125);return;}
  originalWelcome.classList.remove('show');originalWelcome.setAttribute('aria-hidden','true');delete document.documentElement.dataset.entryPending;
  scheduleFirstCatalogRender();
  document.body.classList.remove('locked');
  clearTimeout(welcomeTimer);
  window.__8apdfMusicConsent?.request?.();
}
function offerNotificationAfterWelcome(){
  try {
    const seen=localStorage.getItem('8apdf-classic-notification-choice');
    if(seen || !('Notification' in window) || Notification.permission!=='default')return;
    localStorage.setItem('8apdf-classic-notification-choice','1');
  }catch{return}
  window.__8apdfNotices?.publish({source:'permission',id:'allow-browser-notifications',title:'Stay updated',body:'Tap to enable optional browser alerts',open:askNotification});
}
function originalShowWelcome(name,notifyAfter=false){
  $('#welcomeTitle').textContent='Welcome, '+name;
  document.body.classList.add('locked');
  originalWelcome.classList.add('show');originalWelcome.setAttribute('aria-hidden','false');delete document.documentElement.dataset.entryPending;
  clearTimeout(welcomeTimer);
  const shownAt=Number(window.__8apdfWelcomeShownAt||0);
  const remaining=shownAt?Math.max(0,2350-(performance.now()-shownAt)):2350;
  welcomeTimer=setTimeout(()=>{closeOriginalWelcome();if(notifyAfter)offerNotificationAfterWelcome()},remaining);
}
const premiumOnboardingOpen=window.initNameOnboarding({
  onConfirm(name){
    state.name=name;
    $('#profileBtn').textContent=Array.from(name)[0].toUpperCase();
    document.dispatchEvent(new Event('8apdf:profile-changed'));
  },
  onFinish(){
    scheduleFirstCatalogRender();
    const showingMusicChoice=window.__8apdfMusicConsent?.request?.();
    if(showingMusicChoice){
      document.addEventListener('8apdf:music-choice',offerNotificationAfterWelcome,{once:true});
    }else offerNotificationAfterWelcome();
  }
});
// Same welcome animation on every reload and every new website open.
const previousName=existingUserName().trim();
let skipWelcome=false;
let comingBackFromChat=false;
try{skipWelcome=localStorage.getItem('8apdf_skip_welcome')==='1'}catch{}
try{
 comingBackFromChat=sessionStorage.getItem('8apdf_from_chat_v1')==='1';
 if(comingBackFromChat)sessionStorage.removeItem('8apdf_from_chat_v1');
}catch{}
if(premiumOnboardingOpen){
  // The versioned name experience owns this visit's welcome transition.
}else if((skipWelcome||comingBackFromChat) && previousName && previousName!=='Student'){
  closeOriginalWelcome();
  originalNameModal.classList.remove('show');originalNameModal.setAttribute('aria-hidden','true');
  document.body.classList.remove('locked');
}else if(previousName && previousName!=='Student')originalShowWelcome(previousName);
else closeOriginalWelcome();

renderTimetable();renderNotes();if(previewMode){renderMaterials();renderAnnouncements()};
window.__8apdfStudyBridge={
 documents:()=>state.materials.map(x=>({id:x.id,title:x.title,subject:x.subject,description:x.description,chapter:x.chapter,className:x.className,tags:Array.isArray(x.tags)?x.tags:[],createdAt:fmtDate(x.createdAt),dateMs:dateMs(x.createdAt),uploadedAtMs:pdfUploadMs(x),term:termOfPdf(x),pdfUrl:x.pdfUrl,available:validURL(x.pdfUrl)})),
 announcements:()=>state.announcements.map(a=>({id:String(a.id||''),title:String(a.title||''),description:String(a.description||''),message:String(a.message||''),fullMessage:String(a.fullMessage||''),subject:String(a.subject||''),category:String(a.category||''),eventDate:a.eventDate||null,messageDate:a.messageDate||null,createdAt:a.createdAt||null})),
 recents:()=>[...state.recent],bookmarks:()=>[...state.saved],toggleBookmark:(id)=>{state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];store.set('8apdf_saved_v1',state.saved);renderMaterials();document.dispatchEvent(new Event('8apdf:bookmarks-changed'));},
 openAnnouncement:(id)=>{const n=state.announcements.find(n=>String(n.id)===String(id));if(n)openAnnouncement(n);},
 openDocument:(id,action='preview')=>{const x=state.materials.find(x=>x.id===id);if(x)pdfAction(x,['preview','download','share'].includes(action)?action:'preview')},
 navigate:nav,subject:(subject)=>{state.filter=subject;state.query='';$('#searchInput').value='';showLibrary();renderMaterials();scrollToSection('#library')},
 setSchoolDay:(day)=>{if(Number.isInteger(day)&&day>=1&&day<=6){selectedSchoolDay=day;renderTimetable();document.dispatchEvent(new Event('8apdf:school-day-changed'))}}, schoolDay:()=>selectedSchoolDay, timetable:()=>timetable.map((periods,i)=>({day:i+1,periods})),
 notify:(message)=>toast(message),
 areAnnouncementsReady:()=>state.annReady,
 isLive:()=>state.live
};

// Feathered ambient glow: pointer, scrolling, and idle drift; no image or visible blob geometry.
(function adaptiveAmbientGlow(){
 const root=document.documentElement;
 let x=.5,y=.40,targetX=.5,targetY=.4,lastPointer=0,lastScroll=scrollY,lastScrollTime=performance.now(),scrollEnergy=0;
 let lastFrame=0,raf=0,frameDelay=0;
 // Keep every glow animation; throttle JS wakeups on slower hardware.
 const cadence=()=>innerWidth<650?90:(Number(navigator.hardwareConcurrency||8)<=4?55:36);
 const scheduleFrame=()=>{if(document.hidden||!settings.glow)return;frameDelay=window.setTimeout(()=>{frameDelay=0;raf=requestAnimationFrame(step)},cadence())};
 const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
 const reduced=()=>settings.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(fine) document.addEventListener('pointermove',e=>{
  if(!settings.glow||!settings.glowCursor)return;
  targetX=Math.min(.99,Math.max(.01,e.clientX/Math.max(1,innerWidth)));
  targetY=Math.min(.99,Math.max(.01,e.clientY/Math.max(1,innerHeight)));
  lastPointer=performance.now();
 },{passive:true});
 window.addEventListener('scroll',()=>{
  if(!settings.glow||!settings.glowScroll)return;
  const now=performance.now();const delta=scrollY-lastScroll;
  scrollEnergy=Math.max(-.23,Math.min(.23,scrollEnergy+delta/Math.max(400,innerHeight)*.22));
  lastScroll=scrollY;lastScrollTime=now;
 },{passive:true});
 function step(now){
  raf=0;
  if(document.hidden||!settings.glow)return;
  if(now-lastFrame<cadence()){scheduleFrame();return}
  lastFrame=now;
  if(!reduced()){
   const idle=!fine||!settings.glowCursor||(now-lastPointer>1800);
   if(settings.glowIdle&&idle){
    const rate=(.20+settings.glowSpeed*.016)*.00027;
    targetX=.5+Math.sin(now*rate)*.24+Math.cos(now*rate*.47)*.09;
    targetY=.41+Math.cos(now*rate*.83)*.20;
   }
   if(settings.glowScroll){
    scrollEnergy*=.88;
    if(now-lastScrollTime<1150){targetY=Math.max(.12,Math.min(.87,targetY+scrollEnergy*.04));targetX=Math.max(.1,Math.min(.9,targetX+scrollEnergy*.025))}
   }
   const follow=.045+settings.glowSpeed*.0019;
   x+=(targetX-x)*follow;y+=(targetY-y)*follow;
  }
  root.style.setProperty('--glow-x',(x*100).toFixed(2)+'%');
  root.style.setProperty('--glow-y',(y*100).toFixed(2)+'%');
  scheduleFrame();
 }
 function restart(){if(raf)cancelAnimationFrame(raf);if(frameDelay)clearTimeout(frameDelay);raf=0;frameDelay=0;if(settings.glow&&!document.hidden)raf=requestAnimationFrame(step)}
 document.addEventListener('visibilitychange',restart);
 document.addEventListener('8apdf:glow-change',restart);
 restart();
})();

// Settings open on explicit request, never over first-time onboarding.
// Pointer highlights are visual-only and throttled to one frame, with a touch/motion-safe fallback.
if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
 let target=null, x=0, pending=false;
 document.addEventListener('pointermove',e=>{
  if(document.documentElement.dataset.glass!=='on'||document.documentElement.dataset.fluid!=='on')return;
  target=e.target.closest?.('.pdf-card,.feature,.widget,.top-nav,.big-search,.notice-card');
  if(!target)return;
  x=e.clientX-target.getBoundingClientRect().left;
  if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;if(target)target.style.setProperty('--sheen-x',x+'px')})}
 },{passive:true});
}

// PDFs and announcements load from the 8aPDF Supabase project.
let pdfSyncInProgress=false;
async function refreshSupabaseMaterials(){
 if(pdfSyncInProgress)return;
 pdfSyncInProgress=true;
 try{
  const {fetchAllStudyMaterials}=await import('/supabase-materials.js');
  const records=await fetchAllStudyMaterials();
  state.materials=records.filter(d=>d&&d.published!==false&&d.pdf_url).map(normalizeDoc)
   .sort(comparePdfUploads);
  state.live=true;state.error=false;
  try{localStorage.setItem('8a_cache_pdfs',JSON.stringify(state.materials.slice(0,150)))}catch{}
  $('#previewRibbon').classList.remove('show');
  if(welcomeBlocksCatalogPaint())pendingFirstPdfRender=true;else renderMaterials();
  document.dispatchEvent(new Event('8apdf:library-updated'));
 }catch(err){console.warn('8aPDF Supabase study_materials could not load:',err);showOffline()}
 finally{pdfSyncInProgress=false}
}
// The school announcements have migrated to the dedicated Supabase table.
// Preserve the original Firestore-format timestamp objects stored in 'raw'.
let announcementsSyncInProgress=false;
async function refreshSupabaseAnnouncements(){
 if(announcementsSyncInProgress)return;
 announcementsSyncInProgress=true;
 try{
  const {fetchAllSupabaseAnnouncements,normalizeSupabaseAnnouncement}=await import('/supabase-announcements.js');
  const rows=await fetchAllSupabaseAnnouncements();
  state.announcements=rows.filter(x=>x&&x.published===true)
   .map(normalizeSupabaseAnnouncement)
   .filter(x=>!AFormat.blocked(x))
   .sort((a,b)=>announcementTime(b)-announcementTime(a)||
     String(a.title||'').localeCompare(String(b.title||'')));
  state.annReady=true;
  if(welcomeBlocksCatalogPaint())pendingFirstAnnouncementsRender=true;else renderAnnouncements();
 }catch(e){
  console.warn('8aPDF Supabase announcements unavailable:',e?.message||e);
  if(!state.annReady){
   try{
    const cached=JSON.parse(localStorage.getItem('8a_cache_messages')||'[]');
    if(Array.isArray(cached))state.announcements=cached.filter(x=>x?.published===true&&!AFormat.blocked(x));
   }catch{}
   state.annReady=true;
   renderAnnouncements();
  }
 }finally{announcementsSyncInProgress=false}
}
function showOffline(){if(!state.live){if(previewMode)$('#previewRibbon').classList.add('show');else state.error=true;renderMaterials()}}
setTimeout(()=>{if(!state.live)showOffline()},4200);
refreshSupabaseMaterials();
refreshSupabaseAnnouncements();
setInterval(()=>{if(!document.hidden){refreshSupabaseMaterials();refreshSupabaseAnnouncements()}},120000);
// Admin saves refresh already-open student tabs immediately on this origin.
try{new BroadcastChannel('8apdf-catalogue').addEventListener('message',()=>{refreshSupabaseMaterials();refreshSupabaseAnnouncements()});}catch{}
window.addEventListener('storage',e=>{if(e.key==='8apdf_admin_catalogue_changed'){refreshSupabaseMaterials();refreshSupabaseAnnouncements()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshSupabaseMaterials();refreshSupabaseAnnouncements()}});

})();
