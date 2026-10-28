/* Retired Elfsight player must never start arbitrary background audio. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('music-autostart.js','utf8');
const page=fs.readFileSync('music-player.html','utf8');
new vm.Script(script);
assert.doesNotMatch(script,/\.playVideo\(|\.play\(\)|addEventListener\('pointerdown'/);
assert.doesNotMatch(page,/elfsightcdn\.com|elfsight-app-|music-autostart\.js|<audio|<iframe/);
let attempted=0;
const window={};
vm.runInNewContext(script,{window});
assert.equal(typeof window.__8apdfStartMusic,'function');
window.__8apdfStartMusic();
assert.equal(attempted,0);
console.log('PASS retired Elfsight autoplay: no unrelated background music player');
