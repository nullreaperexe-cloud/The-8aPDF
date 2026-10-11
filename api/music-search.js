export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const key=process.env.YOUTUBE_API_KEY;
 if(!key)return res.status(503).json({error:'YouTube search requires YOUTUBE_API_KEY in Vercel settings'});
 const q=String(req.query?.q||'').trim().slice(0,120);
 if(q.length<2)return res.status(400).json({error:'Enter at least 2 characters'});
 try{
 const p=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',videoCategoryId:'10',maxResults:'20',q,key});
 const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+p);
 const data=await response.json();
 if(!response.ok)return res.status(response.status).json({error:'YouTube search temporarily unavailable'});
 const items=(data.items||[]).filter(x=>x.id?.videoId).map(x=>({videoId:x.id.videoId,title:x.snippet.title,channel:x.snippet.channelTitle}));
 res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');
 return res.status(200).json({items});
 }catch{return res.status(502).json({error:'Could not reach YouTube search'})}
}