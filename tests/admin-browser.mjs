// Browser tests use the real Supabase backend and isolated test identities.
// Run only after prepare-admin-live.mjs has been provisioned by the DB owner.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SUPABASE_PROJECT_URL as origin,SUPABASE_PUBLISHABLE_KEY as key} from '../supabase-materials.js';
const f=JSON.parse(readFileSync('.admin-test/credentials.json','utf8')),admin=f.users.find(x=>x.role==='super_admin'),ordinary=f.users.find(x=>x.role==='ordinary');
const base=process.env.ADMIN_BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[],artifacts={pdfs:[],announcements:[],uploads:[],links:[]},errors=[];
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% '+randomUUID()+'\n%%EOF\n');
async function login(page,user){await page.goto(base+'/admin');await page.getByRole('heading',{name:'Welcome back.'}).waitFor();await page.locator('[name=email]').fill(user.email);await page.locator('[name=password]').fill(user.password);await page.getByRole('button',{name:'Sign in securely'}).click();}
async function noOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' body overflow');}
async function direct(action,payload={}){const r=await fetch(origin+'/functions/v1/admin-command',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+admin.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(35000)});const b=await r.json();if(!b.ok)throw Error(action+': '+b.error);return b;}
const routes=[['library','Your PDF library.'],['announcements','School announcements.'],['duplicates','Clarity, without the clutter.'],['links','Link Manager.'],['storage','Your storage, accounted for.'],['activity','Every action has a story.'],['settings','A workspace that works for you.'],['upload','Make room for something new.']];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await login(page,admin);await page.getByRole('heading',{name:'A clearer view.'}).waitFor({timeout:35000});await noOverflow(page,'desktop dashboard');
  await page.screenshot({path:'.admin-test/dashboard-desktop.png',fullPage:true});
  for(const [route,heading]of routes){await page.locator(`[data-nav="${route}"]`).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:35000});await noOverflow(page,route);if(['library','upload','duplicates'].includes(route))await page.screenshot({path:'.admin-test/'+route+'-desktop.png',fullPage:true});}
  report.push({name:'Desktop navigation: all nine sections render with real API responses',status:'passed'});
  await page.locator('[data-nav="library"]').click();await page.locator('#search').waitFor();await page.locator('#search').fill('Student');await page.waitForResponse(async r=>r.url().includes('/admin-command')&&r.request().postData()?.includes('"search":"Student"'));await page.waitForFunction(()=>document.querySelector('#search')?.value==='Student'&&document.querySelector('tbody tr'));
  await page.locator('#sort-filter').selectOption('oldest');await page.waitForResponse(r=>r.url().includes('/admin-command')&&r.request().postData()?.includes('"sort":"oldest"'));report.push({name:'Server-side library search and sort controls',status:'passed'});
  await page.locator('[data-nav="upload"]').click();await page.locator('#file-input').setInputFiles({name:'Browser-verification-'+f.suffix+'.pdf',mimeType:'application/pdf',buffer:pdf});
  const form=page.locator('[data-job-form]');await form.locator('[name=title]').fill('Browser upload verification '+f.suffix);await form.locator('[name=subject]').fill('Verification');await form.locator('[name=source_date]').fill('2026-10-17');await form.locator('[name=published]').check();await form.locator('[name=short_slug]').fill('browser-'+f.suffix);
  const uploadResponse=page.waitForResponse(r=>r.url().includes('/admin-command')&&r.request().headers()['content-type']?.includes('multipart/form-data'));
  await form.getByRole('button',{name:'Upload & save'}).click();const ur=await uploadResponse;const result=JSON.parse((await ur.text()).trim().split('\n').at(-1));assert.equal(result.ok,true,result.error);artifacts.pdfs.push(result.record.id);artifacts.uploads.push(result.uploadId);if(result.shortLink)artifacts.links.push(result.shortLink.slug);assert(result.shortLink,'Short link must be created for uploaded PDF');await page.getByText('Published. Ready to share.',{exact:true}).waitFor({timeout:35000});
  await page.screenshot({path:'.admin-test/upload-success.png',fullPage:true});report.push({name:'Real browser PDF upload, streamed progress, publication and custom slug',status:'passed'});
  await page.locator('[data-nav="announcements"]').click();await page.getByRole('button',{name:'Add announcement',exact:true}).click();const editor=page.locator('#editor');await editor.locator('[name=title]').fill('Browser announcement verification '+f.suffix);await editor.locator('[name=original_message]').fill('A real end-to-end browser verification message.');await editor.locator('[name=message_date]').fill('2026-10-17');await editor.locator('[name=published]').check();
  const save=page.waitForResponse(r=>r.url().includes('/admin-command')&&r.request().postData()?.includes('"action":"save"'));await editor.getByRole('button',{name:'Save announcement',exact:true}).click();const saved=await(await save).json();assert.equal(saved.ok,true,saved.error);artifacts.announcements.push(saved.record.id);await page.locator('#modal').waitFor({state:'hidden'});report.push({name:'Announcement created and published through the actual editor',status:'passed'});
  await page.locator('[data-nav="settings"]').click();await page.locator('[name=reducedMotion]').check();await page.getByRole('button',{name:'Save preferences'}).click();await page.getByText('Preferences saved.',{exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('data-motion'),'reduced');await page.locator('[name=theme]').selectOption('light');await page.getByRole('button',{name:'Save preferences'}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.screenshot({path:'.admin-test/settings-light.png',fullPage:true});report.push({name:'Saved light theme and reduced-motion preferences',status:'passed'});
  await page.locator('[name=theme]').selectOption('dark');await page.getByRole('button',{name:'Save preferences'}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  for(const [width,height,label]of [[820,1180,'tablet'],[390,844,'phone']]){
    await page.setViewportSize({width,height});await page.evaluate(()=>location.hash='dashboard');await page.getByRole('heading',{name:'A clearer view.'}).waitFor({timeout:35000});await noOverflow(page,label+' dashboard');await page.screenshot({path:'.admin-test/dashboard-'+label+'.png',fullPage:true});
    if(width<760){await page.getByRole('button',{name:'Open navigation',exact:true}).click();assert(await page.locator('body').evaluate(el=>el.classList.contains('nav-open')));}
    await page.locator('[data-nav="library"]').click();await page.getByRole('heading',{name:'Your PDF library.'}).waitFor({timeout:35000});await noOverflow(page,label+' library');await page.screenshot({path:'.admin-test/library-'+label+'.png',fullPage:true});
    await page.evaluate(()=>location.hash='upload');await page.getByRole('heading',{name:'Make room for something new.'}).waitFor();await noOverflow(page,label+' upload');
    report.push({name:label+' layout: dashboard, library, upload and navigation without horizontal page overflow',status:'passed'});
  }
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
  const denied=await browser.newPage();await login(denied,ordinary);await denied.getByRole('heading',{name:'Access denied.'}).waitFor({timeout:35000});report.push({name:'Ordinary account receives Access Denied UI',status:'passed'});await denied.close();
  assert.deepEqual(errors,[]);report.push({name:'No uncaught browser exceptions',status:'passed'});
}catch(e){report.push({name:'Browser run',status:'failed',error:e.message});console.error(e.message);process.exitCode=1;}
finally{
  for(const slug of artifacts.links)try{await direct('link_delete',{slug,confirm:'DELETE '+slug});}catch(e){console.error('Cleanup link:',e.message);}
  for(const [table,ids]of [['study_materials',artifacts.pdfs],['announcements',artifacts.announcements]])for(const id of ids)try{let row=(await direct('export',{table,ids:[id]})).records[0];if(!row)continue;if(!row.archived_at){const r=await direct('bulk',{table,operation:'archive',items:[{id,version:row.version}],confirm:'ARCHIVE 1'});assert(r.results[0].ok,r.results[0].error);row=r.results[0].record;}const d=await direct('bulk',{table,operation:'delete',items:[{id,version:row.version}],confirm:'DELETE 1'});assert(d.results[0].ok,d.results[0].error);}catch(e){console.error('Cleanup record:',e.message);}
  for(const uploadId of artifacts.uploads)try{await direct('storage_delete',{uploadId,confirm:'DELETE FILE'});}catch(e){console.error('Cleanup upload:',e.message);}
  writeFileSync('.admin-test/browser-report.json',JSON.stringify({report,artifacts,errors},null,2));await browser.close();for(const check of report)console.log((check.status==='passed'?'PASS ':'FAIL ')+check.name);
}
