// Opt-in live tests. Run prepare-admin-live.mjs and apply its isolated fixture SQL
// first. All created library records/files/aliases are removed in finally.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {SUPABASE_PROJECT_URL as origin,SUPABASE_PUBLISHABLE_KEY as key} from '../supabase-materials.js';
const fixture=JSON.parse(readFileSync('.admin-test/credentials.json','utf8'));
const admin=fixture.users.find(u=>u.role==='super_admin'),ordinary=fixture.users.find(u=>u.role==='ordinary');
const created={pdfs:new Set(),announcements:new Set(),links:new Set(),uploads:new Set()},checks=[];
const edge=origin+'/functions/v1/admin-command';
const headers=token=>({apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})});
async function call(action,payload={},token=admin.session.access_token){const r=await fetch(edge,{method:'POST',headers:headers(token),body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(35000)});const b=await r.json();return {...b,http:r.status};}
async function good(action,payload={}){const r=await call(action,payload);assert.equal(r.ok,true,action+': '+r.error);return r;}
async function step(name,fn){await fn();checks.push({name,status:'passed'});console.log('PASS '+name);}
export function pdfBytes(text='8aPDF isolated integration verification'){
  const stream=`BT /F1 16 Tf 40 740 Td (${text}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let out='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
async function upload(id,payload,details={},extra={}){
  const form=new FormData();form.set('file',new File([payload],'verification.pdf',{type:'application/pdf'}));form.set('uploadId',id);form.set('table',extra.table||'study_materials');form.set('metadata',JSON.stringify({title:'Temporary admin verification '+fixture.suffix,subject:'Verification',published:true,source_date:'2026-10-17',...details}));if(extra.recordId){form.set('recordId',extra.recordId);form.set('recordVersion',String(extra.version));}
  const r=await fetch(edge,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+admin.session.access_token},body:form});const lines=(await r.text()).trim().split('\n').map(s=>JSON.parse(s));return {...lines.at(-1),stages:lines.filter(x=>x.stage).map(x=>x.stage),http:r.status};
}
async function publicRows(table,id){const r=await fetch(origin+'/rest/v1/'+table+'?select=*&id=eq.'+encodeURIComponent(id),{headers:{apikey:key}});assert.equal(r.status,200);return r.json();}
let pdf,copyRecord,announcement,uploadId;
try{
  await step('anonymous, invalid-token and non-admin requests are rejected',async()=>{
    assert.equal((await call('overview',{},null)).http,401);assert.equal((await call('overview',{},'invalid')).http,401);
    for(const action of ['session','overview','save','bulk','duplicates'])assert.equal((await call(action,{},ordinary.session.access_token)).http,403);
    const r=await fetch(edge,{method:'POST',headers:{...headers(admin.session.access_token),Origin:'https://evil.example'},body:'{"action":"overview"}'});assert.equal(r.status,403);
  });
  await step('approved role and paginated real records are returned',async()=>{
    assert.equal((await good('session')).role,'super_admin');
    const first=await good('list',{table:'study_materials',pageSize:7,page:1}),second=await good('list',{table:'study_materials',pageSize:7,page:2});
    assert.equal(first.records.length,7);assert.equal(second.records.length,7);assert(!first.records.some(x=>second.records.some(y=>y.id===x.id)));assert(first.total>=40);
    const d=await good('overview');assert(d.pdfs>=40);assert(d.announcements>=97);
  });
  await step('invalid PDF rejected; real PDF uploaded, verified, saved and publicly readable',async()=>{
    const invalid=await upload(randomUUID(),Buffer.from('not pdf'));assert.equal(invalid.ok,false);assert.match(invalid.error,/complete PDF/);
    uploadId=randomUUID();created.uploads.add(uploadId);const result=await upload(uploadId,pdfBytes());assert.equal(result.ok,true,result.error);pdf=result.record;created.pdfs.add(pdf.id);
    assert.deepEqual(result.stages,['validating','uploading','link','saving','publishing','ready']);assert.equal(pdf.pdf_url,origin+'/storage/v1/object/public/study-pdfs/'+pdf.storage_path);assert(pdf.inserted_at);assert.equal(pdf.file_checksum.length,64);
    const file=await fetch(pdf.pdf_url);assert.equal(file.status,200);assert((await file.text()).startsWith('%PDF-'));assert.equal((await publicRows('study_materials',pdf.id)).length,1);
  });
  await step('retry is idempotent and identical PDFs reuse their existing library record',async()=>{
    const retry=await upload(uploadId,pdfBytes());assert.equal(retry.ok,true,retry.error);assert.equal(retry.record.id,pdf.id);
    const dup=await upload(randomUUID(),pdfBytes());assert.equal(dup.ok,true,dup.error);assert.equal(dup.record.id,pdf.id);assert.equal(dup.reusedRecord,true);created.uploads.add(dup.uploadId);
  });
  await step('Storage, EduSecure and Image2URL PDFs use the same record validation; slug collisions rejected',async()=>{
    const slug='verify-'+fixture.suffix;created.links.add(slug);
    const result=await good('link_create',{documentId:pdf.id,pdfUrl:pdf.pdf_url,slug});assert.equal(result.record.url,pdf.pdf_url);
    assert.equal((await call('link_create',{documentId:pdf.id,slug})).http,409);
    assert.equal((await call('link_create',{documentId:pdf.id,pdfUrl:'https://attacker.example/payload.pdf',slug:'bad-'+fixture.suffix})).http,422);
    const publicLink=await fetch(origin+'/functions/v1/apdf_short_links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resolve',slug})});assert.equal(publicLink.status,200);assert.equal((await publicLink.json()).url,pdf.pdf_url);
    const edu=(await good('list',{table:'study_materials',search:'edusecure',status:'published',pageSize:100})).records;
    const all=(await good('list',{table:'study_materials',status:'published',pageSize:100})).records;
    for(const [prefix,predicate] of [['edu',r=>r.pdf_url.includes('edusecure.org')],['image',r=>r.pdf_url.includes('image2url')]]){
      const row=all.find(predicate);if(!row){checks.push({name:prefix+' live source eligibility',status:'unavailable: no published record of this host'});continue;}
      const s=prefix+'-'+fixture.suffix;created.links.add(s);assert.equal((await good('link_create',{documentId:row.id,pdfUrl:row.pdf_url,slug:s})).record.url,row.pdf_url);
    }
    assert.equal((await good('link_health',{slug})).accessible,true);
    const owned='owned-'+fixture.suffix,ownerKey=randomBytes(32).toString('hex');created.links.add(owned);
    const student=async payload=>{const response=await fetch(origin+'/functions/v1/apdf_short_links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});return {http:response.status,body:await response.json()};};
    assert.equal((await student({action:'create',slug:owned,ownerKey,documentId:pdf.id,pdfUrl:pdf.pdf_url})).http,201);
    assert.equal((await student({action:'delete',slug:owned,ownerKey:randomBytes(32).toString('hex')})).http,403);
    assert.equal((await student({action:'delete',slug:owned,ownerKey})).http,200);created.links.delete(owned);
  });
  await step('metadata edits persist and stale versions fail without overwriting',async()=>{
    const result=await good('save',{table:'study_materials',id:pdf.id,version:pdf.version,data:{title:'Verified admin edit '+fixture.suffix,chapter:'Review',class_name:'8A'}});const before=pdf;pdf=result.record;
    assert.equal(pdf.version,before.version+1);assert.equal((await publicRows('study_materials',pdf.id))[0].title,pdf.title);
    assert.equal((await call('save',{table:'study_materials',id:pdf.id,version:before.version,data:{title:'Must not overwrite'}})).http,409);
    assert.equal((await call('save',{table:'study_materials',id:pdf.id,version:pdf.version,data:{pdf_url:'https://different.example/a.pdf'}})).http,422);
  });
  await step('duplicate manager recommends the oldest insertion and performs no automatic deletion',async()=>{
    copyRecord=(await good('duplicate',{table:'study_materials',id:pdf.id,confirm:'DUPLICATE'})).record;created.pdfs.add(copyRecord.id);
    const scan=await good('duplicates',{strictness:'exact'}),g=scan.groups.find(g=>g.records.some(r=>r.id===copyRecord.id));assert(g);assert.equal(g.confidence,'confirmed');assert.equal(g.records[0].id,pdf.id);assert(g.records[0].links.length);assert.equal((await publicRows('study_materials',pdf.id)).length,1);
    await good('ignore',{groupKey:g.id});assert(!(await good('duplicates',{strictness:'exact'})).groups.some(x=>x.id===g.id));await good('ignore',{groupKey:g.id,restore:true});
    const published=await good('bulk',{table:'study_materials',operation:'publish',items:[{id:copyRecord.id,version:copyRecord.version}]});assert(published.results[0].ok,published.results[0].error);copyRecord=published.results[0].record;
    const slug='verify-'+fixture.suffix;assert((await good('link_candidates',{slug})).records.some(r=>r.id===copyRecord.id));
    const transferred=await good('link_transfer',{slug,documentId:copyRecord.id,confirm:'TRANSFER'});assert.equal(transferred.record.url,pdf.pdf_url);assert.equal(transferred.record.document_id,copyRecord.id);
    await good('link_transfer',{slug,documentId:pdf.id,confirm:'TRANSFER'});
  });
  await step('archive hides public records, restore recovers them, and referenced files cannot be removed',async()=>{
    let r=await good('bulk',{table:'study_materials',operation:'archive',items:[{id:pdf.id,version:pdf.version}],confirm:'ARCHIVE 1'});assert(r.results[0].ok,r.results[0].error);pdf=r.results[0].record;
    assert.equal((await publicRows('study_materials',pdf.id)).length,0);
    assert.equal((await call('storage_delete',{uploadId,confirm:'DELETE FILE'})).http,422);
    r=await good('bulk',{table:'study_materials',operation:'restore',items:[{id:pdf.id,version:pdf.version}]});assert(r.results[0].ok,r.results[0].error);pdf=r.results[0].record;assert.equal(pdf.published,true);assert.equal((await publicRows('study_materials',pdf.id)).length,1);
  });
  await step('announcement create/edit/publish, attachment upload and replacement, archive/restore',async()=>{
    announcement=(await good('save',{table:'announcements',data:{title:'Temporary announcement verification '+fixture.suffix,description:'Integration check',original_message:'A complete verification message',category:'General',subject:'Verification',message_date:'2026-10-17',priority:'normal',published:false}})).record;created.announcements.add(announcement.id);assert.equal((await publicRows('announcements',announcement.id)).length,0);
    announcement=(await good('save',{table:'announcements',id:announcement.id,version:announcement.version,data:{published:true,original_message:'Updated full message'}})).record;assert.equal((await publicRows('announcements',announcement.id))[0].original_message,'Updated full message');
    const id=randomUUID();created.uploads.add(id);let result=await upload(id,pdfBytes('Announcement attachment'),{title:announcement.title,original_message:'Attached message',message_date:'2026-10-17'},{table:'announcements',recordId:announcement.id,version:announcement.version});assert(result.ok,result.error);announcement=result.record;assert(announcement.attachment_url.includes(id));
    let r=await good('bulk',{table:'announcements',operation:'archive',items:[{id:announcement.id,version:announcement.version}],confirm:'ARCHIVE 1'});assert(r.results[0].ok,r.results[0].error);announcement=r.results[0].record;assert.equal((await publicRows('announcements',announcement.id)).length,0);
    r=await good('bulk',{table:'announcements',operation:'restore',items:[{id:announcement.id,version:announcement.version}]});assert(r.results[0].ok,r.results[0].error);announcement=r.results[0].record;assert.equal((await publicRows('announcements',announcement.id)).length,1);
  });
  await step('batches report failures per record and require explicit destructive confirmation',async()=>{
    assert.equal((await call('bulk',{table:'study_materials',operation:'delete',items:[{id:pdf.id,version:pdf.version}]})).http,422);
    const r=await good('bulk',{table:'study_materials',operation:'subject',value:'Verification',items:[{id:pdf.id,version:pdf.version},{id:'missing-'+fixture.suffix,version:1}]});assert.equal(r.results.length,2);assert.equal(r.results[0].ok,true);assert.equal(r.results[1].ok,false);pdf=r.results[0].record;
    assert.equal((await good('export',{table:'study_materials',ids:[pdf.id]})).records.length,1);
  });
  await step('RLS blocks direct public writes, storage uploads, role escalation and private audit reads',async()=>{
    for(const table of ['study_materials','announcements','admin_users','short_links']){const r=await fetch(origin+'/rest/v1/'+table,{method:'POST',headers:headers(ordinary.session.access_token),body:JSON.stringify(table==='admin_users'?{user_id:ordinary.id,role:'super_admin'}:{id:'unauthorized-'+fixture.suffix,title:'Denied'})});assert([400,401,403].includes(r.status),table+': '+r.status);}
    for(const table of ['admin_users','short_links','admin_audit_logs','admin_uploads']){const r=await fetch(origin+'/rest/v1/'+table+'?select=*',{headers:{apikey:key}});assert([401,403].includes(r.status),table+': '+r.status);}
    const r=await fetch(origin+'/storage/v1/object/study-pdfs/denied-'+fixture.suffix+'.pdf',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+ordinary.session.access_token,'Content-Type':'application/pdf'},body:pdfBytes()});assert([400,401,403].includes(r.status));
    const rpc=await fetch(origin+'/rest/v1/rpc/admin_gate',{method:'POST',headers:headers(ordinary.session.access_token),body:JSON.stringify({p_actor:admin.id,p_session:randomUUID(),p_write:false})});assert.equal(rpc.status,403);
  });
  await step('referenced files cannot be removed, and preferences are scoped to the verified administrator',async()=>{
    assert.equal((await call('storage_delete',{uploadId,confirm:'DELETE FILE'})).http,422);
    await good('preferences',{preferences:{theme:'dark',duplicateStrictness:'balanced',defaultPublished:false,notifications:true,reducedMotion:false,defaultSubject:''}});
    assert.equal((await good('session')).preferences.theme,'dark');assert.equal((await call('preferences',{preferences:{theme:'root'}})).http,422);
    const logs=await good('list',{table:'admin_audit_logs',search:pdf.id,pageSize:100});assert(logs.records.some(l=>l.action==='created'&&l.actor_id===admin.id));assert(logs.records.every(l=>!('owner_hash'in(l.before_data||{}))));
  });
}catch(e){checks.push({name:'run',status:'failed',error:e.message});console.error('FAIL '+e.message);process.exitCode=1;}
finally{
  for(const slug of created.links){const r=await call('link_delete',{slug,confirm:'DELETE '+slug});if(!r.ok&&r.http!==404)console.error('Cleanup link:',slug,r.error);}
  for(const [table,ids]of [['study_materials',created.pdfs],['announcements',created.announcements]])for(const id of ids){
    // Search targets human content, so use selected export to retrieve the exact
    // version without depending on record title or current archive status.
    const current=(await call('export',{table,ids:[id]})).records?.[0];if(!current)continue;
    let r=current;
    if(!r.archived_at){const a=await call('bulk',{table,operation:'archive',items:[{id,version:r.version}],confirm:'ARCHIVE 1'});if(!a.results?.[0]?.ok){console.error('Cleanup archive:',id,a.error||a.results?.[0]?.error);continue;}r=a.results[0].record;}
    const d=await call('bulk',{table,operation:'delete',items:[{id,version:r.version}],confirm:'DELETE 1'});if(!d.results?.[0]?.ok)console.error('Cleanup delete:',id,d.error||d.results?.[0]?.error);
  }
  for(const id of created.uploads){const r=await call('storage_delete',{uploadId:id,confirm:'DELETE FILE'});if(!r.ok)console.error('Cleanup storage:',id,r.error);}
  writeFileSync('.admin-test/live-report.json',JSON.stringify({checks,created:{pdfs:[...created.pdfs],announcements:[...created.announcements],uploads:[...created.uploads],links:[...created.links]}},null,2));
  console.log('Live verification report saved locally. Test identities must be removed after browser verification.');
}
