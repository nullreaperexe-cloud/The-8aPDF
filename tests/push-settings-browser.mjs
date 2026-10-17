// UI contract test: mocked device API; never sends a real notification.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.PUSH_BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
const errors=[];
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{width:100%;height:1450px;border:0;display:block}</style><script>
window.deviceState={supported:true,subscribed:false,permission:'default',preferences:{pdfs:true,announcements:true,testsOnly:false},lastChecked:new Date().toISOString()};
window.calls=[];
window.__8apdfPush={status:async()=>deviceState,enable:async()=>{deviceState.subscribed=true;return deviceState},disable:async()=>{deviceState.subscribed=false;return deviceState},repair:async()=>{calls.push('repair');return deviceState},test:async()=>({sent:true}),testClosed:async()=>{calls.push('test-closed');return {queued:true}},savePreferences:async p=>{deviceState.preferences=p;return deviceState}};
window.__8apdfSocial={markAllRead:async()=>{}};
</script><iframe src="/notification-settings.html"></iframe>`;
try{
 await mkdir('.admin-test',{recursive:true});
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__push-test-host',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto(base+'/__push-test-host');
  const frame=page.frameLocator('iframe');
  await frame.getByText('Not enabled yet.',{exact:false}).waitFor();
  assert(await frame.locator('#pushTestClosed').isDisabled());
  await frame.locator('#pushEnable').click();
  await frame.getByText('Enabled on this device',{exact:false}).waitFor();
  assert(await frame.locator('#pushTestClosed').isEnabled());
  await frame.locator('#pushTestClosed').click();
  await frame.getByText('Test scheduled. Close all 8aPDF tabs and lock your phone now.',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.calls),['test-closed']);
  await page.evaluate(()=>{deviceState.latestDelivery={status:'sent',receipt_id:'test',provider_accepted_at:new Date().toISOString()}});
  await frame.locator('#pushRefresh').click();
  await frame.getByText('Browser display is not confirmed yet.',{exact:false}).waitFor();
  await page.evaluate(()=>{deviceState.latestDelivery.notification_shown_at=new Date().toISOString()});
  await frame.locator('#pushRefresh').click();
  await frame.getByText('Browser confirmed notification display at',{exact:false}).waitFor();
  await frame.locator('#pushRepair').click();
  await frame.getByText('Device renewed.',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.calls),['test-closed','repair']);
  assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth>innerWidth),false,'No horizontal overflow at '+width);
  await page.screenshot({path:'.admin-test/push-settings-'+width+'.png',fullPage:true});
  await frame.locator('#pushPdfs').uncheck();
  await page.waitForFunction(()=>window.deviceState.preferences.pdfs===false);
  await frame.locator('#pushDisable').click();
  await frame.getByText('Not enabled yet.',{exact:false}).waitFor();
  assert(await frame.locator('#pushTestClosed').isDisabled());
  await page.evaluate(()=>{deviceState.lastChecked=null;document.dispatchEvent(new Event('8apdf:push-changed'))});
  await frame.getByText('The background feed has not completed a recent check.',{exact:false}).waitFor();
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS phone/desktop notification settings, delayed test confirmation, preferences, opt-out, health and no overflow');
}finally{await browser.close();}
