/* Node regression checks for 8aPDF's SoundCloud-only music integration. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('soundcloud-music.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('soundcloud-music.css','utf8');
new vm.Script(src,{filename:'soundcloud-music.js'});
const sandbox={
 URL,URLSearchParams,window:{},document:{addEventListener(){}},
 localStorage:{getItem(){return null}},
};
const instrumented=src.replace(/\}\)\(\);\s*$/, 'globalThis.__clean=cleanUrl;})();');
assert.notEqual(instrumented,src,'Expected to expose URL validator inside module scope');
vm.runInNewContext(instrumented,sandbox);
const clean=sandbox.__clean;
assert.equal(clean('https://soundcloud.com/artist/song'),'https://soundcloud.com/artist/song');
assert.equal(clean('https://m.soundcloud.com/artist/song?si=tracking'),'https://soundcloud.com/artist/song');
assert.equal(clean('https://soundcloud.com/artist/sets/playlist'),'https://soundcloud.com/artist/sets/playlist');
for(const url of ['https://soundcloud.com.evil.test/a/b','http://soundcloud.com/a/b','javascript:alert(1)','https://evil.example/a/b','https://soundcloud.com/discover'])
 assert.equal(clean(url),null,'Unsafe or non-track URL accepted: '+url);
assert.match(html,/src="\/soundcloud-music\.js\?v=\d+"/);
assert.match(html,/href="\/soundcloud-music\.css\?v=\d+"/);
assert.match(html,/id="studioSoundCloudMusic"/);
assert.doesNotMatch(html,/src="\/opentune-music\.js/);
assert.match(src,/https:\/\/w\.soundcloud\.com\/player\/api\.js/);
assert.match(src,/https:\/\/w\.soundcloud\.com\/player\//);
const minimize=src.split('function minimize(){')[1]?.split('function stopAndHide(){')[0]||'';
assert.ok(minimize,'minimize function not found');
assert.doesNotMatch(minimize,/\.pause\(|\.load\(|\.src\s*=/,'Minimizing must not pause or reload audio');
assert.match(minimize,/dock\.hidden=false/);
assert.match(css,/position:fixed/);
assert.match(css,/sc-dock/);
console.log('PASS SoundCloud URL validation, embed integration, persistent minimized dock');
