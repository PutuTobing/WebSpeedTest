// GET /api/geolocate?ip=<ip_address>
// Proxy ip-api.com geolocation requests server-side to avoid browser
// CORS errors, mixed-content blocks, and IP-based 403 responses.
// If `ip` is omitted or 'client', returns geolocation for the requesting client's IP.
const express = require('express');
const router  = express.Router();

// Private / reserved IP ranges (RFC 1918, CGNAT, loopback, link-local, ::1)
const PRIVATE_RE = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1([01]\d|2[0-7]))\.|169\.254\.|::1$)/;

function isPrivate(ip) {
    return !ip || PRIVATE_RE.test(ip);
}

// Validate IPv4 or IPv6 loosely — just block obviously bad input
function isSafeIp(ip) {
    if (!ip || ip.length > 45) return false;
    return /^[0-9a-fA-F.:]+$/.test(ip);
}

router.get('/', async (req, res) => {
    let ip = (req.query.ip || '').trim();

    // If no IP provided, use client's IP
    if (!ip || ip === 'client') {
        ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket?.remoteAddress
            || '';
    }

    if (!isSafeIp(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    // For private IPs, return early — no need to call external API
    if (isPrivate(ip)) {
        return res.json({ status: 'private', ip, isPrivate: true });
    }

    try {
        const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,query,lat,lon,country,countryCode,regionName,city,isp,org,as`;
        const upstream = await fetch(url, {
            headers: { 'User-Agent': 'SpeedTestGeoProxy/1.0' },
            signal: AbortSignal.timeout(8000)
        });

        if (!upstream.ok) {
            return res.status(502).json({ error: `ip-api returned ${upstream.status}` });
        }

        const data = await upstream.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h cache
        res.json({ ...data, isPrivate: false });
    } catch (err) {
        res.status(502).json({ error: 'Geolocation lookup failed', detail: err.message });
    }
});

module.exports = router;
