function initApprovalFilters() {
    document.querySelectorAll('#server-approvals .filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#server-approvals .filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentApprovalFilter = btn.getAttribute('data-filter');
            loadApprovalServers(currentApprovalFilter);
        });
    });
}

// Load all servers in the approval tab, filterable by status
async function loadApprovalServers(filter = 'all') {
    currentApprovalFilter = filter;
    const servers = filter === 'all' ? await getAllServers() : await getServersByStatus(filter);
    const container = document.getElementById('approval-servers-list');

    if (servers.length === 0) {
        container.innerHTML = `<p class="no-data">Tidak ada server dengan status "${filter}"</p>`;
        return;
    }

    container.innerHTML = servers.map(server => `
        <div class="approval-card">
            <div class="approval-card-header">
                <div>
                    <h4>${escapeHtml(server.companyName)} — ${escapeHtml(server.location)}</h4>
                    <small>Didaftarkan oleh: <strong>${escapeHtml(server.createdBy)}</strong> &nbsp;|&nbsp; ${formatDate(server.createdAt)}</small>
                </div>
                <span class="status-badge status-${escapeHtml(server.status)}">${getStatusText(server.status)}</span>
            </div>
            <div class="approval-card-body">
                <div class="approval-info-grid">
                    <div class="approval-info">
                        <label>URL Server:</label>
                        <span>${escapeHtml(server.serverUrl)}</span>
                    </div>
                    <div class="approval-info">
                        <label>Bandwidth:</label>
                        <span>${escapeHtml(server.bandwidthCapacity)}</span>
                    </div>
                    <div class="approval-info">
                        <label>CPU / RAM:</label>
                        <span>${escapeHtml(server.cpuCores)} Cores / ${escapeHtml(server.ramSize)} GB</span>
                    </div>
                    <div class="approval-info">
                        <label>PIC:</label>
                        <span>${escapeHtml(server.contactName)} (${escapeHtml(server.contactEmail)})</span>
                    </div>
                    ${server.companyWebsite ? `
                    <div class="approval-info">
                        <label>Website:</label>
                        <span><a href="${escapeHtml(server.companyWebsite)}" target="_blank" rel="noopener noreferrer">${escapeHtml(server.companyWebsite)}</a></span>
                    </div>` : ''}
                    ${server.additionalNotes ? `
                    <div class="approval-info" style="grid-column:1/-1">
                        <label>Catatan:</label>
                        <span>${escapeHtml(server.additionalNotes)}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="approval-card-footer">
                <div class="approval-status-control">
                    <label>Ubah Status:</label>
                    <select class="form-input form-input-sm" onchange="setServerStatusAdmin('${escapeHtml(server.id)}', this.value)">
                        <option value="pending"  ${server.status==='pending'  ?'selected':''}>Pending</option>
                        <option value="checking" ${server.status==='checking' ?'selected':''}>Checking</option>
                        <option value="approved" ${server.status==='approved' ?'selected':''}>Approved</option>
                        <option value="error"    ${server.status==='error'    ?'selected':''}>Error</option>
                    </select>
                </div>
                <div class="approval-actions">
                    <button class="btn-small btn-secondary" onclick="window.open('${escapeHtml(server.serverUrl.startsWith('http') ? server.serverUrl : 'http://' + server.serverUrl)}','_blank','noopener,noreferrer')">&#128270; Cek Server</button>
                    ${server.companyWebsite ? `<button class="btn-small btn-secondary" onclick="window.open('${escapeHtml(server.companyWebsite)}','_blank','noopener,noreferrer')">🌐 Cek Website</button>` : ''}
                    <button class="btn-small btn-delete" onclick="deleteApprovalServerConfirm('${escapeHtml(server.id)}')">&#128465; Hapus</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Set server status from approval tab
async function setServerStatusAdmin(serverId, status) {
    const result = await setServerStatus(serverId, status);
    const msg = document.getElementById('approval-message');
    if (result.success) {
        showMessage(msg, result.message, 'success');
        loadApprovalServers(currentApprovalFilter);
        loadAllServers();
    } else {
        showMessage(msg, result.message, 'error');
    }
}

// Open server URL in new tab to verify it's running
function checkServerUrlAdmin(serverUrl) {
    const url = serverUrl.startsWith('http') ? serverUrl : `http://${serverUrl}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Delete a server from the approval list with confirmation
async function deleteApprovalServerConfirm(serverId) {
    const server = await getServerById(serverId);
    if (!server) return;
    showConfirm({
        icon: '🖥️',
        title: 'Hapus Server?',
        message: `Server "${server.companyName}" akan dihapus secara permanen beserta seluruh data terkait.`,
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
            const result = await deleteServer(serverId);
            const msg = document.getElementById('approval-message');
            if (result.success) {
                showMessage(msg, result.message, 'success');
                loadApprovalServers(currentApprovalFilter);
                loadAllServers();
            } else {
                showMessage(msg, result.message, 'error');
            }
        }
    });
}

// Load all APPROVED servers with uptime monitoring info
async function loadAllServers() {
    const servers = await getServersByStatus('approved');
    const tbody = document.getElementById('all-servers-table-body');

    if (servers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Tidak ada server yang telah disetujui</td></tr>';
        return;
    }

    tbody.innerHTML = servers.map(server => {
        const uptimeBadge = server.lastStatus === 'up'
            ? '<span class="status-badge status-approved">&#128994; UP</span>'
            : server.lastStatus === 'down'
                ? '<span class="status-badge status-error">&#128308; DOWN</span>'
                : '<span class="status-badge status-checking">—</span>';
        const lastCheck = server.lastChecked ? formatDate(server.lastChecked) : 'Belum dicek';
        return `
        <tr>
            <td><strong>${escapeHtml(server.companyName)}</strong>${server.companyWebsite ? ` <a href="${escapeHtml(server.companyWebsite)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(server.companyWebsite)}" style="font-size:.8em;opacity:.7;margin-left:4px">🌐</a>` : ''}</td>
            <td>${escapeHtml(server.location)}</td>
            <td><code style="font-size:.82em">${escapeHtml(server.serverUrl)}</code></td>
            <td>${escapeHtml(server.bandwidthCapacity)}</td>
            <td>${uptimeBadge}</td>
            <td style="font-size:.78em">${lastCheck}</td>
            <td><span class="downtime-badge">${Number(server.downtimeCount) || 0}x</span></td>
            <td>
                <button class="btn-small btn-secondary" onclick="pingSingleServer('${escapeHtml(server.id)}', '${escapeHtml(server.serverUrl)}')" title="Cek sekarang">🔄</button>
                <button class="btn-small btn-edit" onclick="editServerAdmin('${escapeHtml(server.id)}')" title="Edit">✏️</button>
                <button class="btn-small btn-delete" onclick="deleteServerAdmin('${escapeHtml(server.id)}')" title="Hapus">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

// Initialize Cek Semua button
function initPingAllButton() {
    const btn = document.getElementById('ping-all-btn');
    if (btn) btn.addEventListener('click', pingAllServers);
}

// Ping a single server via server-side check (avoids CORS and localhost issues)
async function pingSingleServer(serverId, serverUrl) {
    const msg = document.getElementById('all-servers-message') || document.getElementById('approval-message');
    showMessage(msg, `Mengecek server: ${serverUrl} ...`, 'info');
    try {
        const result = await apiFetch(`/api/servers/${serverId}/check`, { method: 'POST', body: JSON.stringify({}) });
        if (result.isUp) {
            showMessage(msg, `✅ Server online — latensi ${result.latency} ms (${result.url})`, 'success');
        } else {
            showMessage(msg, `❌ Tidak dapat menjangkau server: ${result.url}`, 'error');
        }
    } catch (err) {
        showMessage(msg, `❌ Gagal melakukan pengecekan: ${err.message}`, 'error');
    }
    loadAllServers();
}

// Ping all approved servers sequentially
async function pingAllServers() {
    const servers = await getServersByStatus('approved');
    const msg = document.getElementById('all-servers-message');
    if (servers.length === 0) {
        showMessage(msg, 'Tidak ada server approved untuk dicek.', 'info');
        return;
    }
    showMessage(msg, `Mengecek ${servers.length} server...`, 'info');
    for (const s of servers) {
        await pingSingleServer(s.id, s.serverUrl);
    }
    showMessage(msg, 'Pengecekan semua server selesai.', 'success');
}

// Initialize edit server modal
function initializeEditServerModal() {
    const modal = document.getElementById('edit-server-modal');
    const closeButtons = modal.querySelectorAll('.close-modal');
    const form = document.getElementById('edit-server-form');
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(modal);
        });
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveServerEdit();
    });
}

// Edit server (admin)
async function editServerAdmin(serverId) {
    const server = await getServerById(serverId);
    if (!server) return;
    
    const modal = document.getElementById('edit-server-modal');
    
    // Fill form
    document.getElementById('edit-server-id').value = server.id;
    document.getElementById('edit-company-name').value = server.companyName;
    document.getElementById('edit-server-location').value = server.location;
    document.getElementById('edit-bandwidth-capacity').value = server.bandwidthCapacity;
    document.getElementById('edit-server-url').value = server.serverUrl;
    document.getElementById('edit-cpu-cores').value = server.cpuCores;
    document.getElementById('edit-ram-size').value = server.ramSize;
    document.getElementById('edit-contact-name').value = server.contactName;
    document.getElementById('edit-contact-email').value = server.contactEmail;
    document.getElementById('edit-company-website').value = server.companyWebsite || '';
    document.getElementById('edit-additional-notes').value = server.additionalNotes || '';
    document.getElementById('edit-server-status').value = server.status;
    
    openModal(modal);
}

// Save server edit
async function saveServerEdit() {
    const serverId = document.getElementById('edit-server-id').value;
    const serverData = {
        companyName: document.getElementById('edit-company-name').value.trim(),
        location: document.getElementById('edit-server-location').value.trim(),
        bandwidthCapacity: document.getElementById('edit-bandwidth-capacity').value,
        serverUrl: document.getElementById('edit-server-url').value.trim(),
        cpuCores: document.getElementById('edit-cpu-cores').value,
        ramSize: document.getElementById('edit-ram-size').value,
        contactName: document.getElementById('edit-contact-name').value.trim(),
        contactEmail: document.getElementById('edit-contact-email').value.trim(),
        companyWebsite: document.getElementById('edit-company-website').value.trim(),
        additionalNotes: document.getElementById('edit-additional-notes').value.trim(),
        status: document.getElementById('edit-server-status').value
    };
    
    const result = await updateServer(serverId, serverData);
    const approvalMessage = document.getElementById('approval-message');
    
    if (result.success) {
        showMessage(approvalMessage, 'Server berhasil diupdate!', 'success');
        closeModal(document.getElementById('edit-server-modal'));
        loadApprovalServers(currentApprovalFilter);
        loadAllServers();
    } else {
        alert(result.message);
    }
}

// Delete server (admin)
async function deleteServerAdmin(serverId) {
    const server = await getServerById(serverId);
    if (!server) return;
    showConfirm({
        icon: '🖥️',
        title: 'Hapus Server?',
        message: `Server "${server.companyName}" akan dihapus secara permanen beserta seluruh data terkait.`,
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
            const result = await deleteServer(serverId);
            const msg = document.getElementById('all-servers-message') || document.getElementById('approval-message');
            if (result.success) {
                showMessage(msg, result.message, 'success');
                loadApprovalServers(currentApprovalFilter);
                loadAllServers();
            } else {
                showMessage(msg, result.message, 'error');
            }
        }
    });
}

// Helper functions
function getStatusText(status) {
    const statusMap = {
        'pending':  '⏳ Pending',
        'checking': '🔍 Checking',
        'approved': '✅ Approved',
        'error':    '❌ Error'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ── WIB Clock ────────────────────────────────────────────────
