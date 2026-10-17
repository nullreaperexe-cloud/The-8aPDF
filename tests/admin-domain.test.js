import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalURL,httpsURL,image2urlPDFURL,validSlug,metadata,validatePDF,duplicateGroups,MAX_PDF_BYTES} from '../admin/domain.js';
import {normalizeSupabaseAnnouncement} from '../supabase-announcements.js';
test('safe URL canonicalization preserves meaningful case and query parameters',()=>{
  assert.equal(canonicalURL('https://EXAMPLE.com/A.pdf?token=XYZ#page=2'),'https://example.com/A.pdf?token=XYZ');
  assert.notEqual(canonicalURL('https://example.com/A.pdf'),canonicalURL('https://example.com/a.pdf'));
  assert.notEqual(canonicalURL('https://example.com/a.pdf?token=1'),canonicalURL('https://example.com/a.pdf?token=2'));
  for(const url of ['javascript:alert(1)','http://example.com/a.pdf','https://user:pass@example.com','https://127.0.0.1/x','https://169.254.169.254/x','https://172.16.1.1/x','https://localhost/x','https://[::1]/x'])assert.equal(httpsURL(url),null);
});
test('short names reject reserved routes and malformed names',()=>{
  assert.equal(validSlug('Science-Notes'),'science-notes');
  for(const value of ['admin','pdf-explorer','aa','science--notes','-hello','hello/there','hello?x=1'])assert.throws(()=>validSlug(value));
});

test('Image2URL entry accepts public HTTPS provider URLs and rejects lookalikes or private targets',()=>{
  assert.equal(image2urlPDFURL('https://www.image2url.com/r2/default/documents/notes.pdf'),'https://www.image2url.com/r2/default/documents/notes.pdf');
  for(const value of ['http://image2url.com/a.pdf','https://image2url.com.evil.example/a.pdf','https://127.0.0.1/a.pdf','https://user:secret@image2url.com/a.pdf','javascript:alert(1)','https://example.com/a.pdf'])assert.equal(image2urlPDFURL(value),null);
});
test('metadata validates server-side and excludes protected / legacy fields',()=>{
  const result=metadata('study_materials',{title:' Math ',subject:'Mathematics',pdf_url:'https://example.com/a.pdf',tags:[' revision '],source_date:'2026-10-17',published:true,raw:{secret:'untouched'},inserted_at:'1999-01-01',admin_edited_fields:['evil'],version:100});
  assert.equal(result.title,'Math');assert.deepEqual(result.tags,['revision']);assert.equal(result.source_date,'2026-10-17T00:00:00.000Z');
  for(const key of ['raw','inserted_at','admin_edited_fields','version'])assert.equal(key in result,false);
  assert.throws(()=>metadata('study_materials',{title:'',published:true}));
  assert.throws(()=>metadata('study_materials',{title:'A',published:'true'}));
  assert.throws(()=>metadata('announcements',{title:'A',message_date:'2026-02-30'}));
  assert.throws(()=>metadata('announcements',{title:'A',priority:'root'}));
  assert.equal(metadata('announcements',{title:'A',original_message:'<script>foo</script>'}).original_message,'<script>foo</script>'); // Rendered as escaped text.
  assert.doesNotThrow(()=>metadata('study_materials',Object.fromEntries(Object.entries({title:'Copy',description:null,subject:null,pdf_url:'https://example.com/a.pdf'}).filter(([,v])=>v!==null))));
});
test('PDFs require correct name, MIME, signature, completeness and size; checksum stable',async()=>{
  const payload='%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
  const a=await validatePDF(new File([payload],'test.pdf',{type:'application/pdf'}));
  const b=await validatePDF(new File([payload],'other.pdf',{type:'application/pdf'}));assert.equal(a.checksum,b.checksum);assert.equal(a.checksum.length,64);
  for(const file of [new File([payload],'test.exe',{type:'application/pdf'}),new File([payload],'test.pdf',{type:'text/plain'}),new File(['not a pdf'],'test.pdf',{type:'application/pdf'}),new File(['%PDF-1.4'],'test.pdf',{type:'application/pdf'})])await assert.rejects(()=>validatePDF(file));
  await assert.rejects(()=>validatePDF({name:'big.pdf',type:'application/pdf',size:MAX_PDF_BYTES+1,arrayBuffer:()=>{throw Error('must not read oversized file');}}),/20 MB/);
});

test('ordinary PDFs containing action names in text and metadata upload without changing their bytes',async()=>{
  for(const name of ['JavaScript','JS','Launch','EmbeddedFile']){
    const stream=`BT /F1 12 Tf 30 100 Td (PDF reference: /${name}) Tj ET\n`;
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}endstream`,`<< /Title (Reference to /${name}) >>`];
    let payload='%PDF-1.4\n';const offsets=[0];
    for(const [i,object] of objects.entries()){offsets.push(payload.length);payload+=`${i+1} 0 obj\n${object}\nendobj\n`;}
    const xref=payload.length;
    payload+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const result=await validatePDF(new File([payload],`${name}.pdf`,{type:'application/pdf'}));
    assert.deepEqual(result.bytes,new TextEncoder().encode(payload));
    assert.equal(result.checksum.length,64);
  }
});
test('duplicates use exact identity or checksum and actual insertion order',()=>{
  const records=[{id:'new',title:'Different title',pdf_url:'https://example.com/a.pdf',source_date:'2000-01-01',inserted_at:'2026-10-17'}, {id:'old',title:'Math revision notes',pdf_url:'https://example.com/a.pdf#page=2',source_date:'2099-01-01',inserted_at:'2026-10-01'}];
  const original=structuredClone(records),groups=duplicateGroups(records);assert.equal(groups.length,1);assert.equal(groups[0].confidence,'confirmed');assert.deepEqual(groups[0].records.map(r=>r.id),['old','new']);assert.equal(groups[0].inferred,false);assert.deepEqual(records,original,'Detection must never mutate or delete records');
  assert.equal(duplicateGroups([{id:'a',title:'A',pdf_url:'https://example.com/a.pdf',file_checksum:'a'.repeat(64)},{id:'b',title:'B',pdf_url:'https://storage.example.com/b.pdf',file_checksum:'a'.repeat(64)}])[0].confidence,'confirmed');
});
test('similar titles never prove identical content and imported priority is inferred',()=>{
  const rows=[{id:'a',title:'Science chapter revision notes',subject:'Science',pdf_url:'https://example.com/A.pdf',created_at:'2026-10-01'},{id:'b',title:'Science chapter revision notes',subject:'Science',pdf_url:'https://example.com/B.pdf',created_at:'2026-10-02'}];
  const g=duplicateGroups(rows);assert.equal(g[0].confidence,'possible');assert.equal(g[0].inferred,true);assert.equal(duplicateGroups(rows,'exact').length,0);
  assert.equal(duplicateGroups([{...rows[0],title:'Science'},{...rows[1],title:'Science'}]).length,0);
});
test('admin edits override raw fields while original legacy timestamp data is preserved',()=>{
  const raw={title:'Legacy title',category:'Homework',originalMessage:'Old message',messageDate:{seconds:123},createdAt:{seconds:456}};
  const r=normalizeSupabaseAnnouncement({id:'test',title:'Edited title',category:'Exam',original_message:'New message',message_date:'2026-10-17',published:false,admin_edited_fields:['title','category','original_message','message_date'],raw});
  assert.equal(r.title,'Edited title');assert.equal(r.category,'Exam');assert.equal(r.originalMessage,'New message');assert.equal(r.message,'New message');assert.equal(r.messageDate,'2026-10-17');assert.equal(r.published,false);assert.deepEqual(r.createdAt,{seconds:456});assert.equal(raw.title,'Legacy title');
  const attachment=normalizeSupabaseAnnouncement({id:'attachment',title:'A',attachment_url:'https://example.com/a.pdf',has_attachment:true,admin_edited_fields:['has_attachment','attachment_url'],raw:{hasAttachment:false}});assert.equal(attachment.hasAttachment,true);
});
test('admin route wins before short-link rewrite; bundle contains no server secrets',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.equal(config.rewrites[0].source,'/admin');assert.equal(config.rewrites[0].destination,'/admin.html');
  const bundle=readFileSync(new URL('../admin/admin.bundle.js',import.meta.url),'utf8');
  assert(!bundle.includes('SUPABASE_SERVICE_ROLE_KEY'));assert(!bundle.includes('sb_secret_'));assert(!bundle.includes('service_role'));
  assert(bundle.length<120000,'Keep the isolated admin bundle small');
});
