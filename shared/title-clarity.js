/* Shared, deterministic display-only normalization. Never changes a Supabase record. */
(function(root){
 'use strict';
 const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/[\t\r\n ]+/g,' ').trim();
 const invalidTitle=/^(?:MM\s*\/\s*\/\s*01\s*\/|MM\s*\/\s*\/\s*\d{1,2}\s*\/|\/?\s*\/?\s*\d{1,2}\s*\/)$/i;
 const bareJunk=/^(?:(?:attachment|pay now|read more|view more|download pdf|click here)\s*)+$/i;
 // Remove only a clearly identified portal-control cluster, never a school topic.
 function removePortalJunk(value){
  let text=clean(value);
  text=text.replace(/\s+Attachment\s+Pay\s+Now(?=\s|$)/gi,' ');
  text=text.replace(/\s+(?:(?:Pay\s+Now|Read\s+More|View\s+More|Download\s+PDF|Click\s+Here)(?:\s+Attachment)?)(?=\s|$)/gi,' ');
  text=text.replace(/(?:\s+(?:Attachment|Pay\s+Now|Read\s+More|View\s+More|Download\s+PDF|Click\s+Here))+\s*$/gi,'');
  return clean(text);
 }
 function display(record){
  const value=typeof record==='string'?record:(record?.rawTitle??record?.title);
  const raw=clean(value);
  if(!raw||invalidTitle.test(raw)||bareJunk.test(raw))return 'School Material';
  const result=removePortalJunk(raw);
  return result&&!invalidTitle.test(result)?result:'School Material';
 }
 function description(record){
  const value=typeof record==='string'?record:(record?.rawDescription??record?.description);
  return removePortalJunk(value);
 }
 function normalize(record){
  if(!record||typeof record!=='object')return record;
  const rawTitle=record.rawTitle??record.title??'';
  const rawDescription=record.rawDescription??record.description??'';
  return {...record,rawTitle,rawDescription,title:display({rawTitle}),description:description({rawDescription})};
 }
 function filename(record){
  return display(record).replace(/[\\\/:*?"<>|\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').trim()+'.pdf';
 }
 root.__8apdfTitleClarity={clean,display,description,normalize,filename,removePortalJunk};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.__8apdfTitleClarity;
})(typeof window!=='undefined'?window:globalThis);
