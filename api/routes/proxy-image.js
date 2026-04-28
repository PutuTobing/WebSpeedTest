// GET /api/proxy-image?url=<encoded_url>
// Fetch an external image server-side (no browser CORS restriction) and
// return it with CORS headers so the browser can draw it onto a Canvas.
// Only image/* content-types are forwarded — other types are rejected.
const express = require('express');
const router  = express.Router();

// Simple allowlist check: only allow http/https URLs
function isSafeUrl(raw) {
    try {
        const u = new URL(raw);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
}

router.get('/', async (req, res) => {
    const raw = req.query.url;
    if (!raw || !isSafeUrl(raw)) {
        return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }

    try {
        const upstream = await fetch(raw, {
            headers: { 'User-Agent': 'SpeedTestProxy/1.0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000)
        });

        const ct = upstream.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) {
            return res.status(415).json({ error: 'URL is not an image' });
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());

        res.set({
            'Content-Type': ct,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });
        res.send(buffer);
    } catch (err) {
        res.status(502).json({ error: 'Failed to fetch image', detail: err.message });
    }
});

module.exports = router;
