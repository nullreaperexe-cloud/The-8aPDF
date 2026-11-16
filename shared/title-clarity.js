/* 8aPDF metadata clarity v2. Source-backed display normalization only.
 * Original backend records and manually approved metadata are never overwritten here.
 * The source scraper must apply equivalent cleanup BEFORE publication.
 */
(function(root){'use strict';
const VERSION='clarity-v2';
const neutral='School Material';
const unavailable='Document details are not available.';
const htmlEntities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',hellip:'…',ndash:'–',mdash:'—'};
function text(value){
 let s=String(value??'');
 s=s.replace(/<\s*(?:script|style|nav)\b[^>]*>[\s\S]*?<\s*\/\s*(?:script|style|nav)\s*>/gi,' ')
   .replace(/<[^>]*>/g,' ')
   .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,(all,key)=>{
     if(key[0]!=='#')return htmlEntities[key.toLowerCase()]??all;
     const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
     return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
   })
   .replace(/[\u200b-\u200f\ufeff]/g,'')
   .replace(/[\t\r\n]+/g,' ')
   .replace(/\s{2,}/g,' ')
   .trim();
 return s;
}
function clean(value){
 return text(value)
  .replace(/\s+([,.;:!?])/g,'$1')
  .replace(/([,;:])(?=\S)/g,'$1 ')
  .replace(/\s*\/\s*\/+\s*/g,' / ')
  .replace(/\s{2,}/g,' ')
  .trim();
}
// Only exact, multi-item portal chrome is removed, not meaningful "Class Test Circular".
const portalTail=/(?:\s*[|·,;:-]\s*)?(?:Attachment\s+Pay\s+Now\s+Class\s+Test\s+Circular|Pay\s+Now\s+Class\s+Test\s+Circular|Attachment\s+Pay\s+Now)\s*[|·.,;:-]*$/i;
const truncated=/\s+(?:find|and|or|of|for|to|in|with|from|the|a|an|&|\+)\s*$/i;
function cleanSource(value){
 let s=clean(value);
 for(let i=0;i<2;i++)s=s.replace(portalTail,'').trim();
 return s.replace(/(?:\s*[|/,:;-]){2,}\s*/g,' ').replace(/\s{2,}/g,' ').trim();
}
function brokenTitle(value){
 const s=cleanSource(value);
 if(!s||/^(?:untitled(?: school)?(?: material)?|pdf|document|material|attachment|file|school material)$/i.test(s))return true;
 if(/^(?:(?:mm|ref|id|no|doc|scan|img|image|page)[-\/\s.:_\d]*)+$/i.test(s))return true;
 if(/^[\d\s\/.:#_-]+$/.test(s))return true;
 if(/^[a-z]{1,3}(?:[-_\/\s]?\d{1,5})+[-_\/\s\d]*$/i.test(s))return true;
 return !/[\p{L}]{3}/u.test(s);
}
function filename(record){
 const source=record?.file_name||record?.filename||record?.original_filename||
  record?.raw?.filename||record?.raw?.file_name||record?.pdf_url||record?.pdfUrl||'';
 let s=String(source).split(/[?#]/)[0].split('/').pop()||'';
 try{s=decodeURIComponent(s)}catch{}
 return clean(s.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').replace(/(?<=\p{L})-(?=\p{L})/gu,' '));
}
function naturalTitle(value){
 let s=cleanSource(value).replace(/\s*(?:\.{3}|…)\s*$/,'').trim();
 s=s.replace(/\s*[&+]\s*$/,'').replace(truncated,'').trim();
 s=s.replace(/^[\s;|/,:-]+|[\s;|/,:-]+$/g,'').trim();
 return s;
}
function approved(record){
 return record?.manual_approved===true||record?.metadata_approved===true||
  /^(?:approved|manually_approved|manual-approved)$/i.test(String(record?.metadata_review_status||''));
}
function summarize(record,chosenTitle){
 const evidence=cleanSource(record?.description||record?.summary||record?.raw?.description||record?.raw?.message||'');
 if(!evidence||/^(?:pdf attached|attachment|document attached|n\/a)$/i.test(evidence))return unavailable;
 const t=chosenTitle.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const d=evidence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 if(d===t||d===t+'.')return unavailable;
 return evidence.slice(0,500).trim();
}
function inspect(record,options={}){
 const value=typeof record==='string'?{title:record}:(record||{});
 const sourceTitle=String(value.title||value.name||'');
 const raw=naturalTitle(sourceTitle);
 const label=filename(value);
 const useFilename=brokenTitle(raw)&&!brokenTitle(label);
 const title=approved(value)&&!brokenTitle(raw)?raw:
  useFilename?naturalTitle(label):brokenTitle(raw)?neutral:raw;
 let result=title||neutral;
 const rawDetail=clean(value.description||value.message||value.fullMessage||'');
 const match=result.match(/^(?:ch\.?|chapter)\s*(\d+(?:\.\d+)?)(?:\s+was completed in the book)?$/i)
    || raw.match(/^(?:ch\.?|chapter)\s*(\d+(?:\.\d+)?)\s+was completed in the book(?:\s*&)?$/i);
 if(match&&!approved(value)){
  result='Chapter '+match[1]+' Completed';
  if(/\bantonyms\b/i.test(rawDetail))result+=' · Antonyms';
  const mod=rawDetail.match(/\bmodule\s*(\d{1,3})\b/i);
  if(mod)result+=' (Module '+mod[1]+')';
 }
 const description=summarize(value,result);
 const issues=[];
 if(brokenTitle(raw))issues.push('low_quality_title');
 if(portalTail.test(clean(sourceTitle))||portalTail.test(clean(value.description||'')))issues.push('portal_navigation');
 if(description===unavailable)issues.push('insufficient_description');
 return {title:result,description,source:useFilename?'filename':result===neutral?'fallback':'existing',version:VERSION,
  reviewNeeded:issues.length>0&&!approved(value),issues};
}
function display(record){
 // Do not run filename inference for announcements. Their formatting has its own source logic.
 if(typeof record==='object'&&record!==null&&(record.category||record.messageDate||record.eventDate||record.kind==='announcement')){
  const x=naturalTitle(record.title||'');
  return x||'School announcement';
 }
 return inspect(record).title;
}
function validateSuggestion(suggestion,record){
 if(!suggestion||typeof suggestion!=='object'||Array.isArray(suggestion))return {valid:false,reason:'invalid_json'};
 const title=naturalTitle(suggestion.title),description=cleanSource(suggestion.description);
 if(brokenTitle(title)||title.length>130||description.length>500)return {valid:false,reason:'low_quality_or_size'};
 const original=record||{};
 const evidence=[original.title,original.description,original.filename,original.file_name,
  original.raw?.message,original.raw?.description,original.pdfText,original.pdfHeading]
  .map(x=>cleanSource(x)).join(' ').toLowerCase();
 // A proposed topic must be evidenced in at least one source, not invented by a model.
 const tokens=title.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
 const stop=new Set(['the','and','a','for','of','in','on','at','to','pdf','chapter','exercise','worksheet','class','test','circular','material','school','notes','work']);
 for(const token of tokens){
  if(token.length<=2||stop.has(token))continue;
  if(!evidence.includes(token))return {valid:false,reason:'unsupported_topic'};
 }
 const chapter=title.match(/\b(?:chapter|ch\.?|exercise)\s*(\d+(?:\.\d+)?)\b/i);
 if(chapter&&!new RegExp('\\b'+chapter[1].replace('.','\\.')+'\\b').test(evidence))return {valid:false,reason:'unsupported_number'};
 return {valid:true,title,description:description||unavailable};
}
function normalizeMaterial(record){
 if(record&&typeof record==='object'&&record._sourceMetadata&&record._metadataQuality?.version===VERSION)return {...record};
 const original=(record&&typeof record==='object')?record:{title:String(record||'')};
 const result=inspect(original);
 // Keep the original backend source and identity, with an explicit audit snapshot.
 return {...original,title:result.title,description:result.description,
  _sourceMetadata:original._sourceMetadata||{
   title:original.title||'',description:original.description||'',
   filename:original.file_name||original.filename||'',
   source:original.source||''
  },_metadataQuality:{source:result.source,version:result.version,
   issues:result.issues,reviewNeeded:result.reviewNeeded}};
}
root.__8apdfTitleClarity={clean,cleanSource,display,inspect,normalizeMaterial,validateSuggestion,version:VERSION};
})(typeof window!=='undefined'?window:globalThis);
