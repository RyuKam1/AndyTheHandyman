const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing url query parameter.' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid image URL.' });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Only http/https image URLs are supported.' });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: { 'User-Agent': 'andy-the-handyman-image-proxy/1.0' },
    });

    if (!upstream.ok) {
      return res.status(400).json({ error: `Failed to load image (${upstream.status}).` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL does not point to an image.' });
    }

    const contentLength = Number.parseInt(upstream.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image is too large (max 8MB).' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image is too large (max 8MB).' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to fetch image.' });
  }
}
