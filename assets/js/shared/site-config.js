// Apply site config: fetch from API, fallback to localStorage cache
// Shared across all pages — updates logo, brand name, and nav links.
// index.html additionally applies join-section / social links (inline).
(async function applySiteConfig() {
    const SITE_CFG_KEY = 'site_config';
    const API_URL      = (window.API_URL || 'http://localhost:3001');

    let cfg = null;

    // 1. Try API (short timeout so it never blocks render)
    try {
        const ac = new AbortController();
        const t  = setTimeout(() => ac.abort(), 3000);
        const res = await fetch(API_URL + '/api/site-settings', { cache: 'no-cache', signal: ac.signal });
        clearTimeout(t);
        if (res.ok) {
            cfg = await res.json();
            if (cfg && Object.keys(cfg).length > 0) {
                localStorage.setItem(SITE_CFG_KEY, JSON.stringify(cfg));
            }
        }
    } catch { /* network error or timeout — fall through to cache */ }

    // 2. Fallback: localStorage cache
    if (!cfg || Object.keys(cfg).length === 0) {
        try {
            const raw = localStorage.getItem(SITE_CFG_KEY);
            if (raw) cfg = JSON.parse(raw);
        } catch {}
    }

    // Dispatch event so page-specific scripts can react without polling
    document.dispatchEvent(new CustomEvent('siteConfigReady', { detail: cfg || {} }));

    if (!cfg || Object.keys(cfg).length === 0) return;

    // ── Site Title ─────────────────────────────────────────────
    if (cfg.siteTitle) {
        document.title = cfg.siteTitle;
    }

    // ── Logo & brand name ──────────────────────────────────────
    if (cfg.logoUrl) {
        document.querySelectorAll('img.logo-img').forEach(el => el.src = cfg.logoUrl);
        const fav = document.querySelector('link[rel="icon"]');
        if (fav) fav.href = cfg.logoUrl;
    }
    if (cfg.brandMain) document.querySelectorAll('.lbn-main').forEach(el => el.textContent = cfg.brandMain);
    if (cfg.brandSub)  document.querySelectorAll('.lbn-sub').forEach(el => el.textContent = cfg.brandSub);

    // ── Nav links (register / customer login) ─────────────────
    if (cfg.linkRegister) {
        document.querySelectorAll('a.dropdown-link[href*="register"]').forEach(el => el.href = cfg.linkRegister);
    }
    if (cfg.linkCustLogin) {
        document.querySelectorAll('a.dropdown-link[href*="billing"]').forEach(el => {
            if (!el.href.includes('register')) el.href = cfg.linkCustLogin;
        });
    }

    // ── Email links ───────────────────────────────────────────
    if (cfg.email) {
        const emailSubject = cfg.emailSubject || 'Ingin Berlangganan SKY TECH';
        const emailBody    = cfg.emailBody    || 'Halo, saya ingin berlangganan layanan internet SKY TECH.';
        const mailtoQuery  = '?subject=' + encodeURIComponent(emailSubject) + '&body=' + encodeURIComponent(emailBody);
        const mailtoHref   = 'mailto:' + cfg.email + mailtoQuery;
        document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
            el.href = mailtoHref;
            const t = el.textContent.trim();
            if (/^[^\s@]+@[^\s@]+$/.test(t)) el.textContent = cfg.email;
        });
    }

    // ── WhatsApp links ────────────────────────────────────────
    if (cfg.phone) {
        const waText = cfg.waMessage || 'Halo, saya ingin berlangganan layanan internet SKY TECH.';
        const num    = cfg.phone.replace(/^\+/, '');
        document.querySelectorAll('a[href^="https://wa.me/"]').forEach(el => {
            el.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(waText);
            const t = el.textContent.trim();
            if (/^[+\d\s-]+$/.test(t) && t.length > 6) el.textContent = '+' + num;
        });
    }

    // ── Maps / address links ──────────────────────────────────
    if (cfg.address) {
        document.querySelectorAll('a[href*="maps.app.goo.gl"], a[href*="maps.google"]').forEach(el => {
            if (cfg.maps) el.href = cfg.maps;
            el.textContent = cfg.address;
        });
    }
})();
