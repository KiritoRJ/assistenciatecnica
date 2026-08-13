export default async function handler(req: any, res: any) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const finalUrl = response.url;
    const match = finalUrl.match(/\/video\/(\d+)/);
    const videoId = match ? match[1] : null;

    return res.status(200).json({ finalUrl, videoId });
  } catch (err) {
    console.error('Error resolving TikTok URL:', err);
    return res.status(500).json({ error: 'Failed to resolve URL' });
  }
}
