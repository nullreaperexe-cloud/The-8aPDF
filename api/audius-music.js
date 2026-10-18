/* 8aPDF Audius discovery proxy. Read-only; no music files are hosted here. */
const API = 'https://api.audius.co/v1';
const MAX_LIMIT = 24;
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  const query = String(req.query?.q || '').trim().slice(0,100);
  const type = query.length >= 2 ? 'search' : 'trending';
  if (query.length === 1) return res.status(400).json({error:'Search needs at least 2 characters'});
  const limit = Math.max(1,Math.min(MAX_LIMIT,Number(req.query?.limit)||20));
  const offset = Math.max(0,Math.min(500,Number(req.query?.offset)||0));
  const endpoint = new URL(API + '/tracks/' + type);
  endpoint.searchParams.set('limit',String(limit));
  endpoint.searchParams.set('offset',String(offset));
  endpoint.searchParams.set('app_name','8apdf');
  if (type === 'search') endpoint.searchParams.set('query',query);
  if (type === 'search') endpoint.searchParams.set('sort_method','relevant');
  try {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),11500);
    let response;
    try {
      response = await fetch(endpoint, {
        signal:controller.signal,
        headers:{'Accept':'application/json', ...(process.env.AUDIUS_API_KEY ? {'x-api-key':process.env.AUDIUS_API_KEY} : {})}
      });
    } finally {clearTimeout(timer);}
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return res.status(status).json({error:status===429?'Audius rate limit reached. Try again shortly.':'Audius is temporarily unavailable.'});
    }
    const payload = await response.json();
    const raw = Array.isArray(payload.data) ? payload.data : [];
    const safeArt = value => {
      if (typeof value !== 'string') return '';
      try { const url=new URL(value);return url.protocol==='https:' ? url.href : '';} catch {return '';}
    };
    const tracks = raw.filter(t => t && typeof t.id === 'string' && /^[\w-]{2,90}$/.test(t.id) &&
      !t.is_stream_gated && !t.is_delete && t.is_available !== false && t.is_scheduled_release !== true)
      .map(t => ({
        id:t.id,
        title:String(t.title||'Untitled track').slice(0,160),
        artist:String(t.user?.name||'Independent artist').slice(0,120),
        artwork:safeArt(t.artwork?.['480x480']||t.artwork?.['150x150']||t.artwork?.['1000x1000']),
        duration:Math.max(0,Math.min(Number(t.duration)||0,36000)),
        genre:String(t.genre||'Music').slice(0,55)
      }));
    res.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=240');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).json({tracks,hasMore:raw.length>=limit,source:'Audius'});
  } catch (e) {
    return res.status(502).json({error:'Could not connect to Audius. Please retry.'});
  }
}
