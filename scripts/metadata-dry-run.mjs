#!/usr/bin/env node
/* Read-only metadata audit. Reads local JSON; never connects to Supabase or updates rows.
 * Usage: node scripts/metadata-dry-run.mjs ./materials.json [--output ./review.json]
 */
import fs from 'node:fs/promises';
import '../shared/title-clarity.js';
const clarity=globalThis.__8apdfTitleClarity;
const args=process.argv.slice(2);
const input=args[0],outIndex=args.indexOf('--output'),output=outIndex>=0?args[outIndex+1]:null;
if(!input||input.startsWith('-')||(outIndex>=0&&!output)){
 console.error('Usage: node scripts/metadata-dry-run.mjs records.json [--output audit.json]');
 process.exitCode=2;
}else{
 const body=JSON.parse(await fs.readFile(input,'utf8'));
 const records=Array.isArray(body)?body:Array.isArray(body.records)?body.records:null;
 if(!records)throw new TypeError('Input must be a JSON array or object with records[]');
 const report=records.map(record=>{
  const analysis=clarity.inspect(record);
  const approved=record?.manual_approved===true||record?.metadata_approved===true||
    /^(approved|manually_approved|manual-approved)$/i.test(String(record?.metadata_review_status||''));
  return {
   id:record?.id??null,
   before:{title:record?.title??'',description:record?.description??''},
   suggested:{title:analysis.title,description:analysis.description},
   source:analysis.source,
   reasons:analysis.issues,
   approved,
   requiresHumanReview:analysis.reviewNeeded||approved,
   changeWouldBeNeeded:analysis.title!==(record?.title??'')||
     analysis.description!==(record?.description??''),
   action:'NO WRITE'
  };
 });
 const result={normalizerVersion:clarity.version,mode:'dry-run/no-writes',
  count:report.length,changed:report.filter(x=>x.changeWouldBeNeeded).length,
  needsReview:report.filter(x=>x.requiresHumanReview).length,records:report};
 const encoded=JSON.stringify(result,null,2)+'\n';
 if(output){await fs.writeFile(output,encoded,'utf8');console.log('Audit saved to '+output)}
 else process.stdout.write(encoded);
}
