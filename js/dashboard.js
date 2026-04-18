// Dashboard Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Require login
    if (!requireLogin()) return;
    
    const session = getCurrentSession();
    
    // Initialize tab switching
    initializeTabs();
    
    // Initialize dropdown
    initializeDropdowns();
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Load servers
    loadUserServers();
    
    // Initialize server form
    initializeServerForm();
    
    // Initialize password change form
    initializePasswordForm();
});

// Initialize tab switching
function initializeTabs() {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            // Remove active class from all
            menuItems.forEach(mi => mi.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            // Add active class to clicked
            item.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Load user's servers
async function loadUserServers() {
    const session = getCurrentSession();
    const servers = await getServersByUser(session.username);
    const serverList = document.getElementById('server-list');
    
    if (servers.length === 0) {
        serverList.innerHTML = '<p class="no-data">Belum ada server terdaftar</p>';
        return;
    }
    
    serverList.innerHTML = servers.map(server => `
        <div class="server-card ${server.status}">
            <div class="server-card-header">
                <h4>${server.companyName}</h4>
                <span class="status-badge status-${server.status}">${getStatusText(server.status)}</span>
            </div>
            <div class="server-card-body">
                <div class="server-info">
                    <span class="info-icon">📍</span>
                    <span><strong>Lokasi:</strong> ${server.location}</span>
                </div>
                <div class="server-info">
                    <span class="info-icon">🌐</span>
                    <span><strong>URL:</strong> ${server.serverUrl}</span>
                </div>
                <div class="server-info">
                    <span class="info-icon">⚡</span>
                    <span><strong>Bandwidth:</strong> ${server.bandwidthCapacity}</span>
                </div>
                <div class="server-info">
                    <span class="info-icon">💻</span>
                    <span><strong>Spec:</strong> ${server.cpuCores} Cores / ${server.ramSize} GB RAM</span>
                </div>
                <div class="server-info">
                    <span class="info-icon">👤</span>
                    <span><strong>PIC:</strong> ${server.contactName} (${server.contactEmail})</span>
                </div>
                ${server.companyWebsite ? `
                <div class="server-info">
                    <span class="info-icon">🌐</span>
                    <span><strong>Website:</strong> <a href="${server.companyWebsite}" target="_blank" rel="noopener noreferrer">${server.companyWebsite}</a></span>
                </div>
                ` : ''}
                ${server.additionalNotes ? `
                <div class="server-info">
                    <span class="info-icon">📝</span>
                    <span><strong>Catatan:</strong> ${server.additionalNotes}</span>
                </div>
                ` : ''}
            </div>
            <div class="server-card-footer">
                <small>Dibuat: ${formatDate(server.createdAt)}</small>
                <div class="server-actions">
                    <button class="btn-edit" onclick="editServer('${server.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteServerConfirm('${server.id}')">🗑️ Hapus</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        'pending':  '⏳ Menunggu Approval',
        'checking': '🔍 Sedang Dicek',
        'approved': '✅ Disetujui',
        'error':    '❌ Error / Ditolak'
    };
    return statusMap[status] || status;
}

// Format date
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

// Initialize server form
function initializeServerForm() {
    const serverForm = document.getElementById('server-form');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const serverMessage = document.getElementById('server-message');
    
    serverForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const serverId = document.getElementById('server-id').value;
        const serverData = {
            companyName: document.getElementById('company-name').value.trim(),
            location: document.getElementById('server-location').value.trim(),
            bandwidthCapacity: document.getElementById('bandwidth-capacity').value,
            serverUrl: document.getElementById('server-url').value.trim(),
            cpuCores: document.getElementById('cpu-cores').value,
            ramSize: document.getElementById('ram-size').value,
            contactName: document.getElementById('contact-name').value.trim(),
            contactEmail: document.getElementById('contact-email').value.trim(),
            companyWebsite: document.getElementById('company-website').value.trim(),
            additionalNotes: document.getElementById('additional-notes').value.trim()
        };
        
        let result;
        if (serverId) {
            result = await updateServer(serverId, serverData);
        } else {
            result = await createServer(serverData);
        }
        
        if (result.success) {
            showMessage(serverMessage, result.message, 'success');
            serverForm.reset();
            document.getElementById('server-id').value = '';
            document.getElementById('form-title').textContent = '➕ Tambah Server Baru';
            cancelBtn.style.display = 'none';
            loadUserServers();
        } else {
            showMessage(serverMessage, result.message, 'error');
        }
    });
    
    cancelBtn.addEventListener('click', () => {
        serverForm.reset();
        document.getElementById('server-id').value = '';
        document.getElementById('form-title').textContent = '➕ Tambah Server Baru';
        cancelBtn.style.display = 'none';
    });
}

// Edit server
async function editServer(serverId) {
    const server = await getServerById(serverId);
    if (!server) return;
    
    // Fill form
    document.getElementById('server-id').value = server.id;
    document.getElementById('company-name').value = server.companyName;
    document.getElementById('server-location').value = server.location;
    document.getElementById('bandwidth-capacity').value = server.bandwidthCapacity;
    document.getElementById('server-url').value = server.serverUrl;
    document.getElementById('cpu-cores').value = server.cpuCores;
    document.getElementById('ram-size').value = server.ramSize;
    document.getElementById('contact-name').value = server.contactName;
    document.getElementById('contact-email').value = server.contactEmail;
    document.getElementById('company-website').value = server.companyWebsite || '';
    document.getElementById('additional-notes').value = server.additionalNotes || '';
    
    // Update form UI
    document.getElementById('form-title').textContent = '✏️ Edit Server';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete server with confirmation
async function deleteServerConfirm(serverId) {
    const server = await getServerById(serverId);
    if (!server) return;
    
    if (confirm(`Apakah Anda yakin ingin menghapus server ${server.companyName}?`)) {
        const result = await deleteServer(serverId);
        const serverMessage = document.getElementById('server-message');
        
        if (result.success) {
            showMessage(serverMessage, result.message, 'success');
            loadUserServers();
        } else {
            showMessage(serverMessage, result.message, 'error');
        }
    }
}

// Initialize password change form
function initializePasswordForm() {
    const passwordForm = document.getElementById('change-password-form');
    const passwordMessage = document.getElementById('password-message');
    
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validate
        if (newPassword !== confirmPassword) {
            showMessage(passwordMessage, 'Password baru dan konfirmasi tidak cocok!', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showMessage(passwordMessage, 'Password minimal 6 karakter!', 'error');
            return;
        }
        
        const session = getCurrentSession();
        const result = await changePassword(session.username, currentPassword, newPassword);
        
        if (result.success) {
            showMessage(passwordMessage, result.message, 'success');
            passwordForm.reset();
        } else {
            showMessage(passwordMessage, result.message, 'error');
        }
    });
}

// Show message
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}

// Initialize dropdown menus
function initializeDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close other dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(m => {
                    if (m !== menu) {
                        m.classList.remove('show');
                    }
                });
                
                // Toggle current dropdown
                menu.classList.toggle('show');
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
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
