/* On-demand PDF evidence extraction. Never called by listing/card renders.
 * No OCR is executed; unreadable scans are marked for human review.
 */
export async function extractPdfEvidence({
 pdfUrl,fetchImpl=fetch,pdfjs=null,signal,maxBytes=8*1024*1024,maxPages=3,maxChars=4500
}={}){
 if(!pdfUrl||typeof pdfUrl!=='string')throw new TypeError('PDF URL is required');
 const limit=Math.min(maxBytes,8*1024*1024),pages=Math.min(maxPages,3),chars=Math.min(maxChars,4500);
 const parsed=new URL(pdfUrl,location?.origin||'https://www.8apdf.me');
 if(!['https:','http:'].includes(parsed.protocol))throw new TypeError('Only HTTP(S) PDF URLs are supported');
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,9000);
 let pdf=null;
 try{
  const response=await fetchImpl('/api/download?url='+encodeURIComponent(pdfUrl)+'&filename=evidence.pdf',{signal:controller.signal});
  if(!response.ok)throw new Error('PDF is not available');
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>limit)throw new RangeError('PDF is too large for metadata extraction');
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>limit)throw new RangeError('PDF exceeds bounded extraction size');
  const engine=pdfjs||await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  if(!pdfjs)engine.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  pdf=await engine.getDocument({data:new Uint8Array(buffer)}).promise;
  const candidates=[],text=[];
  for(let pageIndex=1;pageIndex<=Math.min(pages,pdf.numPages)&&text.join(' ').length<chars;pageIndex++){
   const page=await pdf.getPage(pageIndex),layout=await page.getTextContent();
   const rows=layout.items.filter(item=>typeof item.str==='string'&&item.str.trim()).map(item=>({
    value:item.str.trim().slice(0,300),size:Math.abs(item.transform?.[0]||item.height||10),
    y:Math.round(item.transform?.[5]||0)
   }));
   for(const row of rows)text.push(row.value);
   // Larger text near the top of early pages is heading evidence, never unquestionable truth.
   for(const row of rows.filter(x=>x.value.length>=5&&x.value.length<=125&&x.size>=12).slice(0,20))
    candidates.push({text:row.value,page:pageIndex,fontSize:Math.round(row.size),y:row.y});
  }
  const sourceText=text.join(' ').replace(/\s+/g,' ').slice(0,chars);
  return {
   sourceText,headingCandidates:candidates.slice(0,25),
   readable:sourceText.trim().length>=45,
   reviewNeeded:sourceText.trim().length<45,
   reason:sourceText.trim().length<45?'Text layer unavailable; scanned PDF may require OCR':null,
   pagesChecked:Math.min(pages,pdf.numPages),version:'pdf-evidence-v1'
  };
 }finally{
  clearTimeout(timeout);signal?.removeEventListener('abort',abort);
  try{await pdf?.destroy?.()}catch{}
 }
}
