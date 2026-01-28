export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing "url" query parameter' });
    }

    try {
        const decodedUrl = decodeURIComponent(url);

        // Validation: Only allow Telegram/RSS URLs to prevent abuse
        if (!decodedUrl.includes('rsshub.app') &&
            !decodedUrl.includes('tg.i-c-a.su') &&
            !decodedUrl.includes('briefly.ru') &&
            !decodedUrl.includes('telegram')) {
            // Optional: Uncomment to restrict
            // return res.status(403).json({ error: 'Forsbiden domain' });
        }

        const response = await fetch(decodedUrl);
        const data = await response.text();

        // Pass through Content-Type (important for XML/RSS)
        res.setHeader('Content-Type', response.headers.get('content-type') || 'text/xml');
        res.status(response.status).send(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
}
