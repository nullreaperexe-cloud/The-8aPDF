import { SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY } from '../supabase-materials.js';
export const EDGE = SUPABASE_PROJECT_URL + '/functions/v1/admin-command';
const KEY = '8apdf_admin_session_v1';
let session;
try { session = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { session = null; }
let refreshPromise;
function store(value) { session = value; if (value) sessionStorage.setItem(KEY, JSON.stringify(value)); else sessionStorage.removeItem(KEY); }
export async function authCall(path, data, token) {
  const res = await fetch(SUPABASE_PROJECT_URL + '/auth/v1/' + path, { method:'POST', headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})}, body:JSON.stringify(data || {}) });
  const text=await res.text();let body={};try{body=text?JSON.parse(text):{};}catch{throw Error('Authentication returned an invalid response. Retry in a moment.');}
  if (!res.ok) throw Object.assign(new Error(body.msg || body.error_description || body.message || 'Authentication failed.'),{status:res.status});
  return body;
}
export async function login(email,password) {
  const result = await authCall('token?grant_type=password',{email,password});
  store({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in});
  return session;
}
export async function signup(email,password) { return authCall('signup?redirect_to='+encodeURIComponent(location.origin+'/admin'),{email,password}); }
export async function recover(email) { return authCall('recover?redirect_to='+encodeURIComponent(location.origin+'/admin'),{email}); }
export function authCallback() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('access_token')) {
    store({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});
    const recovery=hash.get('type')==='recovery'; history.replaceState(null,'','/admin'); return recovery;
  }
  if (hash.has('error_description')) { const message=hash.get('error_description'); history.replaceState(null,'','/admin'); throw Error(message); }
  return false;
}
export async function accessToken() {
  if (!session?.access_token) throw Object.assign(Error('Sign in to continue.'),{status:401});
  if (Number(session.expires_at) <= Date.now()/1000+60) {
    if (!refreshPromise) refreshPromise = authCall('token?grant_type=refresh_token',{refresh_token:session.refresh_token})
      .then(r=>store({...r,expires_at:Math.floor(Date.now()/1000)+r.expires_in})).catch(e=>{store(null);throw Object.assign(e,{status:401});}).finally(()=>{refreshPromise=null;});
    await refreshPromise;
  }
  return session.access_token;
}
export async function logout() { try { if (session) await authCall('logout?scope=local',{},await accessToken()); } finally { store(null); } }
export async function changePassword(password) {
  const res = await fetch(SUPABASE_PROJECT_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},body:JSON.stringify({password})});
  const result=await res.json(); if(!res.ok)throw Error(result.msg||result.message||'Password update failed.');
}
export async function api(action,payload={},signal) {
  const res=await fetch(EDGE,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
  let result; try {result=await res.json();}catch{throw Error('The server did not return a valid response. Check your connection and retry.');}
  if(!res.ok||!result.ok)throw Object.assign(Error(result.error||'Request failed.'),{status:res.status});
  return result;
}
export async function uploadFile(job,metadata,callbacks) {
  const token=await accessToken(),form=new FormData();
  if(job.file)form.set('file',job.file); form.set('uploadId',job.id);form.set('table',job.table||'study_materials');form.set('metadata',JSON.stringify(metadata));
  if(job.recordId){form.set('recordId',job.recordId);form.set('recordVersion',String(job.version));}
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();callbacks.controller(xhr);
    xhr.open('POST',EDGE);xhr.setRequestHeader('apikey',SUPABASE_PUBLISHABLE_KEY);xhr.setRequestHeader('Authorization','Bearer '+token);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)callbacks.progress(Math.round(e.loaded/e.total*100));};
    xhr.upload.onload=()=>callbacks.stage('validating');
    let received=0,buffer='';
    xhr.onprogress=()=>{
      buffer+=xhr.responseText.slice(received);received=xhr.responseText.length;
      const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines)try{const value=JSON.parse(line);if(value.stage)callbacks.stage(value.stage);}catch{}
    };
    xhr.onload=()=>{
      try{
        const lines=xhr.responseText.trim().split('\n'),r=JSON.parse(lines.at(-1));
        if(xhr.status<200||xhr.status>=300||!r.ok)throw Object.assign(Error(r.error||'Upload failed.'),{status:xhr.status});resolve(r);
      }catch(e){reject(e);}
    };
    xhr.onerror=()=>reject(Error('Connection interrupted. Retry this upload; its UUID prevents duplicate records.'));
    xhr.onabort=()=>reject(Error('Transfer cancelled. Check Storage before retrying; the server may have finished saving.'));
    xhr.timeout=180000;xhr.ontimeout=()=>reject(Error('Upload timed out. Check Storage and retry the same queued file.'));
    xhr.send(form);
  });
}
