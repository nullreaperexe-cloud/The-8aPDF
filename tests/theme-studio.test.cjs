/* 8aPDF five-color theme combinations and role-editor regression checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('features/app-core.js','utf8');
const css=fs.readFileSync('theme-studio.css','utf8');
const workspace=fs.readFileSync('workspace-upgrade.js','utf8');
const start=html.indexOf('const monoThemes='),end=html.indexOf("let activePaletteFilter=",start);
assert(start>0&&end>start,'Theme engine not found');
const source=html.slice(start,end);
const context=vm.createContext({settings:{theme:'pure-black'}});
const theme=vm.runInContext(source+';({allThemes,monoThemes,roleDefs,roleColors,paletteFor,selectedTheme,luminance})',context);
const themes=theme.allThemes;
assert.equal(themes.length,78,'Exactly 78 coordinated themes required');
assert.equal(new Set(themes.map(t=>t.id)).size,78,'Themes must not repeat');
assert.equal(themes.filter(t=>t.tone==='dark').length,39);
assert.equal(themes.filter(t=>t.tone==='light').length,39);
for(const t of themes){
 assert.equal(t.colors.length,5,'Each preset needs five main colors');
 assert.equal(new Set(t.colors).size,5,'Five swatches must be distinct');
 assert(t.colors.every(s=>/^#[0-9a-f]{6}$/i.test(s)),'Invalid palette hex');
 const roles=theme.roleColors(t);
 assert.equal(Object.keys(roles).length,10,'Theme should define ten usable roles');
 const v=theme.paletteFor(t);
 assert(v['--bg']&&v['--surface']&&v['--text']&&v['--button']&&v['--pill']);
 const contrast=(a,b)=>{const x=theme.luminance(a),y=theme.luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 assert(contrast(roles.page,roles.text)>=4.5, t.name+' text contrast inadequate');
 assert(contrast(roles.action,v['--button-text'])>=4.5, t.name+' button contrast inadequate');
}
assert.equal(theme.roleDefs.length,10);
assert.equal(theme.selectedTheme().id,'pure-black','Default Pure Black preference must remain');
assert(html.includes('id="themeRoleGrid"'),'Theme role editor missing');
assert(core.includes('data-theme-role'),'Ten color editors not rendered');
assert(core.includes("lastPresetTheme=settings.theme"),'Preset reset target must save');
assert(core.includes("document.dispatchEvent(new Event('8apdf:palette-customized'))"),'Workspace override persistence event missing');
assert(workspace.includes("document.addEventListener('8apdf:palette-customized'"),'Studio must preserve selected palette');
assert(css.includes('.theme-swatches i'),'Five swatch strips should render');
assert(css.includes('.theme-role-field'),'Editable color inputs must be styled');
console.log('PASS: 78 unique 5-color themes, 10 roles each, readable buttons/text and saved theme switching.');
