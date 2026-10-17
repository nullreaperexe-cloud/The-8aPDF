import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function setup(){
  const source=readFileSync(new URL('../admin/main.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('async function confirmDialog('),source.indexOf('function recordMenu('));
  const dialog=new EventTarget();dialog.open=true;
  dialog.close=()=>{dialog.open=false;queueMicrotask(()=>dialog.dispatchEvent(new Event('close')));};
  const fields=new Map(['#confirmation-text','#confirm-ok','#confirm-cancel'].map(id=>[id,{disabled:id==='#confirm-ok'}]));
  const modal=()=>{if(dialog.open)dialog.close();dialog.open=true;return dialog;};
  const confirm=new Function('modal','$','esc','icon',`let modalDirty=false;${code};return confirmDialog;`)(modal,id=>fields.get(id),String,()=>'<icon>');
  return {dialog,fields,confirm};
}

test('confirmation stays open when the preceding row menu emits its queued close event',async()=>{
  const {dialog,fields,confirm}=setup();let settled=false;
  const result=confirm('Delete?','Remove selected records','DELETE 1').then(value=>{settled=true;return value;});
  await Promise.resolve();await Promise.resolve();
  assert.equal(dialog.open,true);assert.equal(settled,false);
  assert.equal(fields.get('#confirm-ok').disabled,true);
  fields.get('#confirmation-text').oninput({target:{value:'DELETE 1'}});
  assert.equal(fields.get('#confirm-ok').disabled,false);
  fields.get('#confirm-ok').onclick();
  assert.equal(await result,true);assert.equal(dialog.open,false);
});

test('cancel and native dialog close both resolve false after a dialog transition',async()=>{
  for(const method of ['cancel','native']){
    const {dialog,fields,confirm}=setup();
    const result=confirm('Delete?','Remove selected records','DELETE 2');
    await Promise.resolve();
    if(method==='cancel')fields.get('#confirm-cancel').onclick();else dialog.close();
    assert.equal(await result,false);assert.equal(dialog.open,false);
  }
});
