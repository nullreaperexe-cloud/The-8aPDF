(()=>{'use strict';
const STYLE_ID='8apdf-shared-tool-theme';
const sharedCss=`
:root{color-scheme:dark}
html[data-tone="light"]{color-scheme:light}
html,body{min-height:100%;background:var(--bg,#050305)!important;color:var(--text,#fff9fb)!important}
body{position:relative;isolation:isolate;font-family:var(--ui-font,'Space Grotesk',Inter,system-ui,sans-serif)!important}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(ellipse 75% 48% at 50% -4%,rgba(124,11,28,.22),transparent 82%),var(--bg,#050305)}
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.26;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 80% 65% at 50% 18%,#000 8%,transparent 92%)}
body>*{position:relative;z-index:1}
:is(main,.explorer,.app-shell,.school-tool){background:transparent!important;color:var(--text)!important}
:is(h1,h2,h3,h4,strong,.explorer-brand,.rail-brand){font-family:Manrope,var(--ui-font),Inter,system-ui,sans-serif!important}
:is(button,input,select,textarea){font-family:inherit!important}
:is(button,.btn,.mode,.explorer-tools button,.school-tool button,.push-actions button){border-radius:11px!important;border-color:var(--line-bold)!important;background:var(--surface-high)!important;color:var(--text)!important;transition:transform .22s cubic-bezier(.2,.8,.2,1),background .22s,border-color .22s!important}
:is(button,.btn,.mode,.explorer-tools button,.school-tool button,.push-actions button):hover{background:var(--hover)!important;border-color:var(--text-soft)!important;transform:translateY(-2px)}
:is(.btn.primary,.primary,.send-button,.explorer-tools button#explorerSelectMode){background:var(--button)!important;color:var(--button-text)!important;border-color:var(--button)!important}
:is(input,select,textarea){background:var(--surface-soft)!important;color:var(--text)!important;border-color:var(--line-bold)!important;border-radius:11px!important}
:is(.file,.pdf-card,.notice-card,.calendar-date,.calendar-summary,.push-panel,.school-tool-filters,.explorer-grid>article,.room-card,.message-bubble){background:linear-gradient(145deg,var(--surface-high),var(--surface))!important;color:var(--text)!important;border-color:var(--line)!important;border-radius:16px!important;box-shadow:0 12px 32px rgba(0,0,0,.24)!important}
@keyframes toolFireAura{0%,100%{transform:translate3d(-2%,0,0) scale(.98);opacity:.20}50%{transform:translate3d(2%,1%,0) scale(1.04);opacity:.30}}
html[data-tone="light"] body::before{background:radial-gradient(ellipse 75% 48% at 50% -4%,rgba(233,37,69,.12),transparent 82%),var(--bg,#faf7f8)}
html[data-tone="light"] body::after{opacity:.12;background-image:linear-gradient(rgba(120,49,69,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(120,49,69,.08) 1px,transparent 1px)}
@media(prefers-reduced-motion:reduce){:is(button,.btn,.mode):hover{transform:none!important}}
`;
function install(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=sharedCss;document.head.append(style)}
function apply(data){install();if(data.vars)for(const [key,value] of Object.entries(data.vars))if(key.startsWith('--'))document.documentElement.style.setProperty(key,value);if(data.font)document.documentElement.style.setProperty('--ui-font',data.font);if(data.tone)document.documentElement.dataset.tone=data.tone;}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='8aPDF:theme')apply(e.data);if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='8apdf:theme')apply(e.data)});
install();
try{if(parent!==window&&parent.document){const s=parent.getComputedStyle(parent.document.documentElement),vars={};for(const key of ['--bg','--bg-alt','--surface','--surface-high','--surface-soft','--text','--text-soft','--muted','--line','--line-bold','--button','--button-text','--hover'])vars[key]=s.getPropertyValue(key);apply({vars,font:parent.getComputedStyle(parent.document.body).fontFamily,tone:parent.document.documentElement.dataset.tone});}}catch{}
})();
