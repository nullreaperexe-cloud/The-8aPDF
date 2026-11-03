// Dedicated 8aPDF Calendar project: authenticated GitHub Actions OIDC publisher.
// Deploy with verify_jwt=false: jose validates GitHub's signed OIDC token below.
// Never accept caller-supplied school dates, holidays, paths or project IDs.
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@5.9.6';

const REPO='nullreaperexe-cloud/The-8aPDF';
const WORKFLOW=REPO+'/.github/workflows/edusecure-holiday-calendar.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const JSON_HEADERS={'content-type':'application/json'};
function response(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
}
async function readJSON(url:string){
  const r=await fetch(url,{headers:{Accept:'application/json','Cache-Control':'no-cache'}});
  if(!r.ok)throw Error('Trusted GitHub source unavailable: '+r.status);
  return await r.json();
}
async function putRows(path:string,rows:unknown[]){
  const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key)throw Error('Supabase function secret configuration missing');
  const r=await fetch(base+'/rest/v1/'+path,{
    method:'POST',
    headers:{
      apikey:key,Authorization:'Bearer '+key,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=minimal'
    },
    body:JSON.stringify(rows)
  });
  if(!r.ok)throw Error('Supabase publish failed: '+r.status);
}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return response({error:'Method not allowed'},405);
  const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!bearer)return response({error:'GitHub OIDC token required'},401);
  try{
    const {payload}=await jwtVerify(bearer,JWKS,{
      issuer:'https://token.actions.githubusercontent.com',
      audience:'8apdf-calendar-sync',
    });
    if(payload.repository!==REPO||payload.ref!=='refs/heads/main'||
       payload.workflow_ref!==WORKFLOW||
       !['schedule','workflow_dispatch','push'].includes(String(payload.event_name)))
      return response({error:'Unauthorized workflow'},403);
  }catch{return response({error:'Invalid GitHub identity'},401)}
  try{
    // Resolve main to one immutable revision; fetch metadata + days atomically.
    const head=await readJSON('https://api.github.com/repos/'+REPO+'/commits/main');
    const sha=String(head.sha||'');
    if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid GitHub revision');
    const root='https://raw.githubusercontent.com/'+REPO+'/'+sha+'/';
    const [config,generated]=await Promise.all([
      readJSON(root+'data/school-calendar.json'),
      readJSON(root+'data/school-calendar-days.json')
    ]);
    if(config.timeZone!=='Asia/Kolkata'||JSON.stringify(config.weeklyOff)!=='[0]'||
       JSON.stringify(config.saturdayOff)!=='[2,4]'||
       !config.anchor?.date||!Array.isArray(config.holidays))
      throw Error('Invalid school cycle or closure rules');
    if(config.holidays.some((h:{source?:string})=>!String(h.source||'').startsWith('edusecure-holiday-banner')))
      throw Error('Unverified school holiday source');
    if(!Array.isArray(generated.dates)||!generated.dates.length||
       generated.dates.length>800||generated.start!==config.start||
       generated.end!==config.end||generated.timeZone!=='Asia/Kolkata'||
       generated.dates[0]?.date!==config.start||
       generated.dates.at(-1)?.date!==config.end)
      throw Error('Incomplete authoritative date snapshot');
    const now=new Date().toISOString();
    const rows=generated.dates.map((d:{
      date:string;schoolDay:number|null;holiday:boolean;reason:string;
      nextDate:string;nextDay:number
    })=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||
         !/^\d{4}-\d{2}-\d{2}$/.test(d.nextDate)||
         typeof d.holiday!=='boolean'||
         (d.holiday?d.schoolDay!==null:!(d.schoolDay>=1&&d.schoolDay<=6))||
         !(d.nextDay>=1&&d.nextDay<=6))
        throw Error('Malformed date row');
      return {
        date:d.date,school_day:d.schoolDay,holiday:d.holiday,
        reason:d.reason||'',next_date:d.nextDate,next_day:d.nextDay,
        published_at:now
      };
    });
    // Publish all date rows first. Readers continue using prior snapshot until done.
    for(let i=0;i<rows.length;i+=200)
      await putRows('calendar_days?on_conflict=date',rows.slice(i,i+200));
    await putRows('calendar_state?on_conflict=key',[{
      key:'current',config,source_revision:sha,published_at:now
    }]);
    return response({ok:true,revision:sha,dates:rows.length,holidays:config.holidays.length});
  }catch(e){
    console.error('Calendar publishing blocked:',e instanceof Error?e.message:'unknown error');
    return response({error:'Calendar publish failed; previous verified data retained'},503);
  }
});
