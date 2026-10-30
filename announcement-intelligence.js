/* 8aPDF · Intelligent Announcement Reader
 * One formatter for cards, expanded notices, copy and native WhatsApp sharing.
 * Purely local on each view. Groq-generated formatting, when present in the
 * original Supabase raw record, is reused without repeat AI/API calls.
 */
(function(root){
  "use strict";
  function plain(value){
    return String(value == null ? "" : value)
      .replace(/<br\s*\/?>/gi,"\n").replace(/<\/p\s*>/gi,"\n")
      .replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ")
      .replace(/\r\n?/g,"\n").replace(/[\u200B-\u200D\uFEFF]/g,"")
      .replace(/[ \t]+/g," ").replace(/\n[ \t]+/g,"\n")
      .replace(/\n{3,}/g,"\n\n").trim();
  }
  function escapeHTML(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function isPrivate(item){
    var source=[item && item.title,item && item.description,item && item.message,
      item && item.originalMessage,item && item.fullMessage].map(plain).join(" ").toLowerCase();
    return String(item && item.id || "")==="edusecure-0779a1bb3f03949fb1c2b02fe692838b" ||
      /\battendance\b.{0,180}\byour\s+child\b.{0,130}\b(?:absent|present|late)\b/i.test(source) ||
      /\byour\s+child\b.{0,100}\b(?:is|was|marked)\b.{0,100}\b(?:absent|present|late)\b/i.test(source);
  }
  function removeChrome(source){
    var s=plain(source);
    s=s.replace(/^(?:Message|Circular|School Diary|Attendance)\s+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\s*/i,"");
    s=s.replace(/^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})[\s,:\-]*/i,"");
    s=s.replace(/^\s*(?:Dear\s+(?:Parents?|Students?|All|Sir|Madam))\s*[,:.\-]*\s*/i,"");
    s=s.replace(/^\s*(?:Good\s+(?:morning|afternoon|evening))\s*[,:.\-]*\s*/i,"");
    s=s.replace(/\s*(?:Warm\s+regards|Best\s+regards|Regards)\s*,?\s*(?:Team\s+[\w\s-]+)?\s*$/i,"");
    s=s.replace(/\s+(?:Pay Now|Read More|Preview|Download|Attachment|More)(?:\s+(?:Pay Now|Preview|Download|More))*\s*$/i,"");
    return s.replace(/\s{2,}/g," ").trim();
  }
  function sourceText(item){
    // Message/details have priority. Never replace a complete school message
    // with a short title or AI summary.
    return removeChrome((item && (
      item.originalMessage || item.fullMessage || item.message || item.description
    )) || "");
  }
  function sentencePoints(text){
    return plain(text).split(/\n+|(?<=[.!?।])\s+(?=[A-Z0-9\u0900-\u0A7F])/u)
      .map(function(t){return t.trim().replace(/^[•\-]\s*/,"");})
      .filter(Boolean).slice(0,12);
  }
  function structuredFallback(item){
    var text=sourceText(item);
    if(!text)return "*Key details*\n• Details are not available yet.";
    // EduSecure often flattens multiple headings into a single sentence.
    text=text.replace(/\s*(?:Home\s*Work|Homework)\s*:\s*/gi,"\n@@Homework@@\n")
      .replace(/\s*(?:Class\s*Work|Classwork)\s*:\s*/gi,"\n@@Classwork@@\n")
      .replace(/\s*(?:Important\s+Note|Note)\s*:\s*/gi,"\n@@Note@@\n")
      .replace(/\s*(?:Submission|Instructions)\s*:\s*/gi,function(m){return "\n@@"+(m.toLowerCase().includes("submission")?"Submission":"Instructions")+"@@\n";});
    var blocks=text.split(/\n@@(Homework|Classwork|Note|Submission|Instructions)@@\n/g);
    var sections=[];
    if(blocks.length>1){
      if(blocks[0].trim())sections.push(["Key details",blocks[0]]);
      for(var i=1;i<blocks.length;i+=2)sections.push([blocks[i],blocks[i+1]||""]);
    }else{
      sections.push([item && item.category && /homework|test|exam|assignment|event|project|result/i.test(item.category) ?
        "Key details":"What you need to know",text]);
    }
    return sections.map(function(section){
      var points=sentencePoints(section[1]);
      return points.length?"*"+section[0]+"*\n"+points.map(function(x){return "• "+x;}).join("\n"):"";
    }).filter(Boolean).join("\n\n").slice(0,2600);
  }
  function formatBody(item){
    var ai=plain(item && (item.formattedMessage || item.structuredMessage || item.raw && item.raw.formattedMessage));
    if(ai && ai.length>=12 && ai.length<=1400){
      // Keep the school card date out of the shareable prose, not event/deadline dates.
      ai=removeChrome(ai);
      if(ai)return ai;
    }
    return structuredFallback(item);
  }
  function inlineHTML(s){
    return escapeHTML(s).replace(/\*([^*\n]{1,160})\*/g,"<strong>$1</strong>");
  }
  function renderHTML(item){
    var lines=formatBody(item).split("\n");
    var html=[],points=[];
    function flush(){
      if(points.length){html.push('<ul class="ai-notice-list">'+points.map(function(p){return "<li>"+inlineHTML(p)+"</li>";}).join("")+"</ul>");points=[];}
    }
    lines.forEach(function(line){
      var str=line.trim();
      if(!str){flush();return;}
      var h=str.match(/^\*([^*]+)\*:?$/);
      if(h){flush();html.push('<div class="ai-notice-heading">'+escapeHTML(h[1])+"</div>");return;}
      var b=str.match(/^(?:[•\-\u2022]|\d+\.)\s+(.+)$/);
      if(b){points.push(b[1]);return;}
      flush();html.push('<p class="ai-notice-paragraph">'+inlineHTML(str)+"</p>");
    });
    flush();
    return '<div class="ai-notice-body">'+html.join("")+"</div>";
  }
  function preview(item,maxLength){
    var s=formatBody(item).replace(/\*/g,"").replace(/^\s*[•\-]\s*/gm,"").replace(/\n+/g," · ").replace(/\s+/g," ").trim();
    var max=Math.max(60,Math.min(500,Number(maxLength)||175));
    if(s.length>max)s=s.slice(0,max).replace(/\s+\S*$/,"")+"…";
    return s;
  }
  function copyText(item){
    var title=plain(item && item.title || "School announcement").replace(/^\*+|\*+$/g,"");
    var body=formatBody(item);
    var attachment=plain(item && (item.attachmentUrl||item.attachment_url));
    var link="";
    try{if(attachment && new URL(attachment).protocol==="https:")link="\n\nAttachment: "+attachment;}catch(e){}
    return "*"+title+"*\n\n"+body+link;
  }
  async function copy(item){
    var output=copyText(item);
    if(navigator.clipboard && navigator.clipboard.writeText){try{await navigator.clipboard.writeText(output);return true;}catch(e){}}
    if(typeof root.prompt==="function")root.prompt("Copy announcement:",output);
    return false;
  }
  async function share(item){
    var output=copyText(item);
    if(navigator.share){
      try{await navigator.share({title:plain(item && item.title||"School announcement"),text:output});return "shared";}
      catch(e){if(e && e.name==="AbortError")return "cancelled";}
    }
    return (await copy(item))?"copied":"manual";
  }
  root.EightAPDFAnnouncementUI=Object.freeze({
    isPrivate:isPrivate,sourceText:sourceText,formatBody:formatBody,
    renderHTML:renderHTML,preview:preview,copyText:copyText,copy:copy,share:share
  });
})(window);
