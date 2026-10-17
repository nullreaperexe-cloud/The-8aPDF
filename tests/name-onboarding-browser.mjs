import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

const root=resolve('.');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};
let server;
let base=process.env.ONBOARDING_BASE_URL;
if(!base){
  server=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));
      if(!file.startsWith(root+sep))throw Error('Invalid path');
      const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  base='http://127.0.0.1:'+server.address().port;
}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
const marker='8apdf_premium_name_onboarding_v1';
const errors=[];
const artifacts=process.env.ONBOARDING_ARTIFACT_DIR;
if(artifacts)await mkdir(artifacts,{recursive:true});
async function context(saved={},options={}){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},...options});
  await ctx.addInitScript(({saved})=>{
    if(!sessionStorage.getItem('onboarding-test-seeded')){
      for(const [k,v]of Object.entries(saved))localStorage.setItem(k,v);
      sessionStorage.setItem('onboarding-test-seeded','1');
    }
  },{saved});
  const page=await ctx.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  return {ctx,page};
}
const visible=p=>p.locator('#nameModal.show').waitFor();
const hidden=p=>p.waitForFunction(()=>!document.getElementById('nameModal').classList.contains('show'));
const stored=(p,key)=>p.evaluate(key=>localStorage.getItem(key),key);
try{
  let {ctx,page}=await context();await visible(page);
  assert.equal(await stored(page,marker),null);
  await page.reload({waitUntil:'domcontentloaded'});await visible(page);
  assert.equal(await page.locator('#nameInput').inputValue(),'');
  assert(await page.locator('#nameForm button').isDisabled());
  await page.locator('#nameInput').fill('   ');assert(await page.locator('#nameForm button').isDisabled());
  await page.locator('#nameForm').evaluate(form=>form.requestSubmit());
  assert.equal(await page.locator('#nameInput').getAttribute('aria-invalid'),'true');
  assert.equal(await stored(page,marker),null);
  await page.locator('#nameInput').fill('  अनन्या  李  ');
  await page.locator('#nameInput').press('Tab');assert(await page.locator('#nameForm button').evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Tab');assert(await page.locator('#nameInput').evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Enter');
  await page.locator('#nameWelcomeTitle').getByText('Welcome, अनन्या  李.',{exact:true}).waitFor();
  await page.locator('#nameForm').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  assert.equal(await stored(page,'eightapdf_user_name_v2'),'अनन्या  李');
  assert.equal(await stored(page,marker),'complete');
  await hidden(page);assert.equal(await page.locator('#welcomeScreen').getAttribute('aria-hidden'),'true');
  await page.reload({waitUntil:'domcontentloaded'});await hidden(page);
  await page.evaluate(()=>location.hash='library');await hidden(page);await ctx.close();
  console.log('PASS new visitor, refresh before completion, whitespace, Unicode, keyboard, double submit, personalized welcome, reload and navigation');

  for(const key of ['eightapdf_user_name','eightapdf_user_name_v2']){
    ({ctx,page}=await context({[key]:'Kanish',keep_preference:'untouched','8apdf_skip_welcome':'1'}));
    await visible(page);assert.equal(await page.locator('#nameInput').inputValue(),'Kanish');
    await page.locator('#nameInput').fill('Edited Name');await page.locator('#nameForm button').click();await hidden(page);
    assert.equal(await stored(page,'eightapdf_user_name'),'Edited Name');assert.equal(await stored(page,'eightapdf_user_name_v2'),'Edited Name');
    assert.equal(await stored(page,'keep_preference'),'untouched');await page.goto(base+'/classic.html',{waitUntil:'domcontentloaded'});await hidden(page);await ctx.close();
  }
  console.log('PASS both legacy name keys, prefill/edit, skip-welcome migration, unrelated data and cross-page marker');

  ({ctx,page}=await context({'eightapdf_user_name_v2':'Kanish'}));await page.close();page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});await visible(page);assert.equal(await stored(page,marker),null);await ctx.close();
  ({ctx,page}=await context({}, {reducedMotion:'reduce'}));await visible(page);
  assert.equal(await page.locator('.name-headline i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  for(const [width,height]of [[1440,1000],[820,1180],[390,844],[320,568],[390,360],[844,390]]){
    await page.setViewportSize({width,height});
    await page.locator('#nameInput').fill('Kanish');
    await page.locator('#nameForm button').scrollIntoViewIfNeeded();
    const metrics=await page.locator('#nameModal').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,font:getComputedStyle(e).fontFamily,bodyFont:getComputedStyle(document.body).fontFamily,fieldSize:parseFloat(getComputedStyle(document.getElementById('nameInput')).fontSize)}));
    assert(metrics.scroll<=metrics.width,`${width}x${height} modal overflow`);assert.equal(metrics.font,metrics.bodyFont);assert(metrics.fieldSize>=16);
    assert(await page.locator('#nameForm button').isVisible());
    await page.locator('#nameForm button').evaluate(e=>{const r=e.getBoundingClientRect();if(!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('Button covered');});
    assert.equal(await page.locator('#nameModal #myShortLinks').count(),0);
    if(artifacts)await page.screenshot({path:resolve(artifacts,`onboarding-${width}x${height}.png`)});
  }
  await ctx.close();console.log('PASS incomplete tab close, reduced motion, inherited font, desktop/tablet/mobile/virtual-keyboard layouts and unobstructed controls');

  for(const blocked of [['localStorage'],['localStorage','sessionStorage']]){
    ctx=await browser.newContext();await ctx.addInitScript(blocked=>{
      for(const key of blocked)Object.defineProperty(window,key,{get(){throw new DOMException('Disabled','SecurityError');}});
    },blocked);
    page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'domcontentloaded'});await visible(page);
    await page.locator('#nameInput').fill('<img src=x onerror=alert(1)>');await page.locator('#nameForm button').click();
    await page.locator('#nameWelcomeTitle').getByText('Welcome, <img src=x onerror=alert(1)>.',{exact:true}).waitFor();
    assert.equal(await page.locator('#nameWelcomeTitle img').count(),0);await hidden(page);
    if(blocked.length===1){await page.reload({waitUntil:'domcontentloaded'});await hidden(page);}
    await ctx.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS storage denial/session fallback, safe personalized text and no JavaScript page errors');
}finally{await browser.close();if(server)await new Promise(done=>server.close(done));}
