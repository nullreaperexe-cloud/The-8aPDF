/* Browser regressions for guest browsing and optional music consent.
 * Run with installed Playwright Chromium: npm run test:onboarding:browser
 */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml',
 '.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.json':'application/json'};
let server,base=process.env.ONBOARDING_BASE_URL;
if(!base){
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   const file=resolve(root,'.'+(path==='/'?'/index.html':path));
   if(!file.startsWith(root+sep))throw Error('Unsafe file');
   const body=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
   res.end(body);
  }catch{if(!res.headersSent)res.writeHead(404);res.end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 base='http://127.0.0.1:'+server.address().port;
}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?
 {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const artifactDir=process.env.ONBOARDING_ARTIFACT_DIR;
if(artifactDir)await mkdir(artifactDir,{recursive:true});
async function pageWith(saved={},options={}){
 const ctx=await browser.newContext(options);
 await ctx.addInitScript(values=>{
  for(const [key,value]of Object.entries(values))try{localStorage.setItem(key,value)}catch{}
 },saved);
 const page=await ctx.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 return {ctx,page};
}
try{
 let {ctx,page}=await pageWith();
 await page.locator('#nameModal.show').waitFor();
 await page.locator('#skipNameOnboarding').click();
 await page.waitForFunction(()=>!document.querySelector('#nameModal.show'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('8apdf_guest_browse_v1')),'1');
 assert.equal(await page.evaluate(()=>localStorage.getItem('eightapdf_user_name_v2')),null);
 assert.equal(await page.locator('#eightapdfMusicChoice').count(),0,'Guest cannot get a surprise music dialog');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('locked')),false);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.entryPending),undefined);
 assert.equal(await page.evaluate(()=>[...document.body.children].some(n=>n.inert)),false);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#nameModal.show').count(),0);
 assert.equal(await page.locator('#welcomeScreen.show').count(),0);
 await page.goto(base+'/pdfs',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#nameModal.show').count(),0);
 await ctx.close();
 console.log('PASS guest skip, reload, deep-link entry, overlay cleanup and no surprise music');

 ({ctx,page}=await pageWith({}, {viewport:{width:390,height:844},reducedMotion:'reduce'}));
 await page.locator('#nameModal.show').waitFor();
 assert(await page.locator('#skipNameOnboarding').isVisible());
 const bounds=await page.locator('#skipNameOnboarding').boundingBox();
 assert(bounds.width>130&&bounds.height>=44);
 await page.locator('#nameInput').fill('अनन्या');
 await page.locator('#nameForm button[type="submit"]').click();
 await page.locator('#nameWelcomeTitle').getByText('Welcome, अनन्या',{exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#nameModal.show'));
 await page.locator('#eightapdfMusicChoice').waitFor();
 await page.locator('[data-music-skip]').click();
 await page.waitForFunction(()=>!document.querySelector('#eightapdfMusicChoice'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('8apdf_music_choice_v1')),null);
 assert.equal(await page.evaluate(()=>localStorage.getItem('8apdf_music_deferred_v1')),'1');
 if(artifactDir)await page.screenshot({path:resolve(artifactDir,'optional-onboarding-mobile.png')});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#eightapdfMusicChoice').count(),0);
 await ctx.close();
 console.log('PASS mobile name flow and deferred music choice (with reduced motion)');

 ({ctx,page}=await pageWith({
  '8apdf_crimson_fresh_name_v20261115':'complete','eightapdf_user_name_v2':'Kanish',
  '8apdf_music_choice_v1':'with','8apdf_skip_welcome':'1'
 }));
 await page.waitForTimeout(300);
 assert.equal(await page.locator('#nameModal.show').count(),0);
 assert.equal(await page.locator('#eightapdfMusicChoice').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('8apdf_music_choice_v1')),'with');
 await ctx.close();
 console.log('PASS existing name and music preferences');

 ({ctx,page}=await pageWith());
 await ctx.close();
 ctx=await browser.newContext();
 await ctx.addInitScript(()=>{
  for(const key of ['localStorage','sessionStorage'])
   Object.defineProperty(window,key,{get(){throw new DOMException('Disabled','SecurityError')}});
 });
 page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#skipNameOnboarding').click();
 await page.waitForFunction(()=>!document.querySelector('#nameModal.show'));
 assert.equal(await page.locator('#eightapdfMusicChoice').count(),0);
 await ctx.close();
 console.log('PASS blocked persistent storage: current visit remains usable');
}finally{
 await browser.close();
 if(server)await new Promise(ok=>server.close(ok));
}
