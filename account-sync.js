/* 8aPDF private Google account + per-user workspace sync. No service-role credentials in the browser. */
(() => {
  'use strict';
  const URL = 'https://xudhjwojgxblbsebkzso.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_fVH-3bHJHdIlCpiL31f1rw_tqWhgTP1';
  const CHOICE = '8apdf_account_prompt_v1';
  const LINK_KEYS = '8apdf_account_link_keys';
  const OWNER = '8apdf_short_links_owner_v1';
  const ACTIVE = '8apdf_active_account_uid_v1';
  const GUEST = '8apdf_guest_workspace_backup_v1';
  const TRACKED = [
    'eightapdf_user_name_v2','eightapdf_user_name',
    '8apdf_tasks_v1','8a_manual_tasks_v1','8a_auto_done_v1',
    '8apdf_ws_v4_custom_tasks','8apdf_ws_v4_task_done',
    '8apdf_ws_v4_preferences','8apdf_saved_v1','8apdf_recent_v1',
    '8apdf_selected_school_day_v1','8a_theme','8a_density','8a_motion',
    '8apdf_ui_mode_v1','8a_music','8apdf_classic_glass_settings_v2',
    '8apdf_term_choice_v2','8apdf_term_choice_v3','8apdf_completed_sessions_v1',
    '8apdf_focus_timer_v1','8apdf_ai_pdf_recent_queries_v1',
    '8apdf_background_music_v1','8apdf_skip_welcome',LINK_KEYS
  ];
  const ARRAY_KEYS = new Set(['8apdf_tasks_v1','8a_manual_tasks_v1','8apdf_ws_v4_custom_tasks','8apdf_saved_v1','8apdf_recent_v1',LINK_KEYS]);
  const MAP_KEYS = new Set(['8a_auto_done_v1','8apdf_ws_v4_task_done']);
  const get = key => {try {return localStorage.getItem(key)} catch {return null}};
  const set = (key,value) => {try {if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)} catch {}};
  const json = (value,fallback) => {try{return JSON.parse(value)}catch{return fallback}};
  const tokenValid = v => typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
  const validKeys = values => [...new Set((Array.isArray(values)?values:[]).filter(tokenValid))].slice(0,40);
  let client=null,user=null,started=false,syncBusy=false,last={},timer=0,overlay=null,firstSync=true;
  const account = window.__8apdfAccount = {
    open, login, continueGuest, signOut,
    get user(){return user},
    get ready(){return !!client},
    get loggedIn(){return !!user}
  };
  function api(){
    if(!client && window.supabase?.createClient){
      client=window.supabase.createClient(URL,PUBLISHABLE_KEY,{
        auth:{flowType:'pkce',detectSessionInUrl:true,autoRefreshToken:true,persistSession:true}
      });
    }
    return client;
  }
  function status(message,isError=false){
    document.querySelectorAll('[data-account-status]').forEach(node=>{
      node.textContent=message||'';node.style.color=isError?'#ff9b9b':'';
    });
  }
  function uniqueItems(a,b){
    const all=[...a,...b],seen=new Set(),result=[];
    for(const item of all){
      const id=typeof item==='object'&&item!==null?String(item.id??JSON.stringify(item)):String(item);
      if(seen.has(id))continue;seen.add(id);result.push(item);
    }
    return result.slice(0,500);
  }
  function mergeForFirstLogin(key,remote,local){
    if(local===null)return remote;
    if(remote===null)return local;
    if(key===LINK_KEYS)return JSON.stringify(validKeys([...json(remote,[]),...json(local,[])]));
    if(ARRAY_KEYS.has(key)){
      const a=json(remote,[]),b=json(local,[]);
      if(Array.isArray(a)&&Array.isArray(b))return JSON.stringify(uniqueItems(a,b));
    }
    if(MAP_KEYS.has(key)){
      const a=json(remote,{}),b=json(local,{});
      if(a&&b&&typeof a==='object'&&typeof b==='object')return JSON.stringify({...b,...a});
    }
    return remote; // Existing account is authoritative for scalar settings.
  }
  function snapshot(){const result={};for(const k of TRACKED)result[k]=get(k);return result}
  function same(a,b){return a===b}
  function eventRefresh(changed){
    document.dispatchEvent(new CustomEvent('8apdf:cloud-synced',{detail:{changed}}));
    document.dispatchEvent(new Event('8apdf:short-links-synced'));
  }
  async function synchronize(initial=false){
    if(syncBusy||!user||!api())return;
    syncBusy=true;let changed=false;
    try{
      const id=user.id;
      const {data,error}=await client.from('user_workspace_items').select('key,value').eq('user_id',id);
      if(error)throw error;
      const cloud=new Map((data||[]).filter(row=>TRACKED.includes(row.key)).map(row=>[row.key,row.value]));
      // Each browser's original owner key is preserved and added to the account's keyring.
      const currentOwner=get(OWNER);
      const serverKeys=json(cloud.get(LINK_KEYS),[]);
      const combined=validKeys([...serverKeys,...json(get(LINK_KEYS),[]),currentOwner]);
      if(combined.length){
        const encoded=JSON.stringify(combined);
        if(get(LINK_KEYS)!==encoded){set(LINK_KEYS,encoded);changed=true}
      }
      const changes=[];
      const local=snapshot();
      for(const key of TRACKED){
        const incoming=cloud.has(key)?cloud.get(key):null;
        const here=local[key];
        let next;
        if(initial)next=mergeForFirstLogin(key,incoming,here);
        else {
          const modified=here!==last[key];
          next=modified?here:(incoming===null?here:incoming);
          if(key===LINK_KEYS)next=JSON.stringify(validKeys([...json(incoming,[]),...json(next,[])]));
        }
        if(next!==here){set(key,next);changed=true}
        if(next!==null && !same(incoming,next))changes.push({user_id:id,key,value:next});
        last[key]=next;
      }
      if(changes.length){
        const {error:saveError}=await client.from('user_workspace_items').upsert(changes,{onConflict:'user_id,key'});
        if(saveError)throw saveError;
      }
      if(changed){
        eventRefresh(true);
        // Rebuild views whose old in-memory state was initialized before cloud hydration.
        if(firstSync && !sessionStorage.getItem('8apdf_account_reloaded_v1')){
          sessionStorage.setItem('8apdf_account_reloaded_v1','1');
          location.reload();
        }
      }else eventRefresh(false);
      firstSync=false;
      status(user.email?'Synced with '+user.email:'Your account is synced.');
    }catch(error){
      console.warn('8aPDF account sync:',error);
      status('Cloud sync unavailable. Your device data is still safe.',true);
    }finally{syncBusy=false}
  }
  async function signedIn(nextUser){
    const previous=user?.id;
    const active=get(ACTIVE);
    if(!active){
      try{localStorage.setItem(GUEST,JSON.stringify(snapshot()))}catch{}
    }else if(active!==nextUser.id){
      // Never merge another account's local data into this account.
      TRACKED.forEach(k=>set(k,null));
      set(LINK_KEYS,JSON.stringify(validKeys([get(OWNER)])));
    }
    set(ACTIVE,nextUser.id);
    user=nextUser;
    set(CHOICE,'account');
    if(previous!==user.id){
      firstSync=true;last={};
      if(previous && previous!==user.id)sessionStorage.removeItem('8apdf_account_reloaded_v1');
    }
    await synchronize(true);
    clearInterval(timer);
    timer=setInterval(()=>{if(!document.hidden)synchronize()},4500);
    close();
  }
  function signedOut(){
    if(get(ACTIVE)){
      const backup=json(get(GUEST),{});
      TRACKED.forEach(k=>set(k,typeof backup[k]==='string'?backup[k]:null));
      set(ACTIVE,null);
    }
    user=null;clearInterval(timer);firstSync=true;last={};
    sessionStorage.removeItem('8apdf_account_reloaded_v1');
  }
  async function login(){
    const supa=api();
    if(!supa){status('Account service is loading. Try again.',true);return}
    status('Checking Google sign-in availability...');
    try{
      // Check provider status before navigating; don't send students to a 400 error page.
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6000);
      let config=null;
      try{
        const response=await fetch(URL+'/auth/v1/settings',{
          headers:{apikey:PUBLISHABLE_KEY},cache:'no-store',signal:controller.signal
        });
        if(response.ok)config=await response.json();
      }catch{ /* A temporary settings outage should not permanently disable login. */ }
      finally{clearTimeout(timeout)}
      if(config?.external?.google===false || config?.external?.google==='false'){
        status('Google login is not enabled in Supabase yet. Please continue as guest until the site owner completes Google OAuth setup.',true);
        return;
      }
      status('Connecting securely with Google...');
      set(CHOICE,'account');
      const {error}=await supa.auth.signInWithOAuth({
        provider:'google',options:{redirectTo:location.origin+'/',queryParams:{prompt:'select_account'}}
      });
      if(error)throw error;
    }catch(e){set(CHOICE,'');status(e.message||'Google login could not start. Continue as guest and retry later.',true)}
  }
  function continueGuest(){
    set(CHOICE,'guest');close();
    if(typeof window.__8apdfFinishAccountOnboarding==='function')
      window.__8apdfFinishAccountOnboarding();
  }
  function markup(){
    return '<div class="ap-account-dialog" role="dialog" aria-modal="true" aria-label="8aPDF account">'+
      '<button type="button" data-account-close class="ap-close" aria-label="Close">×</button>'+
      '<p class="ap-eyebrow">8aPDF · YOUR SPACE</p><h2>Your study space,<br>everywhere.</h2>'+
      '<p class="ap-sub">Sign in once and keep your tasks, saved PDFs, short links and preferences together across devices.</p>'+
      '<div class="ap-signed" hidden><span data-account-email></span><button type="button" data-account-signout>Sign out</button></div>'+
      '<div class="ap-unsigned">'+
      '<button type="button" class="ap-google" data-account-login><span class="ap-google-mark">G</span><span>Continue with Google</span><span>↗</span></button>'+
      '<button type="button" class="ap-guest" data-account-guest>Continue without signing in</button></div>'+
      '<p class="ap-status" data-account-status role="status" aria-live="polite"></p>'+
      '<p class="ap-fine">Optional, secure and powered by Supabase. Guest progress stays on this device.</p>'+
      '</div>';
  }
  function close(){if(!overlay)return;overlay.hidden=true;document.body.classList.remove('ap-account-open');}
  function open(){
    if(!overlay){
      overlay=document.createElement('div');overlay.id='apAccountOverlay';overlay.className='ap-account-overlay';
      overlay.hidden=true;overlay.innerHTML=markup();document.body.append(overlay);
      overlay.addEventListener('click',e=>{
        if(e.target===overlay||e.target.closest('[data-account-close]'))close();
        if(e.target.closest('[data-account-login]'))login();
        if(e.target.closest('[data-account-guest]'))continueGuest();
        if(e.target.closest('[data-account-signout]'))signOut();
      });
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
    }
    overlay.querySelector('.ap-signed').hidden=!user;
    overlay.querySelector('.ap-unsigned').hidden=!!user;
    overlay.querySelector('[data-account-email]').textContent=user?.email||'Signed in';
    overlay.hidden=false;
    document.body.classList.add('ap-account-open');
    overlay.querySelector(user?'[data-account-signout]':'[data-account-login]').focus();
  }
  async function signOut(){
    if(!client)return;
    // Restore the pre-login guest workspace rather than expose the signed-in account.
    const {error}=await client.auth.signOut();
    if(error){status('Could not sign out. Try again.',true);return}
    set(CHOICE,'guest');signedOut();close();
    location.reload();
  }
  async function init(){
    if(started)return;started=true;
    if(!api()){console.warn('8aPDF: Supabase browser library unavailable');status('Sign in unavailable; continue as guest.',true);return}
    const {data,error}=await client.auth.getSession();
    if(error)console.warn('8aPDF session:',error.message);
    if(data?.session?.user)await signedIn(data.session.user);
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT')signedOut();
      else if(event==='SIGNED_IN'&&session?.user&&session.user.id!==user?.id){
        setTimeout(()=>signedIn(session.user),0);
      }
    });
    if(location.hash.includes('error=')){
      status('Google sign in was cancelled or blocked. You can continue without an account.',true);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
