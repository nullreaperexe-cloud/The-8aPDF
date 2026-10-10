// Gemini runs only on Vercel. GEMINI_API_KEY must be a Vercel environment variable.
const MODEL='gemini-2.5-flash-lite';
const hits=new Map();
function json(res,status,data){res.status(status).setHeader('Cache-Control','no-store').json(data)}
export default async function handler(req,res){
 if(req.method==='GET')return json(res,200,{configured:!!process.env.GEMINI_API_KEY,model:MODEL});
 if(req.method!=='POST')return json(res,405,{error:'POST only'});
 if(!process.env.GEMINI_API_KEY)return json(res,503,{error:'GEMINI_API_KEY is not configured in Vercel Environment Variables. GitHub Actions secrets do not automatically reach Vercel functions.'});
 const source=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,70);
 const now=Date.now(),recent=(hits.get(source)||[]).filter(t=>t>now-120000);if(recent.length>=8)return json(res,429,{error:'Too many summary requests. Please retry shortly.'});recent.push(now);hits.set(source,recent);if(hits.size>500)hits.clear();
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
 const title=String(body?.title||'School PDF').slice(0,160),content=String(body?.text||'').slice(0,24000);
 if(content.trim().length<80)return json(res,400,{error:'Could not read enough PDF text. Scanned-image PDFs may require OCR.'});
 const prompt=`You are a careful Class 8 study assistant. Summarize ONLY the provided school PDF text in the language used by the document. Use short, accurate and useful headings. Include: 1) Quick summary (max 110 words), 2) 5 key points, 3) essential terms / formulas if present, 4) 3 quick practice questions. Do NOT invent facts not in the text. Keep total answer below 400 words.\nPDF Title: ${title}\nTEXT:\n${content}`;
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);
  let response;try{response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:1024}}),signal:ctrl.signal})}finally{clearTimeout(timer)}
  if(!response.ok){console.warn('8aPDF summarizer Gemini status',response.status);return json(res,response.status===429?429:502,{error:response.status===429?'Gemini quota reached. Try later.':'Gemini summarization temporarily unavailable.'})}
  const payload=await response.json();const summary=(payload.candidates||[]).flatMap(x=>x.content?.parts||[]).map(x=>x.text||'').join('').trim();
  if(!summary)return json(res,502,{error:'Gemini returned no readable summary.'});return json(res,200,{summary:summary.slice(0,4600),model:MODEL});
 }catch(e){console.warn('8aPDF summarize:',String(e));return json(res,502,{error:'Summary request timed out or could not complete.'})}
}