/* UI safety contract: preserve student data, controls and readable first paint. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('alabaster-ui.css','utf8');
const js=fs.readFileSync('alabaster-ui.js','utf8');
const workspace=fs.readFileSync('workspace-upgrade.js','utf8');
const sidebar=fs.readFileSync('features/sidebar-toggle.js','utf8');
new vm.Script(js,{filename:'alabaster-ui.js'});
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'Redesign CSS braces must balance');
assert(html.includes("document.documentElement.dataset.studioNav='closed'"),'Sidebar must default closed');
assert(sidebar.includes("sidebar.inert=!expanded"),'Collapsed sidebar must not accept focus');
assert(sidebar.includes("root.dataset.studioNav==='open'"),'Desktop escape key should close overlay');
assert(css.includes('body > .top-shell .top-nav #studioSidebarToggle'),'Menu must override premium desktop display:none');
assert(css.includes('data-tone="light"'),'New design must be scoped to light theme');
assert(css.includes('#studyTypingHeadline #studyTypingText'),'Live typing spans must stay readable');
assert(css.includes('-webkit-text-fill-color:#101827!important'),'Premium text must not be white-on-white');
assert(css.includes('background-image:none!important'),'Hero photograph must be removed');
assert(css.includes('.hero .hero-description'),'Existing hero description must stay visible');
assert(workspace.includes("const def={theme:'light'"),'Workspace must default to daylight');
assert(workspace.includes('8apdf_workspace_daylight_readability_fix_v1'),'Existing pure-black preference must migrate once');
for(const id of ['studioSidebar','studioSidebarToggle','studioSidebarClose','studioSidebarShade','pdfGrid','announcementGrid','studyTypingText','searchInput','studioMobileMore']){
 assert(html.includes('id="'+id+'"'),'Missing existing functional element: '+id);
}
for(const route of ['pdf.html','tasks.html','settings.html','messages.html']){
 const page=fs.readFileSync(route,'utf8');
 assert(page.includes('id="menuToggle"'),'Native resource page lost left menu: '+route);
 assert(page.includes('/alabaster-ui.css'),'Native resource page missing shared design: '+route);
}
assert(js.includes('bridge()?.openAnnouncement?.(item.id)'),'Original notice reader must remain connected');
assert(!/data:image\//.test(css),'Redesign must not embed raster image data');
console.log('PASS readable hero, safe palette migration, collapsed left drawer and preserved student feature hooks.');
