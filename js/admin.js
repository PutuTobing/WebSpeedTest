// Admin Panel Logic

let currentApprovalFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Require admin access
    if (!requireAdmin()) return;
    
    // Initialize components
    initializeTabs();
    initializeMobileMenu();
    loadUsers();
    loadApprovalServers();
    loadAllServers();
    loadEndpoints();

    // Initialize modals
    initializeUserModal();
    initializePasswordModal();
    initializeEditServerModal();
    initializeEndpointModal();
    initApprovalFilters();
    initPingAllButton();
    initClock();
    startAutoCheck();
    initSiteSettings();
    initBackupRestore();

    // Close modal when clicking outside (on backdrop)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });
});

// Initialize tabs
function initializeTabs() {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            menuItems.forEach(mi => mi.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Initialize mobile menu toggle
function initializeMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
        });
    }
}

// Load all users
async function loadUsers() {
    const users = await getAllUsers();
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Tidak ada user</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td><span class="role-badge role-${user.role}">${user.role}</span></td>
            <td>${user.fullname}</td>
            <td>${user.email}</td>
            <td><span class="status-badge status-${user.status}">${user.status}</span></td>
            <td>
                <button class="btn-small btn-edit" onclick="editUser('${user.username}')">✏️ Edit</button>
                <button class="btn-small btn-password" onclick="changeUserPassword('${user.username}')">🔑 Password</button>
                ${user.username !== getCurrentSession().username ? 
                    `<button class="btn-small btn-delete" onclick="deleteUserConfirm('${user.username}')">🗑️</button>` : 
                    ''}
            </td>
        </tr>
    `).join('');
}

// Initialize user modal
function initializeUserModal() {
    const addUserBtn = document.getElementById('add-user-btn');
    const userModal = document.getElementById('user-modal');
    const closeButtons = userModal.querySelectorAll('.close-modal');
    const userForm = document.getElementById('user-form');
    
    addUserBtn.addEventListener('click', () => {
        openUserModal();
    });
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(userModal);
        });
    });
    
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
}

// Open user modal
async function openUserModal(username = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    const passwordGroup = document.getElementById('password-group');
    
    form.reset();
    
    if (username) {
        // Edit mode
        const users = await getAllUsers();
        const user = users.find(u => u.username === username);
        
        if (user) {
            title.textContent = 'Edit User';
            document.getElementById('edit-username').value = user.username;
            document.getElementById('new-username').value = user.username;
            document.getElementById('new-username').disabled = true;
            document.getElementById('user-role').value = user.role;
            document.getElementById('user-fullname').value = user.fullname;
            document.getElementById('user-email').value = user.email;
            passwordGroup.style.display = 'none';
            document.getElementById('user-password').required = false;
        }
    } else {
        // Add mode
        title.textContent = 'Tambah User Baru';
        document.getElementById('edit-username').value = '';
        document.getElementById('new-username').disabled = false;
        passwordGroup.style.display = 'block';
        document.getElementById('user-password').required = true;
    }
    
    openModal(modal);
}

// Save user
async function saveUser() {
    const editUsername = document.getElementById('edit-username').value;
    const username = document.getElementById('new-username').value.trim();
    const role = document.getElementById('user-role').value;
    const fullname = document.getElementById('user-fullname').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    
    const userData = { username, role, fullname, email, password };
    let result;
    
    if (editUsername) {
        result = await updateUser(editUsername, userData);
    } else {
        result = await createUser(userData);
    }
    
    const userMessage = document.getElementById('user-message');
    
    if (result.success) {
        showMessage(userMessage, result.message, 'success');
        closeModal(document.getElementById('user-modal'));
        loadUsers();
    } else {
        showMessage(userMessage, result.message, 'error');
    }
}

// Edit user
async function editUser(username) {
    await openUserModal(username);
}

// Delete user with confirmation
async function deleteUserConfirm(username) {
    showConfirm({
        icon: '👤',
        title: 'Hapus User?',
        message: `User "${username}" akan dihapus secara permanen dan tidak dapat dipulihkan.`,
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
            const result = await deleteUser(username);
            const userMessage = document.getElementById('user-message');
            if (result.success) {
                showMessage(userMessage, result.message, 'success');
                loadUsers();
            } else {
                showMessage(userMessage, result.message, 'error');
            }
        }
    });
}

// Initialize password modal
function initializePasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    const closeButtons = modal.querySelectorAll('.close-modal');
    const form = document.getElementById('admin-password-form');
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(modal);
        });
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUserPassword();
    });
}

// Change user password
function changeUserPassword(username) {
    const modal = document.getElementById('admin-password-modal');
    document.getElementById('password-username').value = username;
    document.getElementById('password-user-display').textContent = username;
    document.getElementById('admin-password-form').reset();
    openModal(modal);
}

// Save user password
async function saveUserPassword() {
    const username = document.getElementById('password-username').value;
    const newPassword = document.getElementById('admin-new-password').value;
    const confirmPassword = document.getElementById('admin-confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        alert('Password dan konfirmasi tidak cocok!');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Password minimal 6 karakter!');
        return;
    }
    
    const result = await adminChangePassword(username, newPassword);
    const userMessage = document.getElementById('user-message');
    
    if (result.success) {
        showMessage(userMessage, result.message, 'success');
        closeModal(document.getElementById('admin-password-modal'));
    } else {
        showMessage(userMessage, result.message, 'error');
    }
}

// Initialize approval filter tabs
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
                    <h4>${server.companyName} — ${server.location}</h4>
                    <small>Didaftarkan oleh: <strong>${server.createdBy}</strong> &nbsp;|&nbsp; ${formatDate(server.createdAt)}</small>
                </div>
                <span class="status-badge status-${server.status}">${getStatusText(server.status)}</span>
            </div>
            <div class="approval-card-body">
                <div class="approval-info-grid">
                    <div class="approval-info">
                        <label>URL Server:</label>
                        <span>${server.serverUrl}</span>
                    </div>
                    <div class="approval-info">
                        <label>Bandwidth:</label>
                        <span>${server.bandwidthCapacity}</span>
                    </div>
                    <div class="approval-info">
                        <label>CPU / RAM:</label>
                        <span>${server.cpuCores} Cores / ${server.ramSize} GB</span>
                    </div>
                    <div class="approval-info">
                        <label>PIC:</label>
                        <span>${server.contactName} (${server.contactEmail})</span>
                    </div>
                    ${server.companyWebsite ? `
                    <div class="approval-info">
                        <label>Website:</label>
                        <span><a href="${server.companyWebsite}" target="_blank" rel="noopener noreferrer">${server.companyWebsite}</a></span>
                    </div>` : ''}
                    ${server.additionalNotes ? `
                    <div class="approval-info" style="grid-column:1/-1">
                        <label>Catatan:</label>
                        <span>${server.additionalNotes}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="approval-card-footer">
                <div class="approval-status-control">
                    <label>Ubah Status:</label>
                    <select class="form-input form-input-sm" onchange="setServerStatusAdmin('${server.id}', this.value)">
                        <option value="pending"  ${server.status==='pending'  ?'selected':''}>Pending</option>
                        <option value="checking" ${server.status==='checking' ?'selected':''}>Checking</option>
                        <option value="approved" ${server.status==='approved' ?'selected':''}>Approved</option>
                        <option value="error"    ${server.status==='error'    ?'selected':''}>Error</option>
                    </select>
                </div>
                <div class="approval-actions">
                    <button class="btn-small btn-secondary" onclick="window.open('${server.serverUrl.startsWith('http') ? server.serverUrl : 'http://' + server.serverUrl}','_blank','noopener,noreferrer')">&#128270; Cek Server</button>
                    ${server.companyWebsite ? `<button class="btn-small btn-secondary" onclick="window.open('${server.companyWebsite}','_blank','noopener,noreferrer')">🌐 Cek Website</button>` : ''}
                    <button class="btn-small btn-delete" onclick="deleteApprovalServerConfirm('${server.id}')">&#128465; Hapus</button>
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
            <td><strong>${server.companyName}</strong>${server.companyWebsite ? ` <a href="${server.companyWebsite}" target="_blank" rel="noopener noreferrer" title="${server.companyWebsite}" style="font-size:.8em;opacity:.7;margin-left:4px">🌐</a>` : ''}</td>
            <td>${server.location}</td>
            <td><code style="font-size:.82em">${server.serverUrl}</code></td>
            <td>${server.bandwidthCapacity}</td>
            <td>${uptimeBadge}</td>
            <td style="font-size:.78em">${lastCheck}</td>
            <td><span class="downtime-badge">${server.downtimeCount || 0}x</span></td>
            <td>
                <button class="btn-small btn-secondary" onclick="pingSingleServer('${server.id}', '${server.serverUrl}')" title="Cek sekarang">🔄</button>
                <button class="btn-small btn-edit" onclick="editServerAdmin('${server.id}')" title="Edit">✏️</button>
                <button class="btn-small btn-delete" onclick="deleteServerAdmin('${server.id}')" title="Hapus">🗑️</button>
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
// ── Custom confirm dialog ─────────────────────────────────────
function showConfirm({ icon = '🗑️', title, message, confirmText = 'Ya, Hapus', confirmColor = 'linear-gradient(135deg,#ef4444,#dc2626)', onConfirm }) {
    let modal = document.getElementById('_admin-confirm-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
<div id="_admin-confirm-modal" style="
    display:none;position:fixed;inset:0;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);
    z-index:9998;align-items:center;justify-content:center;padding:20px;">
    <div id="_admin-confirm-box" style="
        background:var(--surface,#1e1e2e);border:1px solid var(--border,rgba(255,255,255,.12));
        border-radius:14px;padding:28px 28px 22px;max-width:340px;width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center;">
        <div id="_confirm-icon" style="font-size:2.2rem;margin-bottom:10px;"></div>
        <h3 id="_confirm-title" style="margin:0 0 6px;font-size:1rem;font-weight:700;color:var(--text,#e2e8f0);"></h3>
        <p id="_confirm-msg" style="margin:0 0 20px;font-size:0.82rem;color:var(--text-2,#94a3b8);line-height:1.5;"></p>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button id="_confirm-cancel" style="
                padding:7px 22px;border-radius:8px;border:1px solid var(--border,rgba(255,255,255,.15));
                background:transparent;color:var(--text-2,#94a3b8);font-size:0.8rem;
                font-weight:600;cursor:pointer;transition:all .15s;">Batal</button>
            <button id="_confirm-ok" style="
                padding:7px 22px;border-radius:8px;border:none;
                color:#fff;font-size:0.8rem;font-weight:700;
                cursor:pointer;transition:all .15s;"></button>
        </div>
    </div>
</div>
<style>
#_confirm-cancel:hover{background:rgba(255,255,255,.06)!important;color:var(--text,#e2e8f0)!important;}
#_confirm-ok:hover{opacity:.88;transform:translateY(-1px);}
</style>`);
        modal = document.getElementById('_admin-confirm-modal');
        document.getElementById('_confirm-cancel').addEventListener('click', hideConfirm);
        modal.addEventListener('click', e => { if (e.target === modal) hideConfirm(); });
    }
    document.getElementById('_confirm-icon').textContent  = icon;
    document.getElementById('_confirm-title').textContent = title;
    document.getElementById('_confirm-msg').textContent   = message;
    const okBtn = document.getElementById('_confirm-ok');
    okBtn.textContent        = confirmText;
    okBtn.style.background   = confirmColor;
    okBtn.style.boxShadow    = '0 4px 14px rgba(239,68,68,.35)';
    // Replace to clear old listener
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', () => { hideConfirm(); onConfirm(); });
    const box = document.getElementById('_admin-confirm-box');
    box.style.animation = 'lcIn .2s cubic-bezier(.34,1.36,.64,1) forwards';
    modal.style.display = 'flex';
}
function hideConfirm() {
    const modal = document.getElementById('_admin-confirm-modal');
    const box   = document.getElementById('_admin-confirm-box');
    if (!modal) return;
    box.style.animation = 'lcOut .16s ease forwards';
    setTimeout(() => { modal.style.display = 'none'; }, 160);
}

// ── WIB Clock ─────────────────────────────────────────────────
function initClock() {
    function tick() {
        const el = document.getElementById('admin-clock');
        if (!el) return;
        const now = new Date();
        const str = now.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        el.textContent = str + ' WIB';
    }
    tick();
    setInterval(tick, 1000);
}

// ── Auto periodic server check (every 1 hour) ────────────────
let _autoCheckTimer = null;
let _countdownTimer = null;
let _nextCheckAt   = null;

const _AUTOCHECK_KEY = 'admin_next_check_at';
const HOUR = 60 * 60 * 1000;

function startAutoCheck() {

    function updateCountdown() {
        const el = document.getElementById('auto-check-info');
        if (!el || !_nextCheckAt) return;
        const diff = _nextCheckAt - Date.now();
        if (diff <= 0) { el.textContent = '🔄 Sedang memeriksa...'; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `⏰ Auto-check berikutnya: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    async function runCheck() {
        const el = document.getElementById('auto-check-info');
        if (el) el.textContent = '🔄 Auto-check sedang berjalan...';
        await pingAllServers();
        // Simpan waktu check berikutnya ke localStorage agar persisten
        _nextCheckAt = Date.now() + HOUR;
        localStorage.setItem(_AUTOCHECK_KEY, String(_nextCheckAt));
        scheduleNext();
    }

    function scheduleNext() {
        // Batalkan timer lama jika ada
        if (_autoCheckTimer) clearInterval(_autoCheckTimer);
        const remaining = _nextCheckAt - Date.now();
        if (remaining <= 0) {
            // Sudah lewat waktu saat halaman dibuka kembali → langsung jalankan
            runCheck();
        } else {
            // Jadwalkan tepat saat waktunya tiba (bukan interval tetap)
            _autoCheckTimer = setTimeout(runCheck, remaining);
        }
    }

    // Baca waktu check terakhir dari localStorage
    const stored = parseInt(localStorage.getItem(_AUTOCHECK_KEY), 10);
    if (stored && stored > Date.now()) {
        // Masih valid: lanjutkan countdown dari waktu yang tersimpan
        _nextCheckAt = stored;
    } else {
        // Belum ada / sudah kedaluwarsa: mulai jadwal baru dari sekarang
        _nextCheckAt = Date.now() + HOUR;
        localStorage.setItem(_AUTOCHECK_KEY, String(_nextCheckAt));
    }

    if (_countdownTimer) clearInterval(_countdownTimer);
    _countdownTimer = setInterval(updateCountdown, 1000);
    updateCountdown();

    scheduleNext();
}

function openModal(modal) {
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
}

function closeModal(modal) {
    modal.classList.add('is-closing');
    setTimeout(() => {
        modal.classList.remove('is-open', 'is-closing');
    }, 160);
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}

// ===== Endpoint Manager =====

// Load endpoints table
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
            <td><strong>${ep.name}</strong><br><small style="opacity:.6">Oleh: ${ep.addedBy}</small></td>
            <td><code style="font-size:.85em">${ep.baseUrl}</code></td>
            <td>${ep.location}</td>
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
                <button class="btn-small btn-secondary" onclick="testEndpointConnectivity('${ep.id}', '${ep.baseUrl}')" title="Uji koneksi">🔍 Uji</button>
                <button class="btn-small btn-edit" onclick="editEndpoint('${ep.id}')" title="Edit">✏️</button>
                <button class="btn-small ${ep.isActive ? 'btn-secondary' : 'btn-primary'}" onclick="toggleEndpointStatus('${ep.id}')" title="${ep.isActive ? 'Nonaktifkan' : 'Aktifkan'}">
                    ${ep.isActive ? '⏸' : '▶️'}
                </button>
                <button class="btn-small btn-delete" onclick="deleteEndpointConfirm('${ep.id}')" title="Hapus">🗑️</button>
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
const SITE_CFG_KEY = 'site_config';

const SITE_DEFAULTS = {
    logoUrl:         'https://pututobing.btd.co.id/AS142264.png',
    brandMain:       'SKY TECH',
    brandSub:        'PT. SKY Base Technologhy Digital',
    linkRegister:    'https://billing.btd.co.id/auth/register',
    linkCustLogin:   'https://billing.btd.co.id/auth',
    email:           'office@btd.co.id',
    phone:           '6282217835764',
    address:         'Lampung Timur, Lampung, Indonesia',
    maps:            'https://maps.app.goo.gl/HsNaNEsfPRda8DDHA',
    socialTiktok:    'https://www.tiktok.com/@sky_techn',
    socialFacebook:  'https://www.tiktok.com/@sky_techn',
    socialWhatsapp:  '6282217835764',
    socialTelegram:  '+6282217835764',
    emailSubject:    'Ingin Berlangganan SKY TECH',
    emailBody:       'Halo, saya ingin berlangganan layanan internet SKY TECH.',
    waMessage:       'Halo, saya ingin berlangganan layanan internet SKY TECH.',
    tgMessage:       'Halo, saya ingin berlangganan layanan internet SKY TECH.',
};

function initSiteSettings() {
    const form     = document.getElementById('site-settings-form');
    const resetBtn = document.getElementById('settings-reset-btn');
    const msgEl    = document.getElementById('settings-message');
    if (!form) return;

    function populateForm(cfg) {
        document.getElementById('cfg-logo-url').value            = cfg.logoUrl        || '';
        document.getElementById('cfg-brand-main').value          = cfg.brandMain      || '';
        document.getElementById('cfg-brand-sub').value           = cfg.brandSub       || '';
        document.getElementById('cfg-link-register').value       = cfg.linkRegister   || '';
        document.getElementById('cfg-link-customer-login').value = cfg.linkCustLogin  || '';
        document.getElementById('cfg-email').value               = cfg.email          || '';
        document.getElementById('cfg-phone').value               = cfg.phone          || '';
        document.getElementById('cfg-address').value             = cfg.address        || '';
        document.getElementById('cfg-maps').value                = cfg.maps           || '';
        document.getElementById('cfg-social-tiktok').value       = cfg.socialTiktok   || '';
        document.getElementById('cfg-social-facebook').value     = cfg.socialFacebook || '';
        document.getElementById('cfg-social-whatsapp').value     = cfg.socialWhatsapp || '';
        document.getElementById('cfg-social-telegram').value     = cfg.socialTelegram || '';
        document.getElementById('cfg-email-subject').value       = cfg.emailSubject   || '';
        document.getElementById('cfg-email-body').value          = cfg.emailBody      || '';
        document.getElementById('cfg-wa-message').value          = cfg.waMessage      || '';
        document.getElementById('cfg-tg-message').value          = cfg.tgMessage      || '';
    }

    // Load from API, fallback to localStorage cache
    (async () => {
        try {
            const cfg = await apiGetSiteSettings();
            const merged = { ...SITE_DEFAULTS, ...cfg };
            localStorage.setItem(SITE_CFG_KEY, JSON.stringify(merged));
            populateForm(merged);
        } catch {
            // Fallback to localStorage cache
            try {
                const raw = localStorage.getItem(SITE_CFG_KEY);
                populateForm(raw ? { ...SITE_DEFAULTS, ...JSON.parse(raw) } : { ...SITE_DEFAULTS });
            } catch { populateForm({ ...SITE_DEFAULTS }); }
        }
    })();

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const saveBtn = document.getElementById('settings-save-btn');
        const cfg = {
            logoUrl:        document.getElementById('cfg-logo-url').value.trim(),
            brandMain:      document.getElementById('cfg-brand-main').value.trim(),
            brandSub:       document.getElementById('cfg-brand-sub').value.trim(),
            linkRegister:   document.getElementById('cfg-link-register').value.trim(),
            linkCustLogin:  document.getElementById('cfg-link-customer-login').value.trim(),
            email:          document.getElementById('cfg-email').value.trim(),
            phone:          document.getElementById('cfg-phone').value.trim().replace(/^\+/, ''),
            address:        document.getElementById('cfg-address').value.trim(),
            maps:           document.getElementById('cfg-maps').value.trim(),
            socialTiktok:   document.getElementById('cfg-social-tiktok').value.trim(),
            socialFacebook: document.getElementById('cfg-social-facebook').value.trim(),
            socialWhatsapp: document.getElementById('cfg-social-whatsapp').value.trim().replace(/^\+/, ''),
            socialTelegram: document.getElementById('cfg-social-telegram').value.trim(),
            emailSubject:   document.getElementById('cfg-email-subject').value.trim(),
            emailBody:      document.getElementById('cfg-email-body').value.trim(),
            waMessage:      document.getElementById('cfg-wa-message').value.trim(),
            tgMessage:      document.getElementById('cfg-tg-message').value.trim(),
        };

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Menyimpan…'; }
        try {
            await apiSaveSiteSettings(cfg);
            // Update localStorage cache so other pages can use it offline
            localStorage.setItem(SITE_CFG_KEY, JSON.stringify(cfg));
            if (msgEl) showMessage(msgEl, '✅ Pengaturan berhasil disimpan ke database! Perubahan langsung aktif di halaman utama.', 'success');
        } catch (err) {
            if (msgEl) showMessage(msgEl, `❌ Gagal menyimpan: ${err.message}`, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan Pengaturan'; }
            setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 5000);
        }
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (!confirm('Reset semua pengaturan ke nilai default bawaan?')) return;
            resetBtn.disabled = true;
            try {
                await apiSaveSiteSettings({ ...SITE_DEFAULTS });
                localStorage.setItem(SITE_CFG_KEY, JSON.stringify({ ...SITE_DEFAULTS }));
                populateForm({ ...SITE_DEFAULTS });
                if (msgEl) showMessage(msgEl, '↺ Pengaturan direset ke default dan disimpan ke database.', 'success');
            } catch (err) {
                if (msgEl) showMessage(msgEl, `❌ Gagal reset: ${err.message}`, 'error');
            } finally {
                resetBtn.disabled = false;
                setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 4000);
            }
        });
    }
}

// ── Backup & Restore ───────────────────────────────────────────────────────────
function initBackupRestore() {
    const backupBtn  = document.getElementById('backup-download-btn');
    const backupMsg  = document.getElementById('backup-message');
    const restoreBtn = document.getElementById('restore-upload-btn');
    const restoreMsg = document.getElementById('restore-message');
    const fileInput  = document.getElementById('restore-file-input');

    if (!backupBtn || !restoreBtn) return;

    // ── Download backup
    backupBtn.addEventListener('click', async () => {
        backupBtn.disabled = true;
        backupBtn.textContent = '⏳ Menyiapkan backup…';
        if (backupMsg) backupMsg.textContent = '';
        try {
            const token = localStorage.getItem('speedtest_token');
            const apiUrl = (window.API_URL || 'http://localhost:3001');
            const res = await fetch(apiUrl + '/api/backup', {
                headers: token ? { Authorization: 'Bearer ' + token } : {}
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'HTTP ' + res.status);
            }
            // Get filename from Content-Disposition or use default
            const cd = res.headers.get('Content-Disposition') || '';
            const fnMatch = cd.match(/filename="?([^";\n]+)"?/);
            const filename = fnMatch ? fnMatch[1] : `speedtest_backup_${new Date().toISOString().slice(0,10)}.sql`;

            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (backupMsg) showMessage(backupMsg, '✅ Backup berhasil diunduh: ' + filename, 'success');
        } catch (err) {
            if (backupMsg) showMessage(backupMsg, '❌ Backup gagal: ' + err.message, 'error');
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = '⬇️ Unduh Backup (.enc)';
            setTimeout(() => { if (backupMsg) backupMsg.textContent = ''; }, 8000);
        }
    });

    // ── Upload & restore
    restoreBtn.addEventListener('click', async () => {
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            if (restoreMsg) showMessage(restoreMsg, '⚠️ Pilih file SQL terlebih dahulu.', 'error');
            return;
        }
        const file = fileInput.files[0];
        if (!file.name.endsWith('.enc')) {
            if (restoreMsg) showMessage(restoreMsg, '⚠️ File harus berekstensi .enc (hasil backup terenkripsi dari sistem ini).', 'error');
            return;
        }
        if (!confirm(`⚠️ PERINGATAN: Restore akan menimpa SEMUA data database dengan isi file "${file.name}".\n\nPastikan file backup benar. Lanjutkan?`)) return;

        restoreBtn.disabled = true;
        restoreBtn.textContent = '⏳ Sedang restore…';
        if (restoreMsg) restoreMsg.textContent = '';
        try {
            const buf = await file.arrayBuffer();
            const token = localStorage.getItem('speedtest_token');
            const apiUrl = (window.API_URL || 'http://localhost:3001');
            const res = await fetch(apiUrl + '/api/backup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    ...(token ? { Authorization: 'Bearer ' + token } : {})
                },
                body: buf
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
            if (restoreMsg) showMessage(restoreMsg, '✅ ' + (j.message || 'Restore berhasil!'), 'success');
            fileInput.value = '';
        } catch (err) {
            if (restoreMsg) showMessage(restoreMsg, '❌ Restore gagal: ' + err.message, 'error');
        } finally {
            restoreBtn.disabled = false;
            restoreBtn.textContent = '⚠️ Restore (Timpa Data)';
        }
    });
}
