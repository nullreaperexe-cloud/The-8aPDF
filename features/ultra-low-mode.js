/* Super Ultra Low Mode: OFF by default on all hardware; user controls opt-in. */
(()=>{
 'use strict';
 const KEY='8apdf_super_ultra_low_mode_v1',root=document.documentElement,autoDetected=root.dataset.ultraLowAuto==='on';
 const read=()=>{try{const v=localStorage.getItem(KEY);return v==='on'||v==='off'?v:'auto'}catch{return 'auto'}};
 let choice=read();
 const enabled=()=>choice==='on'; // Opt-in only; never automatically enable.
 function syncControls(){
  const toggle=document.getElementById('ultraLowModeToggle'),status=document.getElementById('ultraLowModeStatus'),reset=document.getElementById('ultraLowAutoButton');
  if(toggle)toggle.checked=enabled();
  if(status)status.textContent=choice==='on'?'On manually · music unchanged':choice==='off'?'Off manually · music unchanged':'Off by default · switch on anytime';
  if(reset)reset.hidden=choice==='auto';
 }
 function apply(){
  const previous=root.dataset.ultraLow;
  root.dataset.ultraLow=enabled()?'on':'off';
  root.dataset.ultraLowChoice=choice;
  syncControls();
  if(previous!==root.dataset.ultraLow)document.dispatchEvent(new Event('8apdf:ultra-low-change'));
 }
 function setMode(v){
  if(v!=='on'&&v!=='off'&&v!=='auto')return;
  choice=v;
  try{if(v==='auto')localStorage.removeItem(KEY);else localStorage.setItem(KEY,v)}catch{}
  apply();
 }
 function connect(){
  const toggle=document.getElementById('ultraLowModeToggle'),reset=document.getElementById('ultraLowAutoButton');
  if(toggle)toggle.addEventListener('change',()=>setMode(toggle.checked?'on':'off'));
  if(reset)reset.addEventListener('click',()=>setMode('auto'));
  syncControls();
 }
 window.__8apdfUltraLow={get enabled(){return enabled()},get choice(){return choice},get autoDetected(){return autoDetected},setMode};
 window.addEventListener('storage',e=>{if(e.key===KEY){choice=read();apply()}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
 apply();
})();
