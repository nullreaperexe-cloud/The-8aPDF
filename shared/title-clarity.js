/* 8aPDF title clarity: present source-backed, complete labels; never fabricate a school fact. */
(function(root){'use strict';
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const dangling=/\s+(?:find|and|or|of|for|to|in|with|from|the|a|an|&|\+)\s*$/i;
function display(record){
 const raw=clean(typeof record==='string'?record:record?.title);
 const detail=clean(typeof record==='string'?'':(record?.description||record?.message||record?.fullMessage||''));
 if(!raw)return 'Untitled school material';
 let title=raw.replace(/\s*(?:\.{3}|…)$/,'').trim();
 // A preview ending in an action word was cut by EduSecure; do not print the dangling fragment.
 title=title.replace(/\s+\bfind\s*$/i,'').replace(/\s*[&+]\s*$/,'').replace(dangling,'').trim();
 // A school lesson number is verifiable in both source and title. Prefer a clear topic.
 const chapter=title.match(/^(?:ch\.?|chapter)\s*(\d+(?:\.\d+)?)(?:\s+was completed in the book)?$/i)
   || raw.match(/^(?:ch\.?|chapter)\s*(\d+(?:\.\d+)?)\s+was completed in the book(?:\s*&)?$/i);
 if(chapter){
   title='Chapter '+chapter[1]+' Completed';
   if(/\bantonyms\b/i.test(detail))title+=' · Antonyms';
   const mod=detail.match(/\bmodule\s*(\d{1,3})\b/i);
   if(mod)title+=' (Module '+mod[1]+')';
 }
 return title||raw;
}
root.__8apdfTitleClarity={display,clean};
})(typeof window!=='undefined'?window:globalThis);
