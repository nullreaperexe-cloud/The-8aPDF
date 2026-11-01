/* Offline regression: download all bytes rather than 2 MB partial response. */
import assert from 'node:assert/strict';
import {downloadTrack} from '../music-library/downloads.js';
const total=2*1024*1024*2+1000,seen=[];
const old={fetch:globalThis.fetch,document:globalThis.document,createObjectURL:URL.createObjectURL,revokeObjectURL:URL.revokeObjectURL};
let clicked=0,blob;
try{
 globalThis.fetch=async(url,options)=>{
  const range=options.headers.Range,match=/^bytes=(\d+)-(\d+)$/.exec(range);assert.ok(match);
  const start=+match[1],end=+match[2];seen.push([start,end]);assert.equal(url.includes('action=stream'),true);
  return {status:206,arrayBuffer:async()=>new ArrayBuffer(end-start+1)};
 };
 URL.createObjectURL=x=>{blob=x;return 'blob:mock'};
 URL.revokeObjectURL=()=>{};
 globalThis.document={body:{append(){}},createElement:()=>({click(){clicked++},remove(){},download:''})};
 await downloadTrack({id:'song123456789ABCDE',title:'Test Song',size:total,mimeType:'audio/mpeg'});
 assert.deepEqual(seen,[[0,2097151],[2097152,4194303],[4194304,total-1]]);
 assert.equal(blob.size,total);
 assert.equal(clicked,1);
 console.log('PASS complete Google Drive MP3 download across server byte-range chunks');
}finally{
 globalThis.fetch=old.fetch;globalThis.document=old.document;URL.createObjectURL=old.createObjectURL;URL.revokeObjectURL=old.revokeObjectURL;
}
