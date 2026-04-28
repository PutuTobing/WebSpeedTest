// GET /api/geolocate?ip=<ip_address>
// Proxy geolocation requests server-side to avoid browser CORS errors,
// mixed-content blocks, and IP-based 403 responses from external APIs.
// If `ip` is omitted or 'client', detects the requesting client's real IP
// (works correctly behind nginx / reverse proxies via x-forwarded-for).
//
// Primary:  ip-api.com (HTTP, free, 45 req/min)
// Fallback: ipinfo.io  (HTTPS, free, 50k req/month)
const express = require('express');
const router  = express.Router();

// Private / reserved IP ranges (RFC 1918, CGNAT, loopback, link-local, ::1)
const PRIVATE_RE = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1([01]\d|2[0-7]))\.|169\.254\.|::1$|::$)/;

function isPrivate(ip) {
    if (!ip) return true;
    // Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4)
    const clean = ip.replace(/^::ffff:/i, '');
    return PRIVATE_RE.test(clean);
}

// Validate IPv4 or IPv6 loosely — block obviously bad input
function isSafeIp(ip) {
    if (!ip || ip.length > 45) return false;
    return /^[0-9a-fA-F.:]+$/.test(ip);
}

// Extract real client IP — works behind nginx / load balancers
// Express req.ip already handles x-forwarded-for when trust proxy is enabled
function getRealClientIp(req) {
    // req.ip is set correctly by Express when app.set('trust proxy', true)
    const reqIp = req.ip || '';
    if (reqIp && reqIp !== '::1' && reqIp !== '127.0.0.1') {
        return reqIp.replace(/^::ffff:/i, '');
    }
    // Manual header fallback (nginx, Cloudflare, etc.)
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const first = xff.split(',')[0].trim();
        if (first) return first;
    }
    if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'].trim();
    if (req.headers['x-real-ip'])        return req.headers['x-real-ip'].trim();
    if (req.headers['x-client-ip'])      return req.headers['x-client-ip'].trim();
    const sock = (req.socket?.remoteAddress || '').replace(/^::ffff:/i, '');
    return sock;
}

// Simple in-memory cache (ip → {data, ts}) — avoids hammering ip-api.com
const _cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

async function geolocateIp(ip) {
    const now = Date.now();
    if (_cache.has(ip)) {
        const entry = _cache.get(ip);
        if (now - entry.ts < CACHE_TTL) return entry.data;
        _cache.delete(ip);
    }

    // Primary: ip-api.com (HTTP required — HTTPS needs paid plan)
    try {
        const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,query,lat,lon,country,countryCode,regionName,city,isp,org,as`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'SpeedTestGeoProxy/1.0' },
            signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                _cache.set(ip, { data, ts: now });
                return data;
            }
        }
    } catch { /* try fallback */ }

    // Fallback: ipinfo.io (HTTPS, no API key needed for basic fields)
    try {
        const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'SpeedTestGeoProxy/1.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
            const d = await res.json();
            // ipinfo returns loc as "lat,lon"
            if (d.ip && d.loc) {
                const [lat, lon] = d.loc.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lon)) {
                    const data = {
                        status: 'success', query: d.ip,
                        lat, lon, country: d.country, countryCode: d.country,
                        regionName: d.region, city: d.city,
                        isp: d.org || '', org: d.org || '', as: d.org || ''
                    };
                    _cache.set(ip, { data, ts: now });
                    return data;
                }
            }
        }
    } catch { /* both failed */ }

    return null;
}

router.get('/', async (req, res) => {
    let ip = (req.query.ip || '').trim();

    // 'client' or missing → detect real IP from request headers
    if (!ip || ip === 'client') {
        ip = getRealClientIp(req);
    }

    // Strip IPv6-mapped IPv4 prefix for display
    ip = ip.replace(/^::ffff:/i, '');

    if (!isSafeIp(ip)) {
        return res.status(400).json({ error: 'Invalid IP address', ip });
    }

    // Private / LAN IPs → return immediately without external API call
    if (isPrivate(ip)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.json({ status: 'private', ip, isPrivate: true });
    }

    const data = await geolocateIp(ip);
    if (!data) {
        return res.status(502).json({ error: 'Geolocation lookup failed — both ip-api.com and ipinfo.io returned no result', ip });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ ...data, isPrivate: false });
});

module.exports = router;
