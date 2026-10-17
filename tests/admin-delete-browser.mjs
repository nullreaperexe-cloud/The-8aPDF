// Opt-in regression using prepare-admin-live.mjs fixtures. Never targets real
// school records for deletion; only UUIDs returned by this run are selected.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {SUPABASE_PROJECT_URL as origin,SUPABASE_PUBLISHABLE_KEY as key} from '../supabase-materials.js';
const fixture=JSON.parse(readFileSync('.admin-test/credentials.json','utf8'));
const admin=fixture.users.find(u=>u.role==='super_admin');
const base=process.env.ADMIN_BASE_URL||'http://127.0.0.1:3000';
const created={study_materials:[],announcements:[]},checks=[];
async function call(action,payload={}){
  const response=await fetch(origin+'/functions/v1/admin-command',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+admin.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(35000)});
  const body=await response.json();assert(body.ok,body.error);return body;
}
async function exists(table,id){return (await call('export',{table,ids:[id]})).records.length>0;}
async function publicExists(table,id){const response=await fetch(origin+'/rest/v1/'+table+'?select=id&id=eq.'+id,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return (await response.json()).length>0;}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const source=(await call('list',{table:'study_materials',status:'published',pageSize:1})).records[0];assert(source,'Published PDF required for an isolated reference copy');
  for(let i=0;i<3;i++){
    let copy=(await call('duplicate',{table:'study_materials',id:source.id,confirm:'DUPLICATE'})).record;created.study_materials.push(copy.id);
    copy=(await call('save',{table:'study_materials',id:copy.id,version:copy.version,data:{title:`Delete regression ${fixture.suffix} PDF ${i}`,published:i!==1}})).record;
    const notice=(await call('save',{table:'announcements',data:{title:`Delete regression ${fixture.suffix} announcement ${i}`,original_message:'Temporary deletion verification',published:i!==1}})).record;created.announcements.push(notice.id);
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/admin');await page.locator('[name=email]').fill(admin.email);await page.locator('[name=password]').fill(admin.password);await page.getByRole('button',{name:'Sign in securely'}).click();await page.getByRole('heading',{name:'A clearer view.'}).waitFor({timeout:35000});
  for(const [table,route]of [['study_materials','library'],['announcements','announcements']]){
    const ids=created[table];await page.locator(`[data-nav="${route}"]`).click();await page.locator('#search').waitFor();await page.locator('#search').fill(fixture.suffix);
    await page.locator(`[data-row="menu"][data-id="${ids[0]}"]`).waitFor({timeout:35000});
    await page.locator(`[data-row="menu"][data-id="${ids[0]}"]`).click();await page.getByRole('button',{name:'Permanently delete',exact:true}).click();
    assert.equal(await page.locator('#confirm-ok').isDisabled(),true);await page.locator('#confirm-cancel').click();assert(await exists(table,ids[0]));checks.push(table+': cancelling deletion keeps the active record');
    await page.locator(`[data-row="menu"][data-id="${ids[0]}"]`).click();await page.getByRole('button',{name:'Permanently delete',exact:true}).click();
    const single=page.waitForResponse(response=>response.url().includes('/admin-command')&&response.request().postData()?.includes('"operation":"delete"'));
    await page.locator('#confirmation-text').fill('DELETE 1');await page.locator('#confirm-ok').click();const singleResult=await(await single).json();assert(singleResult.results[0].ok,singleResult.results[0].error);
    assert.equal(await exists(table,ids[0]),false);assert.equal(await publicExists(table,ids[0]),false);checks.push(table+': row menu deletes a published active record without archiving');
    await page.locator(`[data-select="${ids[0]}"]`).waitFor({state:'detached'});
    for(const id of ids.slice(1))await page.locator(`[data-select="${id}"]`).check();
    await page.locator('[data-action="bulk:delete"]').click();const batch=page.waitForResponse(response=>response.url().includes('/admin-command')&&response.request().postData()?.includes('"operation":"delete"'));
    await page.locator('#confirmation-text').fill('DELETE 2');await page.locator('#confirm-ok').click();const batchResult=await(await batch).json();assert(batchResult.results.every(result=>result.ok),JSON.stringify(batchResult.results));
    for(const id of ids.slice(1)){assert.equal(await exists(table,id),false);assert.equal(await publicExists(table,id),false);}checks.push(table+': batch deletes active draft and published records');
  }
  assert.deepEqual(errors,[]);checks.push('No uncaught browser exceptions');
  await page.screenshot({path:'.admin-test/delete-regression-'+(base.startsWith('http://127')?'local':'production')+'.png'});
}finally{
  // Exact test IDs only; shared PDF storage objects remain untouched.
  for(const [table,ids]of Object.entries(created))for(const id of ids){const row=(await call('export',{table,ids:[id]})).records?.[0];if(row){const result=await call('bulk',{table,operation:'delete',items:[{id,version:row.version}],confirm:'DELETE 1'});assert(result.results[0].ok,result.results[0].error);}}
  await browser.close();writeFileSync('.admin-test/delete-regression-report.json',JSON.stringify({base,checks,created},null,2));
}
for(const check of checks)console.log('PASS '+check);
