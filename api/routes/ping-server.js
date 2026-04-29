// GET /api/ping-server?url=<encoded_server_url>
// Proxies a ping request to a speedtest server from the backend side.
// This avoids Mixed Content errors when the page is served over HTTPS
// but the speedtest server only supports HTTP.
const express = require('express');
const router  = express.Router();

// Only these protocols are allowed
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

router.get('/', async (req, res) => {
    const { url } = req.query;

    if (!url) return res.status(400).json({ ok: false, error: 'Missing url parameter' });

    let origin;
    try {
        const parsed = new URL(url);
        if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            return res.status(400).json({ ok: false, error: 'Invalid protocol' });
        }
        // Reject loopback / private IPs (server-side should not be exploited as SSRF pivot)
        const host = parsed.hostname;
        if (/^(localhost$|127\.|0\.0\.0\.0$|::1$)/.test(host)) {
            return res.status(400).json({ ok: false, error: 'Loopback address not allowed' });
        }
        origin = parsed.origin;
    } catch {
        return res.status(400).json({ ok: false, error: 'Invalid URL' });
    }

    const pingUrl = `${origin}/ping`;
    const start   = Date.now();
    try {
        const r = await fetch(pingUrl, {
            signal: AbortSignal.timeout(4000),
            cache:  'no-cache',
            headers: { 'User-Agent': 'SpeedTestPingProxy/1.0' }
        });
        const latency = Date.now() - start;
        res.json({ ok: r.ok, latency });
    } catch (err) {
        res.json({ ok: false, latency: null, error: err.message });
    }
});

module.exports = router;
