(()=>{'use strict';
function apply(data){if(data.vars)for(const [key,value] of Object.entries(data.vars))if(key.startsWith('--'))document.documentElement.style.setProperty(key,value);if(data.font)document.body.style.fontFamily=data.font;if(data.tone)document.documentElement.dataset.tone=data.tone;}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='8apdf:theme')apply(e.data)});
try{if(parent!==window&&parent.document){const s=parent.getComputedStyle(parent.document.documentElement),vars={};for(const key of ['--bg','--bg-alt','--surface','--surface-high','--surface-soft','--text','--text-soft','--muted','--line','--line-bold','--button','--button-text','--hover'])vars[key]=s.getPropertyValue(key);apply({vars,font:parent.getComputedStyle(parent.document.body).fontFamily,tone:parent.document.documentElement.dataset.tone});}}catch{}
})();
