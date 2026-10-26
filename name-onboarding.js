/* 8aPDF name-only onboarding; no login, signup, or account prompt. */
(() => {
  const NAME_MARKER='8apdf_premium_name_onboarding_v1';
  const nameKeys=['eightapdf_user_name_v2','eightapdf_user_name'];
  const read=key=>{for(const kind of ['localStorage','sessionStorage']){try{const v=window[kind].getItem(key);if(v)return v}catch{}}return ''};
  const write=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{}try{sessionStorage.setItem(key,value)}catch{}return false};
  window.initNameOnboarding=({onConfirm,onFinish})=>{
    const needsName=read(NAME_MARKER)!=='complete'||!nameKeys.some(key=>read(key).trim());
    if(!needsName)return false;
    const modal=document.getElementById('nameModal');
    const form=document.getElementById('nameForm');
    if(!modal||!form)return false;
    const input=document.getElementById('nameInput');
    const button=form.querySelector('button');
    const feedback=document.getElementById('nameFeedback');
    const previousFocus=document.activeElement;
    let submitting=false,finished=false;
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='off';
    const siblings=[...document.body.children].filter(node=>node!==modal&&!node.inert);
    siblings.forEach(node=>node.inert=true);
    const observer=new MutationObserver(()=>{
      for(const node of document.body.children){
        if(node!==modal&&!node.inert){siblings.push(node);node.inert=true}
      }
    });
    observer.observe(document.body,{childList:true});
    const keepFocus=e=>{if(!modal.contains(e.target))modal.focus({preventScroll:true})};
    document.addEventListener('focusin',keepFocus);
    const trap=e=>{
      if(e.key!=='Tab')return;
      const controls=[...modal.querySelectorAll('input,button')].filter(node=>!node.disabled&&!node.inert&&node.getClientRects().length);
      if(!controls.length){e.preventDefault();modal.focus();return}
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    modal.addEventListener('keydown',trap);
    function finish(){
      if(finished)return;finished=true;
      modal.classList.add('name-leaving');
      setTimeout(()=>{
        modal.classList.remove('show','name-leaving');
        modal.setAttribute('aria-hidden','true');
        delete modal.dataset.phase;
        document.body.classList.remove('locked');
        observer.disconnect();
        document.removeEventListener('focusin',keepFocus);
        modal.removeEventListener('keydown',trap);
        siblings.forEach(node=>node.inert=false);
        const target=previousFocus&&previousFocus!==document.body?previousFocus:document.getElementById('profileBtn');
        target?.focus({preventScroll:true});onFinish();
      },reduced()?0:280);
    }
    document.body.classList.add('locked');
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
    input.value=nameKeys.map(read).find(x=>x.trim())||'';
    const update=()=>{button.disabled=submitting||!input.value.trim();input.removeAttribute('aria-invalid');feedback.textContent='Just your name. Make yourself at home.'};
    input.addEventListener('input',update);update();input.focus({preventScroll:true});
    form.addEventListener('submit',e=>{
      e.preventDefault();if(submitting)return;
      const name=input.value.trim();
      if(!name){input.setAttribute('aria-invalid','true');feedback.textContent='Please enter your name to continue.';input.focus();return}
      submitting=true;input.value=name;input.readOnly=true;button.disabled=true;
      button.querySelector('span').textContent='Opening your workspace';
      nameKeys.forEach(k=>write(k,name));
      onConfirm(name);write(NAME_MARKER,'complete');
      document.getElementById('nameWelcomeTitle').textContent='Welcome, '+name+'.';
      document.getElementById('nameWelcomeDetail').textContent='Your next chapter begins here.';
      modal.dataset.phase='welcome';form.inert=true;modal.focus({preventScroll:true});
      setTimeout(finish,reduced()?160:1050);
    });
    return true;
  };
})();
