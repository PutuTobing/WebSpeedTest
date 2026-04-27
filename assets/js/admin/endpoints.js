async function loadEndpoints() {
    const endpoints = await getAllEndpoints();
    const tbody = document.getElementById('endpoints-table-body');
    if (!tbody) return;

    if (endpoints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Belum ada endpoint. Klik "Tambah Endpoint Baru" untuk menambahkan.</td></tr>';
        return;
    }

    tbody.innerHTML = endpoints.map(ep => `
        <tr>
            <td><strong>${escapeHtml(ep.name)}</strong><br><small style="opacity:.6">Oleh: ${escapeHtml(ep.addedBy)}</small></td>
            <td><code style="font-size:.85em">${escapeHtml(ep.baseUrl)}</code></td>
            <td>${escapeHtml(ep.location)}</td>
            <td>
                <div style="font-size:.8em;line-height:1.7">
                    <span class="api-badge get">GET</span> /ping<br>
                    <span class="api-badge get">GET</span> /download<br>
                    <span class="api-badge post">POST</span> /upload
                </div>
            </td>
            <td>
                <span class="status-badge ${ep.isActive ? 'status-approved' : 'status-rejected'}">
                    ${ep.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            <td>
                <button class="btn-small btn-secondary" onclick="testEndpointConnectivity('${escapeHtml(ep.id)}', '${escapeHtml(ep.baseUrl)}')" title="Uji koneksi">🔍 Uji</button>
                <button class="btn-small btn-edit" onclick="editEndpoint('${escapeHtml(ep.id)}')" title="Edit">✏️</button>
                <button class="btn-small ${ep.isActive ? 'btn-secondary' : 'btn-primary'}" onclick="toggleEndpointStatus('${escapeHtml(ep.id)}')" title="${ep.isActive ? 'Nonaktifkan' : 'Aktifkan'}">
                    ${ep.isActive ? '⏸' : '▶️'}
                </button>
                <button class="btn-small btn-delete" onclick="deleteEndpointConfirm('${escapeHtml(ep.id)}')" title="Hapus">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Initialize endpoint modal bindings
async function initializeEndpointModal() {
    const modal = document.getElementById('endpoint-modal');
    if (!modal) return;

    // Populate server picker with approved servers
    async function populateServerPicker() {
        const picker = document.getElementById('endpoint-server-pick');
        if (!picker) return;
        const approved = await getServersByStatus('approved');
        picker.innerHTML = '<option value="">— Pilih server approved (opsional) —</option>'
            + approved.map(s => `<option value="${s.id}" data-url="${s.serverUrl.startsWith('http') ? s.serverUrl : 'http://' + s.serverUrl}" data-location="${s.location}" data-name="${s.companyName}">${s.companyName} — ${s.location}</option>`).join('');
    }

    // Auto-fill fields when a server is selected from the picker
    const picker = document.getElementById('endpoint-server-pick');
    if (picker) {
        picker.addEventListener('change', () => {
            const opt = picker.options[picker.selectedIndex];
            if (opt && opt.value) {
                document.getElementById('endpoint-name').value = opt.dataset.name || '';
                document.getElementById('endpoint-url').value = opt.dataset.url || '';
                document.getElementById('endpoint-location').value = opt.dataset.location || '';
            }
        });
    }

    // Open modal for new endpoint
    document.getElementById('add-endpoint-btn').addEventListener('click', async () => {
        document.getElementById('endpoint-modal-title').textContent = 'Tambah Endpoint Baru';
        document.getElementById('endpoint-form').reset();
        document.getElementById('endpoint-edit-id').value = '';
        await populateServerPicker();
        openModal(modal);
    });

    // Close buttons
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modal));
    });

    // Form submit
    document.getElementById('endpoint-form').addEventListener('submit', async e => {
        e.preventDefault();
        await saveEndpoint();
    });
}

// Save new or edited endpoint
async function saveEndpoint() {
    const editId = document.getElementById('endpoint-edit-id').value;
    const picker = document.getElementById('endpoint-server-pick');
    const linkedServerId = picker ? (picker.value || null) : null;
    const data = {
        name: document.getElementById('endpoint-name').value.trim(),
        baseUrl: document.getElementById('endpoint-url').value.trim(),
        location: document.getElementById('endpoint-location').value.trim(),
        isActive: document.getElementById('endpoint-active').value === 'true',
        linkedServerId
    };

    const msg = document.getElementById('endpoint-message');
    const result = editId ? await updateEndpoint(editId, data) : await addEndpoint(data);

    if (result.success) {
        closeModal(document.getElementById('endpoint-modal'));
        showMessage(msg, result.message, 'success');
        loadEndpoints();
    } else {
        showMessage(msg, result.message, 'error');
    }
}

// Open modal pre-filled for editing
async function editEndpoint(id) {
    const endpoints = await getAllEndpoints();
    const ep = endpoints.find(e => e.id === id);
    if (!ep) return;

    // Populate server picker first
    const approved = await getServersByStatus('approved');
    const picker = document.getElementById('endpoint-server-pick');
    if (picker) {
        picker.innerHTML = '<option value="">— Pilih server approved (opsional) —</option>'
            + approved.map(s => `<option value="${s.id}" data-url="${s.serverUrl.startsWith('http') ? s.serverUrl : 'http://' + s.serverUrl}" data-location="${s.location}" data-name="${s.companyName}">${s.companyName} — ${s.location}</option>`).join('');
        picker.value = ep.linkedServerId || '';
    }

    document.getElementById('endpoint-modal-title').textContent = 'Edit Endpoint';
    document.getElementById('endpoint-edit-id').value = ep.id;
    document.getElementById('endpoint-name').value = ep.name;
    document.getElementById('endpoint-url').value = ep.baseUrl;
    document.getElementById('endpoint-location').value = ep.location;
    document.getElementById('endpoint-active').value = String(ep.isActive);

    openModal(document.getElementById('endpoint-modal'));
}

// Delete endpoint with confirmation
async function deleteEndpointConfirm(id) {
    const endpoints = await getAllEndpoints();
    const ep = endpoints.find(e => e.id === id);
    if (!ep) return;
    showConfirm({
        icon: '⚡',
        title: 'Hapus Endpoint?',
        message: `Endpoint "${ep.name}" (${ep.baseUrl}) akan dihapus dan tidak dapat dipulihkan.`,
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
            const result = await deleteEndpoint(id);
            const msg = document.getElementById('endpoint-message');
            if (result.success) {
                showMessage(msg, result.message, 'success');
                loadEndpoints();
            } else {
                showMessage(msg, result.message, 'error');
            }
        }
    });
}

// Toggle active/inactive
async function toggleEndpointStatus(id) {
    const result = await toggleEndpointActive(id);
    const msg = document.getElementById('endpoint-message');
    if (result.success) {
        showMessage(msg, result.message, 'success');
        loadEndpoints();
    } else {
        showMessage(msg, result.message, 'error');
    }
}

// Test connectivity by fetching /ping with a timeout
async function testEndpointConnectivity(id, baseUrl) {
    const msg = document.getElementById('endpoint-message');
    showMessage(msg, `Menguji koneksi ke ${baseUrl}/ping ...`, 'info');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
        const start = Date.now();
        const res = await fetch(`${baseUrl}/ping`, { signal: controller.signal });
        clearTimeout(timer);
        const latency = Date.now() - start;
        if (res.ok) {
            showMessage(msg, `✅ ${baseUrl} online — latensi ${latency} ms`, 'success');
        } else {
            showMessage(msg, `⚠️ ${baseUrl} merespons HTTP ${res.status}`, 'error');
        }
    } catch (err) {
        clearTimeout(timer);
        showMessage(msg, `❌ ${baseUrl} tidak dapat dijangkau (${err.name === 'AbortError' ? 'timeout' : err.message})`, 'error');
    }
}

// ── Site Settings ────────────────────────────────────────────────────────────
