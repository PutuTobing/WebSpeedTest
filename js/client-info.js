/**
 * client-info.js
 * Detects client IP address, ISP, company name, AS number and location
 * using ip-api.com (free, no API key required, 45 req/min limit)
 * with fallback to ipinfo.io
 */

(function () {
    'use strict';

    const PRIMARY_URL   = 'https://ip-api.com/json/?fields=status,query,isp,org,as,city,regionName,country,countryCode';
    const FALLBACK_URL  = 'https://ipinfo.io/json';
    const TIMEOUT_MS    = 6000;

    function setText(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    function setError(message) {
        const errHtml = `<span class="cib-error">${message}</span>`;
        setText('cib-ip',  errHtml);
        setText('cib-isp', errHtml);
        setText('cib-asn', errHtml);
        setText('cib-loc', errHtml);
    }

    /**
     * Parse AS number and org name from ip-api "as" field.
     * Example: "AS142264 PT SKY Base Technologhy Digital"
     * Returns { asn: "AS142264", orgName: "PT SKY Base Technologhy Digital" }
     */
    function parseAS(asField) {
        if (!asField) return { asn: '—', orgName: '—' };
        const match = asField.match(/^(AS\d+)\s+(.+)$/i);
        if (match) return { asn: match[1].toUpperCase(), orgName: match[2] };
        return { asn: asField, orgName: '' };
    }

    /**
     * Build flag emoji from ISO country code (2 letters)
     */
    function countryFlag(code) {
        if (!code || code.length !== 2) return '';
        const base = 0x1F1E6 - 65; // 'A' = 65
        return String.fromCodePoint(base + code.toUpperCase().charCodeAt(0))
             + String.fromCodePoint(base + code.toUpperCase().charCodeAt(1));
    }

    function applyPrimaryData(data) {
        if (data.status !== 'success') {
            setError('Tidak dapat dideteksi');
            return;
        }

        const { asn, orgName } = parseAS(data.as);

        // Prefer org (usually company name) over isp; fallback chain
        const company = (data.org && data.org !== data.isp) ? data.org : (data.isp || '—');
        // Strip AS prefix from org if present (ip-api sometimes includes it)
        const companyClean = company.replace(/^AS\d+\s+/i, '').trim() || '—';

        const flag = countryFlag(data.countryCode);
        const city = [data.city, data.regionName, data.country].filter(Boolean).join(', ');

        setText('cib-ip',  `<span title="${data.query}">${data.query}</span>`);
        setText('cib-isp', `<span title="${companyClean}">${companyClean}</span>`);
        setText('cib-asn', asn !== '—'
            ? `<a href="https://bgp.he.net/${asn}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline dotted" title="Lihat info ${asn} di Hurricane Electric BGP">${asn}</a>`
            : '—');
        setText('cib-loc', flag ? `${flag} ${city}` : city || '—');
    }

    function applyFallbackData(data) {
        // ipinfo.io format: { ip, org:"AS1234 ISP Name", city, region, country }
        const { asn, orgName } = parseAS(data.org || '');
        const flag = countryFlag(data.country);
        const city = [data.city, data.region, data.country].filter(Boolean).join(', ');

        setText('cib-ip',  data.ip || '—');
        setText('cib-isp', orgName || data.org || '—');
        setText('cib-asn', asn !== '—'
            ? `<a href="https://bgp.he.net/${asn}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline dotted">${asn}</a>`
            : '—');
        setText('cib-loc', flag ? `${flag} ${city}` : city || '—');
    }

    function fetchWithTimeout(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
            .then(r => { clearTimeout(timer); return r.json(); })
            .catch(err => { clearTimeout(timer); throw err; });
    }

    async function detectClientInfo() {
        try {
            // Try ip-api.com first (more accurate city/region data)
            const data = await fetchWithTimeout(PRIMARY_URL, TIMEOUT_MS);
            if (data.status === 'success') {
                applyPrimaryData(data);
            } else {
                throw new Error('ip-api returned non-success');
            }
        } catch (_) {
            // Fallback to ipinfo.io
            try {
                const data = await fetchWithTimeout(FALLBACK_URL, TIMEOUT_MS);
                if (data.ip) {
                    applyFallbackData(data);
                } else {
                    throw new Error('invalid response');
                }
            } catch (__) {
                setError('Gagal mendeteksi');
            }
        }
    }

    // Run after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', detectClientInfo);
    } else {
        detectClientInfo();
    }
})();
