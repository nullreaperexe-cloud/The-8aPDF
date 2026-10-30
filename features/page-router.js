/* Clean URLs for the existing SPA. Keeps Firebase, short links and all classic controls intact. */
(()=>{
  'use strict';
  const KEY='__8apdf_page_route_v1';
  const ROUTES=new Set(['/','/pdfs','/announcements','/updates','/settings','/chatbot','/tasks']);
  const homeTitle=document.title;
  const TITLES={
    '/':homeTitle,
    '/announcements':'Teacher Messages | 8aPDF',
    '/updates':'Teacher Messages | 8aPDF',
    '/pdfs':'PDF Library | 8aPDF',
    '/settings':'Settings | 8aPDF',
    '/chatbot':'AI PDF Finder | 8aPDF',
    '/tasks':'My Study To-Do | 8aPDF'
  };
  const page=()=>ROUTES.has(location.pathname.replace(/\/+$/,'')||'/')?(location.pathname.replace(/\/+$/,'')||'/'):'/';
  const byId=id=>document.getElementById(id);
  let applying=false;
  let leavingOverlay=false;

  function quietClick(id){
    const el=byId(id);
    if(!el)return;
    const previous=applying;
    applying=true;
    try{el.click()}finally{applying=previous}
  }
  function visibleSettings(){return byId('settingsPanel')?.classList.contains('open')}
  function visibleChat(){return !byId('pdfAiLayer')?.hidden}
  function setTitle(path){document.title=TITLES[path]||homeTitle}
  function preserveState(route,previous){
    return {...(history.state&&typeof history.state==='object'?history.state:{}),[KEY]:{route,previous}};
  }
  function routeTo(path,replace=false){
    if(!ROUTES.has(path))return;
    const old=page();
    if(old!==path||location.hash){
      const next=preserveState(path,replace?null:old);
      if(replace)history.replaceState(next,'',path);
      else history.pushState(next,'',path);
    }
    setTitle(path);
  }
  function showRoute(path){
    if(!ROUTES.has(path))path='/';
    applying=true;
    try{
      if(path!=='/chatbot'&&visibleChat())quietClick('pdfAiClose');
      if(path!=='/settings'&&visibleSettings())quietClick('closeSettings');
      if(path!=='/tasks'&&byId('fullTaskCenter'))quietClick('modalClose');
      if(path==='/chatbot'){
        if(!visibleChat())quietClick('studioAssistantLink');
      }else if(path==='/settings'){
        if(!visibleSettings())quietClick('settingsBtn');
      }else if(path==='/tasks'){
        requestAnimationFrame(()=>window.__8apdfOpenTasks?.());
      }else{
        const bridge=window.__8apdfStudyBridge;
        if(bridge?.navigate)bridge.navigate(path==='/announcements'||path==='/updates'?'announcements':path==='/pdfs'?'library':'home');
        else{
          const selector=(path==='/announcements'||path==='/updates')?'[data-go="announcements"]':path==='/pdfs'?'[data-go="library"]':'[data-go="home"]';
          document.querySelector(selector)?.click();
        }
      }
      setTitle(path);
    }finally{applying=false}
  }
  function leaveOverlay(){
    if(applying||leavingOverlay)return;
    leavingOverlay=true;
    const route=page();
    const previous=history.state?.[KEY]?.previous;
    if((route==='/chatbot'||route==='/settings'||route==='/tasks')&&ROUTES.has(previous)&&previous!==route){
      history.back();
    }else{
      routeTo('/',true);
      showRoute('/');
      queueMicrotask(()=>{leavingOverlay=false});
    }
  }
  document.addEventListener('click',event=>{
    if(applying||!(event.target instanceof Element))return;
    const t=event.target;
    const matches=selector=>Boolean(t.closest(selector));
    if(matches('#studioAssistantLink,#studioMoreAssistant')){
      if(visibleSettings())quietClick('closeSettings');
      routeTo('/chatbot');return;
    }
    if(matches('#settingsBtn,[data-go="settings"],#pdfAiOpenSettings')){
      if(visibleChat())quietClick('pdfAiClose');
      routeTo('/settings');return;
    }
    if(matches('#modalClose')&&page()==='/tasks'){leaveOverlay();return;}
    if(matches('#pdfAiClose,#pdfAiShade,#closeSettings,#settingsBack,#saveSettings,#drawerMask,#pdfAiBack')){
      if(page()==='/chatbot'||page()==='/settings')leaveOverlay();
      return;
    }
    const nav=t.closest('[data-go]');
    if(nav){
      const dest=nav.getAttribute('data-go');
      if(dest==='announcements'){routeTo('/announcements');return;}
      if(dest==='tasks'){routeTo('/tasks');return;}
      if(dest==='library'){routeTo('/pdfs');return;}
      if(['home','saved','latest'].includes(dest)){routeTo('/');return;}
    }
    if(matches('a.brand[href="#home"]'))routeTo('/');
  });
  document.addEventListener('keyup',event=>{
    if(applying||event.key!=='Escape')return;
    if(page()==='/chatbot'&&!visibleChat())leaveOverlay();
    else if(page()==='/settings'){
      if(visibleSettings())quietClick('closeSettings');
      leaveOverlay();
    }
  });
  window.addEventListener('popstate',()=>{leavingOverlay=false;showRoute(page())});
  const initial=page();
  if(!history.state?.[KEY])history.replaceState(preserveState(initial,null),'',location.href);
  setTitle(initial);
  if(initial!=='/')queueMicrotask(()=>showRoute(initial));
})();
