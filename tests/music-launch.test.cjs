/* The former catalog announcement is permanently retired.
 * The required music decision is a separate, one-time name-onboarding step.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const launch=fs.readFileSync('music-launch.js','utf8');
const choice=fs.readFileSync('music-choice.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const classic=fs.readFileSync('classic.html','utf8');
new vm.Script(launch);new vm.Script(choice);
assert.match(launch,/hiddenForever=\(\)=>true/);
for(const html of [index,classic]){
 assert.match(html,/src="\/music-launch\.js\?v=1"/);
 assert.match(html,/src="\/music-choice\.js\?v=1"/);
}
let removed=0;
const popup={remove(){removed++}};
const classes={remove(){}};
const document={readyState:'complete',getElementById:()=>popup,body:{classList:classes}};
const window={};
vm.runInNewContext(launch,{window,document});
const api=window.__8apdfMusicLaunch;
api.show();
assert.equal(api.hiddenForever(),true);
assert.equal(removed,1,'Old popup should be removed, not shown');
api.dismissForever();
assert.equal(removed,2);
assert.match(choice,/Choose your background music preference/);
console.log('PASS retired music-catalog popup; separate mandatory one-time music choice');
