/* YouTube Data API search; requires YOUTUBE_API_KEY in Vercel environment.
   Never scrape YouTube pages, hide the video embed, or return fake video IDs. */
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const key=process.env.YOUTUBE_API_KEY;
 if(!key)return res.status(503).json({error:'YouTube song lookup is not configured on this Vercel project. YOUTUBE_API_KEY is required for unlinked tracks.',code:'YOUTUBE_API_KEY_MISSING'});
 const q=String(req.query?.q||'').trim().slice(0,145);
 if(q.length<2)return res.status(400).json({error:'Enter at least 2 characters'});
 const json=async(path,params)=>{
  params.set('key',key);
  const response=await fetch('https://www.googleapis.com/youtube/v3/'+path+'?'+params,{headers:{Accept:'application/json'}});
  const data=await response.json();
  if(!response.ok){
   const reason=data.error?.errors?.[0]?.reason||'';
   if(reason==='quotaExceeded'||reason==='dailyLimitExceeded')throw Object.assign(new Error('YouTube video lookup quota exhausted. Try later.'),{status:429,code:'YOUTUBE_QUOTA'});
   throw Object.assign(new Error('YouTube video lookup is unavailable.'),{status:502,code:'YOUTUBE_API_ERROR'});
  }
  return data;
 };
 try{
  const search=await json('search',new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',videoCategoryId:'10',maxResults:'15',q}));
  const results=(search.items||[]).filter(x=>/^[\w-]{11}$/.test(x.id?.videoId));
  if(!results.length)return res.status(200).json({items:[]});
  const detail=await json('videos',new URLSearchParams({part:'status,contentDetails',id:results.map(x=>x.id.videoId).join(',')}));
  const allowed=new Set((detail.items||[]).filter(x=>x.status?.embeddable===true&&x.status?.privacyStatus==='public'&&!x.contentDetails?.regionRestriction?.blocked?.includes('IN')).map(x=>x.id));
  const items=results.filter(x=>allowed.has(x.id.videoId)).map(x=>({videoId:x.id.videoId,title:x.snippet?.title||'',channel:x.snippet?.channelTitle||''}));
  res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({items});
 }catch(e){
  return res.status(e.status||502).json({error:e.message||'Could not reach YouTube',code:e.code||'YOUTUBE_UNAVAILABLE'});
 }
}
