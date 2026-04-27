async function loadUsers() {
    const users = await getAllUsers();
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Tidak ada user</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.username)}</strong></td>
            <td><span class="role-badge role-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span></td>
            <td>${escapeHtml(user.fullname)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="status-badge status-${escapeHtml(user.status)}">${escapeHtml(user.status)}</span></td>
            <td>
                <button class="btn-small btn-edit" onclick="editUser('${escapeHtml(user.username)}')">✏️ Edit</button>
                <button class="btn-small btn-password" onclick="changeUserPassword('${escapeHtml(user.username)}')">🔑 Password</button>
                ${user.username !== getCurrentSession().username ? 
                    `<button class="btn-small btn-delete" onclick="deleteUserConfirm('${escapeHtml(user.username)}')">🗑️</button>` : 
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
