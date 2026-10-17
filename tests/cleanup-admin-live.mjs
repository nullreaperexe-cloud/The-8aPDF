import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {SUPABASE_PROJECT_URL as u,SUPABASE_PUBLISHABLE_KEY as k} from '../supabase-materials.js';
const f=JSON.parse(readFileSync('.admin-test/credentials.json','utf8')),a=f.users.find(x=>x.role==='super_admin');
async function call(action,payload={}){const r=await fetch(u+'/functions/v1/admin-command',{method:'POST',headers:{apikey:k,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(35000)});const b=await r.json();assert(b.ok,action+': '+b.error);return b;}
const links=(await call('list',{table:'short_links',search:f.suffix,pageSize:100})).records;
for(const l of links){assert(l.slug.endsWith(f.suffix));await call('link_delete',{slug:l.slug,confirm:'DELETE '+l.slug});}
for(const table of ['study_materials','announcements'])for(const status of ['all','archived']){
  const rows=(await call('list',{table,status,search:f.suffix,pageSize:100})).records;
  for(let r of rows){assert(r.title.includes(f.suffix));if(!r.archived_at){const v=await call('bulk',{table,operation:'archive',items:[{id:r.id,version:r.version}],confirm:'ARCHIVE 1'});assert(v.results[0].ok,v.results[0].error);r=v.results[0].record;}
    const v=await call('bulk',{table,operation:'delete',items:[{id:r.id,version:r.version}],confirm:'DELETE 1'});assert(v.results[0].ok,v.results[0].error);
  }
}
const uploads=(await call('list',{table:'admin_uploads',pageSize:100})).records.filter(r=>r.actor_id===a.id&&!['deleted','pending'].includes(r.state));
for(const r of uploads)await call('storage_delete',{uploadId:r.id,confirm:'DELETE FILE'});
console.log(`Cleaned isolated fixtures only: ${links.length} links, ${uploads.length} files. Existing school data preserved.`);
