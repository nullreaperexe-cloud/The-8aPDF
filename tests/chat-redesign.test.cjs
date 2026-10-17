'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {Script} = require('node:vm');
const {join} = require('node:path');
const root=join(__dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');
const app=read('chat/app.js');
const css=read('chat/premium.css');

test('chat script parses without executing user sessions',()=>{
 assert.doesNotThrow(()=>new Script(app,{filename:'chat/app.js'}));
});

for(const page of ['chat/index.html','chat-frame.html']){
 test(page+' preserves chat controls and loads theme',()=>{
  const html=read(page);
  assert.match(html,/chat\/premium\.css/);
  for(const id of ['roomList','messageInput','sendButton','mediaInput','membersList','membersSummary','memberSearch','memberCount','mobileOpenMembers','mobileOpenRooms','adminBtn','inviteBtn','headerMoreBtn']){
   assert.ok(html.includes('id="'+id+'"'),id+' missing from '+page);
  }
  for(const action of ['create','join','private','new']){
   assert.ok(html.includes('data-action="'+action+'"'),action+' missing');
  }
 });
}

test('members are keyed by user ID, named and derived from room membership',()=>{
 assert.match(app,/rpc\('chat_named_members'/);
 assert.match(app,/new Map\(all\.map\(m=>\[m\.user_id,m\]\)\)/);
 assert.match(app,/filter\(m=>validIds\.has\(m\.user_id\)\)/);
 assert.match(app,/function isNamedProfile\(name\)/);
 assert.match(app,/memberCount'\)\.textContent=String\(all\.length\)/);
 assert.match(app,/repeatedNames=new Map\(\)/);
 assert.doesNotMatch(app,/const name=m\.profile\?\.display_name\|\|'Friend'/);
});

test('sending, attachments and original actions remain wired',()=>{
 for(const name of ['sendText','sendMessage','uploadFile','imageCompress','videoCompress','makeRoom','joinRoom','inviteFriend','roomManagement','renderReactions','loadOlder','setupRealtime','openRoom']){
  assert.ok(app.includes(name+'('),name+' handler missing');
 }
 assert.match(app,/if\(sendingText\)return/);
 assert.match(app,/addEventListener\('input',renderMembers\)/);
});

test('motion and responsive design respect site tokens',()=>{
 assert.match(css,/--panel:var\(--surface/);
 assert.match(css,/--ink:var\(--text/);
 assert.match(css,/@media\s*\(max-width:780px\)/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@keyframes chatNewMessage/);
});

test('database member query is non-destructive and security invoker',()=>{
 const sql=read('db/chat-named-members.sql');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/join public\.chat_profiles/i);
 assert.match(sql,/revoke all on function public\.chat_named_members\(uuid\) from public, anon/i);
 assert.match(sql,/grant execute on function public\.chat_named_members\(uuid\) to authenticated/i);
 assert.doesNotMatch(sql,/\bdelete\s+from\b/i);
});

test('full chat redesign updates layout but preserves backend controls',()=>{
 for(const file of ['chat/index.html','chat-frame.html']){
  const html=read(file);
  for(const item of ['conversation-stage','side-headline','details-cover','intro-art','roomSearch','closeRooms','member-search-box','roomsTotal']){
   assert.ok(html.includes(item),file+' missing '+item);
  }
  assert.ok(html.includes('/chat/premium.css?v=20261017-airy'));
 }
 assert.ok(app.includes("('roomSearch')?.addEventListener('input',renderRooms)"));
 assert.ok(app.includes('message-day'));
 assert.ok(css.includes('.conversation-stage'));
 assert.ok(css.includes('max-width:780px'));
 assert.ok(css.includes('v20261017-airy'));
 assert.ok(css.includes('max-width:1060px'));
 assert.ok(css.includes('grid-template-columns:58px'));
 assert.ok(css.includes('.conversation-stage{'));
});
