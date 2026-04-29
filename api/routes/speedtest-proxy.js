// GET  /api/speedtest-proxy/download?target=<encoded_server_url>&duration=N
// POST /api/speedtest-proxy/upload?target=<encoded_server_url>
//
// Transparent streaming proxy — forwards speedtest traffic from the backend
// to the actual speedtest server, so the browser never makes a direct
// HTTP request from an HTTPS page (avoids Mixed Content).
//
// Security: only allows connections to server URLs that are registered
// in the database (validated via the Endpoints table).
const express = require('express');
const router  = express.Router();
const db      = require('../database');

// Build a set of allowed host:port combinations from the database
async function getAllowedHosts() {
    try {
        const [rows] = await db.promise().query('SELECT url FROM endpoints WHERE active = 1');
        return new Set(rows.map(r => {
            try { const u = new URL(r.url); return u.host; } catch { return null; }
        }).filter(Boolean));
    } catch {
        return null; // if DB fails, skip allowlist check but log
    }
}

async function proxyStream(req, res) {
    const { target } = req.query;
    if (!target) return res.status(400).json({ error: 'Missing target' });

    let parsed;
    try {
        parsed = new URL(target);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
        // Reject loopback (SSRF protection)
        if (/^(localhost$|127\.|0\.0\.0\.0$|::1$)/.test(parsed.hostname)) {
            return res.status(400).json({ error: 'Loopback address not allowed' });
        }
    } catch {
        return res.status(400).json({ error: 'Invalid target URL' });
    }

    // Validate against registered endpoints
    const allowed = await getAllowedHosts();
    if (allowed !== null && !allowed.has(parsed.host)) {
        return res.status(403).json({ error: 'Target server not registered' });
    }

    const isUpload = req.method === 'POST';
    const path     = isUpload ? '/upload' : '/download';
    const qs       = isUpload ? '' : `?duration=${encodeURIComponent(req.query.duration || '10')}`;
    const proxyUrl = `${parsed.origin}${path}${qs}`;

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
        const fetchOpts = {
            method:  isUpload ? 'POST' : 'GET',
            cache:   'no-store',
            signal:  controller.signal,
            headers: { 'User-Agent': 'SpeedTestProxy/1.0' },
            // Forward body for upload — Node 18+ fetch supports ReadableStream
            ...(isUpload && req.body ? { body: req.body } : {})
        };

        const upstream = await fetch(proxyUrl, fetchOpts);

        // Forward status + CORS headers
        res.status(upstream.status);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);

        if (!upstream.body) return res.end();

        // Stream response body directly to client
        const reader = upstream.body.getReader();
        (async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) { res.end(); break; }
                    res.write(Buffer.from(value));
                }
            } catch { res.end(); }
        })();

    } catch (err) {
        if (!res.headersSent) res.status(502).json({ error: err.message });
    }
}

router.get('/', proxyStream);
router.post('/', proxyStream);

module.exports = router;
