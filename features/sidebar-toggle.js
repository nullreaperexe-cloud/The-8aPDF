(()=>{'use strict';
 const root=document.documentElement;
 const button=document.getElementById('studioSidebarToggle');
 const sidebar=document.getElementById('studioSidebar');
 const closeButton=document.getElementById('studioSidebarClose');
 const shade=document.getElementById('studioSidebarShade');
 const key='8apdf_studio_nav_open_v1';
 const mobile=()=>window.matchMedia('(max-width:810px)').matches;
 function synchronize(){
  const isMobileMenu=root.dataset.studioMobileMenu==='open';
  const expanded=mobile()?isMobileMenu:root.dataset.studioNav!=='closed';
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',expanded?'Close sidebar':'Open sidebar');
  button.setAttribute('title',expanded?'Hide sidebar (Ctrl+B)':'Show sidebar (Ctrl+B)');
  sidebar.inert=!expanded || root.dataset.uiMode!=='studio';
  document.body.classList.toggle('studio-mobile-menu-open',mobile()&&isMobileMenu);
 }
 function setOpen(open){
  if(mobile()){
   root.dataset.studioMobileMenu=open?'open':'closed';
  }else{
   root.dataset.studioNav=open?'open':'closed';
   try{localStorage.setItem(key,String(open))}catch{}
  }
  synchronize();
 }
 button.addEventListener('click',()=>setOpen(!(mobile()?root.dataset.studioMobileMenu==='open':root.dataset.studioNav!=='closed')));
 closeButton.addEventListener('click',()=>setOpen(false));
 shade.addEventListener('click',()=>setOpen(false));
 sidebar.addEventListener('click',event=>{if(mobile()&&event.target.closest('.studio-side-link'))setOpen(false)});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&mobile()&&root.dataset.studioMobileMenu==='open')setOpen(false);
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='b'&&!event.altKey&&root.dataset.uiMode==='studio'){
   const e=document.activeElement;
   if(e&&(/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)||e.isContentEditable))return;
   event.preventDefault();button.click();
  }
 });
 window.addEventListener('resize',()=>{if(!mobile())root.dataset.studioMobileMenu='closed';synchronize()});
 document.addEventListener('8apdf:ui-mode-changed',()=>{root.dataset.studioMobileMenu='closed';synchronize()});
 synchronize();
})();
