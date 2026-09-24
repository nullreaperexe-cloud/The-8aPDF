export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const rawFilename = Array.isArray(req.query.filename) ? req.query.filename[0] : req.query.filename;

  if (!rawUrl) return res.status(400).json({ error: 'Missing PDF URL' });

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid PDF URL' });
  }

  if (!['https:', 'http:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'Unsupported URL protocol' });
  }

  const host = target.hostname.toLowerCase();
  const blocked =
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
    host === '::1' || host.endsWith('.local') ||
    /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (blocked) return res.status(403).json({ error: 'Blocked host' });

  let filename = String(rawFilename || 'study-material.pdf')
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!filename) filename = 'study-material.pdf';
  if (!/\.pdf$/i.test(filename)) filename += '.pdf';

  try {
    const upstream = await fetch(target.toString(), {
      redirect: 'follow',
      headers: {
        'Accept': 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
        'Referer': 'https://edusecure.org/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({
        error: `PDF host returned ${upstream.status || 'no body'}`
      });
    }

    const encoded = encodeURIComponent(filename).replace(/['()]/g, c =>
      '%' + c.charCodeAt(0).toString(16).toUpperCase()
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="study-material.pdf"; filename*=UTF-8''${encoded}`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream chunks to Vercel response instead of converting the whole PDF to a Buffer.
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    console.error('8aPDF download proxy:', error);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Could not fetch PDF from its host' });
    }
    return res.end();
  }
}
