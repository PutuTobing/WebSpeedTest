// API server URL — auto-detects hostname so it works on any machine.
// Logic:
//   - Port 80 / 443 → assume nginx reverse proxy, API on same origin (no port suffix)
//   - Port 8000 (dev) → API on port 3001 same host
//   - Any other port   → API on port 3001 same host
// Override SPEEDTEST_API_URL in localStorage to manually set a custom API URL.
(function () {
    var override = (typeof localStorage !== 'undefined' && localStorage.getItem('SPEEDTEST_API_URL')) || '';
    if (override) { window.API_URL = override; return; }

    var proto = window.location.protocol;        // 'http:' or 'https:'
    var host  = window.location.hostname;        // e.g. 'speedtest.example.com'
    var port  = parseInt(window.location.port, 10) || (proto === 'https:' ? 443 : 80);

    if (port === 80 || port === 443) {
        // Production: nginx serves frontend and proxies /api to Node on 3001
        // API is accessible on the same origin (no separate port)
        window.API_URL = proto + '//' + host;
    } else {
        // Development: python http.server (port 8000) or similar
        // API runs separately on port 3001
        window.API_URL = proto + '//' + host + ':3001';
    }
})();
