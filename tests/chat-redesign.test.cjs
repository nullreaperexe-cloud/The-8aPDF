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


test('approved high-fidelity graphite and glow theme is installed',()=>{
 assert.match(css,/--chat-bg:#07090c/);
 assert.match(css,/--chat-green:#28da88/);
 assert.match(css,/radial-gradient/);
 assert.match(css,/linear-gradient/);
 assert.match(css,/grid-template-columns:80px/);
 assert.match(css,/\.composer/);
 assert.match(css,/@keyframes chatNewMessage/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('database named member query remains non-destructive and invoker-scoped',()=>{
 const sql=read('db/chat-named-members.sql');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/join public\.chat_profiles/i);
 assert.match(sql,/revoke all on function public\.chat_named_members\(uuid\) from public, anon/i);
 assert.match(sql,/grant execute on function public\.chat_named_members\(uuid\) to authenticated/i);
 assert.doesNotMatch(sql,/\bdelete\s+from\b/i);
});

for(const file of ['chat/index.html','chat-frame.html']){
 test(file+' reproduces approved luxury chat layout without losing controls',()=>{
  const html=read(file);
  assert.ok(html.includes('/chat/premium.css?v=20261017-exact'));
  for(const item of ['app-rail','chat-sidebar','conversation-stage','room-actions-menu','roomActionsToggle','viewAllMembers','details-cover','detailRoomTitle','detailsStatus','detailRoomDescription','roomSearch','membersList','roomTitle','messageInput','composerForm','mediaInput','sendButton','privacy-lock.js']){
   assert.ok(html.includes(item),file+' missing '+item);
  }
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs are not allowed');
  for(const action of ['create','join','private','new'])assert.ok(html.includes('data-action="'+action+'"'));
  assert.ok(html.includes('id="adminBtn"'));
  assert.ok(html.includes('id="mobileOpenRooms"'));
  assert.ok(html.includes('id="mobileOpenMembers"'));
  assert.ok(html.includes('id="closeMembers"'));
  assert.ok(html.includes('id="railProfileButton"'));
 });
}

test('premium UI controls remain real, not mock-only',()=>{
 for(const name of ['openRoom','loadRooms','renderRooms','renderMembers','loadMembers','sendText','sendMessage','uploadFile','toggleReaction','roomManagement','joinRoom','makeRoom','inviteFriend']){
  assert.ok(app.includes(name+'('),name+' missing');
 }
 assert.ok(app.includes("'detailRoomTitle').textContent=room.name"));
 assert.ok(app.includes("'detailsStatus'"));
 assert.ok(app.includes("'roomActionsToggle'"));
 assert.ok(app.includes("'viewAllMembers'"));
 assert.ok(app.includes("'railProfileButton'"));
 assert.ok(app.includes('state.rooms.filter'));
 assert.ok(app.includes('state.namedMembers'));
 assert.ok(!app.includes('Announcements</strong>'));
});
