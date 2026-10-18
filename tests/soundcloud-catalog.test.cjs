/* Tests for the default 8aPDF popular SoundCloud library. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('soundcloud-catalog.js','utf8');
const player=fs.readFileSync('soundcloud-music.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sandbox={window:{}};
vm.runInNewContext(source,sandbox,{filename:'soundcloud-catalog.js'});
const library=Array.from(sandbox.window.__8apdfSoundCloudCatalog||[]);
assert.equal(library.length,54,'Expected 54 researched track URLs');
const categoryCounts={hindi:0,punjabi:0,english:0};
const urls=new Set();
for(const track of library){
 assert.ok(Object.hasOwn(categoryCounts,track.category),'Invalid category');
 categoryCounts[track.category]++;
 assert.ok(track.title&&track.artist,'Missing music metadata');
 const url=new URL(track.url);
 assert.equal(url.protocol,'https:');
 assert.equal(url.hostname,'soundcloud.com');
 assert.ok(url.pathname.split('/').filter(Boolean).length>=2,'Expected a concrete SoundCloud track URL');
 assert.ok(!urls.has(track.url),'Duplicate track URL');
 urls.add(track.url);
 assert.ok(!/\b(slowed|reverb|nightcore|karaoke|mashup)\b/i.test(track.title),'Unexpected remix/covers in featured list');
}
assert.equal(categoryCounts.punjabi,18);
assert.equal(categoryCounts.hindi,9);
assert.equal(categoryCounts.english,27);
const catalogIndex=index.indexOf('src="/soundcloud-catalog.js?v=');
const playerIndex=index.indexOf('src="/soundcloud-music.js?v=');
assert.ok(catalogIndex>=0&&playerIndex>catalogIndex,'Music catalog must load before widget');
assert.match(player,/curatedVersion:CATALOG_VERSION/);
assert.match(player,/uniqueTracks\(\[\.\.\.catalog,\.\.\.existing\]\)/);
assert.match(player,/Restore popular songs/);
assert.match(player,/data-sc-category="punjabi"/);
assert.match(player,/data-sc-category="hindi"/);
assert.match(player,/data-sc-category="english"/);
console.log('PASS: 54 real SoundCloud URLs, 3 categories, no duplicates, persistent collection and restore UI');
