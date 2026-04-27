// API Client — all communication with the MySQL-backed REST API
// Requires js/config.js to be loaded first (sets window.API_URL)

function _apiUrl() { return window.API_URL || 'http://localhost:3001'; }
function _getToken() { return localStorage.getItem('speedtest_token'); }

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = _getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let response;
    try {
        response = await fetch(_apiUrl() + path, { ...options, headers });
    } catch {
        throw new Error('Tidak dapat terhubung ke server API. Pastikan API berjalan di port 3001.');
    }

    if (response.status === 401) {
        localStorage.removeItem('speedtest_token');
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        throw new Error('Sesi berakhir. Silakan login ulang.');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan pada server.');
    return data;
}

// ── Auth ──────────────────────────────────────────────────────────
async function apiLogin(username, password) {
    return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

// ── Users ─────────────────────────────────────────────────────────
async function apiGetUsers()                { return apiFetch('/api/users'); }
async function apiCreateUser(d)             { return apiFetch('/api/users', { method: 'POST', body: JSON.stringify(d) }); }
async function apiUpdateUser(u, d)          { return apiFetch(`/api/users/${u}`, { method: 'PUT', body: JSON.stringify(d) }); }
async function apiDeleteUser(u)             { return apiFetch(`/api/users/${u}`, { method: 'DELETE' }); }
async function apiChangeUserPassword(u, p)  { return apiFetch(`/api/users/${u}/password`, { method: 'PUT', body: JSON.stringify({ newPassword: p }) }); }
async function apiChangeOwnPassword(cur, np){ return apiFetch('/api/users/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword: cur, newPassword: np }) }); }

// ── Servers ───────────────────────────────────────────────────────
async function apiGetServers()              { return apiFetch('/api/servers'); }
async function apiGetApprovedServers()      { return apiFetch('/api/servers/approved'); }
async function apiCreateServer(d)           { return apiFetch('/api/servers', { method: 'POST', body: JSON.stringify(d) }); }
async function apiUpdateServer(id, d)       { return apiFetch(`/api/servers/${id}`, { method: 'PUT', body: JSON.stringify(d) }); }
async function apiDeleteServer(id)          { return apiFetch(`/api/servers/${id}`, { method: 'DELETE' }); }
async function apiSetServerStatus(id, s)    { return apiFetch(`/api/servers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: s }) }); }
async function apiRecordServerCheck(id, up) { return apiFetch(`/api/servers/${id}/check`, { method: 'POST', body: JSON.stringify({ isUp: up }) }); }

// ── Endpoints ─────────────────────────────────────────────────────
async function apiGetEndpoints()            { return apiFetch('/api/endpoints'); }
async function apiGetActiveEndpoints()      { return apiFetch('/api/endpoints/active'); }
async function apiAddEndpoint(d)            { return apiFetch('/api/endpoints', { method: 'POST', body: JSON.stringify(d) }); }
async function apiUpdateEndpoint(id, d)     { return apiFetch(`/api/endpoints/${id}`, { method: 'PUT', body: JSON.stringify(d) }); }
async function apiDeleteEndpoint(id)        { return apiFetch(`/api/endpoints/${id}`, { method: 'DELETE' }); }
async function apiToggleEndpoint(id)        { return apiFetch(`/api/endpoints/${id}/toggle`, { method: 'PUT' }); }

// ── History ───────────────────────────────────────────────────────
async function apiGetHistory()              { return apiFetch('/api/history'); }
async function apiSaveHistory(d)            { return apiFetch('/api/history', { method: 'POST', body: JSON.stringify(d) }); }
async function apiClearHistory()            { return apiFetch('/api/history', { method: 'DELETE' }); }

// ── Site Settings ─────────────────────────────────────────────────
async function apiGetSiteSettings()         { return apiFetch('/api/site-settings'); }
async function apiSaveSiteSettings(d)       { return apiFetch('/api/site-settings', { method: 'PUT', body: JSON.stringify(d) }); }
