/* 8aPDF — elegant, accessible, responsive study typing headline. */
(()=>{'use strict';
const headline=document.getElementById('studyTypingHeadline');
const output=document.getElementById('studyTypingText');
if(!headline||!output)return;
const lines=[
 'Learn today. Lead tomorrow.',
 'Big dreams begin with small steps.',
 'One chapter closer to your goal.',
 'Stay curious. Keep discovering.',
 'Every question makes you stronger.',
 'Read more. Understand deeper.',
 'Progress beats perfection.',
 'Turn effort into excellence.',
 'Small wins build big dreams.',
 'New day. New things to learn.',
 'Your next breakthrough starts here.',
 'One lesson at a time.',
 'Keep exploring. Keep growing.',
 'Focus now. Shine later.',
 'Study smart. Dream without limits.',
 'Believe. Learn. Achieve.',
 'Every page holds a possibility.',
 'Every minute of effort matters.',
 'Your curiosity is your superpower.',
 'Start strong. Finish stronger.',
 'Every chapter counts.',
 'Study with purpose. Grow with pride.',
 'Stay focused. You are getting there.',
 'Discover more than yesterday.',
 'Make your learning count.',
 'More knowledge. More confidence.',
 'One step closer every day.',
 'Good things take practice.',
 'Knowledge opens new doors.',
 'Make the most of every lesson.',
 'Think bigger. Learn better.',
 'Your effort creates your future.',
 'Learn something new every day.',
 'Today is full of possibilities.'
];
let index=0,count=0,deleting=false,timer=0;
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const root=document.documentElement;
const permitted=()=>root.dataset.uiMode==='studio'&&root.dataset.motion!=='off'&&!motion.matches&&!document.hidden;
function schedule(delay){window.clearTimeout(timer);timer=window.setTimeout(tick,delay)}
function tick(){
 if(!permitted())return;
 const phrase=lines[index];
 if(!deleting){
  if(count<phrase.length){
   count+=1;
   output.textContent=phrase.slice(0,count);
   schedule(45+(count%4)*6);
  }else{
   deleting=true;
   schedule(1850);
  }
 }else if(count>0){
  count-=1;
  output.textContent=phrase.slice(0,count);
  schedule(26);
 }else{
  deleting=false;
  index=(index+1)%lines.length;
  schedule(360);
 }
}
function sync(){
 window.clearTimeout(timer);
 headline.classList.toggle('study-typing-still',motion.matches||root.dataset.motion==='off');
 if(root.dataset.uiMode!=='studio')return;
 if(motion.matches||root.dataset.motion==='off'){
  output.textContent=lines[index];
  count=lines[index].length;
  deleting=false;
  return;
 }
 if(document.hidden)return;
 schedule(100);
}
// Keep a complete meaningful headline without JavaScript, and respect reduced
// motion when enabled before the first paint.
if(motion.matches||root.dataset.motion==='off'){
 output.textContent=lines[0];count=lines[0].length;
}else{
 output.textContent='';count=0;schedule(160);
}
document.addEventListener('visibilitychange',sync);
document.addEventListener('8apdf:ui-mode-changed',sync);
motion.addEventListener?.('change',sync);
new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-motion','data-ui-mode']});
})();
