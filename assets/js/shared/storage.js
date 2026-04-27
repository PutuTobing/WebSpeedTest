// Storage Module — async wrappers over the MySQL REST API
// Requires js/config.js + js/api-client.js loaded first.

// ── Servers ───────────────────────────────────────────────────────
async function getAllServers() {
    try { return await apiGetServers(); } catch { return []; }
}
async function getServersByUser(username) {
    return (await getAllServers()).filter(s => s.createdBy === username);
}
async function getServersByStatus(status) {
    return (await getAllServers()).filter(s => s.status === status);
}
async function getServerById(serverId) {
    return (await getAllServers()).find(s => s.id == serverId) || null;
}

async function createServer(serverData) {
    try { return await apiCreateServer(serverData); }
    catch (err) { return { success: false, message: err.message }; }
}
async function updateServer(serverId, serverData) {
    try { return await apiUpdateServer(serverId, serverData); }
    catch (err) { return { success: false, message: err.message }; }
}
async function deleteServer(serverId) {
    try { return await apiDeleteServer(serverId); }
    catch (err) { return { success: false, message: err.message }; }
}
async function setServerStatus(serverId, status) {
    try { return await apiSetServerStatus(serverId, status); }
    catch (err) { return { success: false, message: err.message }; }
}
async function recordServerCheck(serverId, isUp) {
    try { return await apiRecordServerCheck(serverId, isUp); }
    catch { /* non-critical */ }
}

// ── Endpoints ─────────────────────────────────────────────────────
async function getAllEndpoints() {
    try { return await apiGetEndpoints(); } catch { return []; }
}
async function getActiveEndpoints() {
    try { return await apiGetActiveEndpoints(); } catch { return []; }
}
async function addEndpoint(data) {
    try { return await apiAddEndpoint(data); }
    catch (err) { return { success: false, message: err.message }; }
}
async function updateEndpoint(id, data) {
    try { return await apiUpdateEndpoint(id, data); }
    catch (err) { return { success: false, message: err.message }; }
}
async function deleteEndpoint(id) {
    try { return await apiDeleteEndpoint(id); }
    catch (err) { return { success: false, message: err.message }; }
}
async function toggleEndpointActive(id) {
    try { return await apiToggleEndpoint(id); }
    catch (err) { return { success: false, message: err.message }; }
}

// ── Speedtest dropdown ────────────────────────────────────────────
async function getApprovedServersForDropdown() {
    try {
        const eps = await apiGetActiveEndpoints();
        if (eps && eps.length > 0) {
            // Try to enrich with website info from approved servers
            let serverMap = {};
            try {
                const servers = await apiGetApprovedServers();
                servers.forEach(s => { serverMap[s.id] = s.companyWebsite || ''; });
            } catch { /* ignore */ }
            return eps.map(ep => ({
                label: `${ep.name} - ${ep.location}`,
                value: ep.baseUrl, name: ep.name, location: ep.location,
                website: ep.linkedServerId ? (serverMap[ep.linkedServerId] || '') : ''
            }));
        }
        // Fallback: use approved servers directly
        const servers = await apiGetApprovedServers();
        return servers.map(s => ({
            label: `${s.companyName} - ${s.location}`,
            value: s.serverUrl.startsWith('http') ? s.serverUrl : `http://${s.serverUrl}`,
            name: s.companyName, location: s.location,
            website: s.companyWebsite || ''
        }));
    } catch { return []; }
}

// ── History helpers (used by speedtest.js) ────────────────────────
async function saveToHistoryDB(d) { return apiSaveHistory(d); }
async function getHistoryFromDB()  { return apiGetHistory(); }
async function clearHistoryDB()    { return apiClearHistory(); }
