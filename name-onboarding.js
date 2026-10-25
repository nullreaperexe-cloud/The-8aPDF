/* 8aPDF name-first onboarding; Google account is always optional. */
(() => {
  const NAME_MARKER='8apdf_premium_name_onboarding_v1';
  const ACCOUNT_CHOICE='8apdf_account_prompt_v1';
  const nameKeys=['eightapdf_user_name_v2','eightapdf_user_name'];
  const read=key=>{for(const kind of ['localStorage','sessionStorage']){try{const v=window[kind].getItem(key);if(v)return v}catch{}}return ''};
  const write=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{}try{sessionStorage.setItem(key,value)}catch{}return false};
  window.initNameOnboarding=({onConfirm,onFinish})=>{
    const needsName=read(NAME_MARKER)!=='complete';
    const needsAccount=!read(ACCOUNT_CHOICE);
    if(!needsName&&!needsAccount)return false;
    const modal=document.getElementById('nameModal');
    const form=document.getElementById('nameForm');
    if(!modal||!form)return false;
    const input=document.getElementById('nameInput');
    const button=form.querySelector('button');
    const feedback=document.getElementById('nameFeedback');
    const previousFocus=document.activeElement;
    let submitting=false,finished=false;
    if(!document.getElementById('apOnboardingAccount')){
      const div=document.createElement('div');
      div.id='apOnboardingAccount';div.className='ap-onboard-composition';
      div.innerHTML=`<div class="ap-onboard-story">
        <p class="name-kicker">02 / Connected by choice</p>
        <h2>One space.<br><span>Every device.</span></h2>
        <p>Pick up exactly where you left off — at school, at home, or on the move.</p>
        <div class="ap-onboard-orbit" aria-hidden="true"><span></span><i></i><b></b></div>
      </div>
      <div class="ap-onboard-card">
        <p class="name-step">02 / Your account</p>
        <h2 id="apOnboardTitle">Make it yours, everywhere.</h2>
        <p class="ap-onboard-caption">Securely save your tasks, study progress, bookmarks and short links across devices.</p>
        <button type="button" class="ap-onboard-google ap-stagger-1" data-ap-onboard-google><span class="ap-g">G</span><span>Sign up with Google</span><span aria-hidden="true">↗</span></button>
        <button type="button" class="ap-onboard-google ap-secondary ap-stagger-2" data-ap-onboard-google><span class="ap-g">G</span><span>Log in with Google</span><span aria-hidden="true">↗</span></button>
        <div class="ap-onboard-separator ap-stagger-3"><span></span><em>OR</em><span></span></div>
        <button type="button" class="ap-onboard-guest ap-stagger-4" data-ap-onboard-guest>Continue without signing up <span aria-hidden="true">→</span></button>
        <p class="ap-onboard-feedback" id="apOnboardFeedback" data-account-status role="status" aria-live="polite">No account needed. You are always in control.</p>
      </div>`;
      modal.querySelector('.name-welcome').after(div);
      div.querySelectorAll('[data-ap-onboard-google]').forEach(b=>b.addEventListener('click',()=>{
        if(!window.__8apdfAccount?.login){div.querySelector('[data-account-status]').textContent='Account service is loading. Please try again.';return}
        window.__8apdfAccount.login();
      }));
      div.querySelector('[data-ap-onboard-guest]').addEventListener('click',()=>{
        if(window.__8apdfAccount?.continueGuest)window.__8apdfAccount.continueGuest();
        else{write(ACCOUNT_CHOICE,'guest');finish()}
      });
    }
    const accountStep=document.getElementById('apOnboardingAccount');
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
        window.__8apdfFinishAccountOnboarding=null;
        const target=previousFocus&&previousFocus!==document.body?previousFocus:document.getElementById('profileBtn');
        target?.focus({preventScroll:true});onFinish();
      },reduced()?0:280);
    }
    window.__8apdfFinishAccountOnboarding=finish;
    function showAccount(){
      modal.dataset.phase='auth';
      modal.setAttribute('aria-labelledby','apOnboardTitle');
      modal.setAttribute('aria-describedby','apOnboardFeedback');
      accountStep.querySelector('[data-ap-onboard-google]')?.focus({preventScroll:true});
    }
    document.body.classList.add('locked');
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
    if(!needsName){showAccount();return true}
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
      setTimeout(()=>{
        if(!needsAccount){finish();return}
        // Short cinematic interstitial before staggered account choices.
        showAccount();
      },reduced()?160:1050);
    });
    return true;
  };
})();
