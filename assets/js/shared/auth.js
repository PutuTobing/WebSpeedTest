// Authentication Module — JWT-backed via MySQL REST API
// Requires js/config.js + js/api-client.js to be loaded first.

// ── JWT helpers (client-side decode, no signature check) ─────────
function _decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
}

function getCurrentSession() {
    const token = localStorage.getItem('speedtest_token');
    if (!token) return null;
    const p = _decodeJwt(token);
    if (!p) return null;
    if (p.exp && Date.now() / 1000 > p.exp) {
        localStorage.removeItem('speedtest_token');
        return null;
    }
    return { username: p.username, role: p.role, fullname: p.fullname, email: p.email };
}

function isLoggedIn() { return getCurrentSession() !== null; }
function isAdmin()    { const s = getCurrentSession(); return !!(s && s.role === 'admin'); }

function requireLogin() {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
    return true;
}
function requireAdmin() {
    if (!requireLogin()) return false;
    if (!isAdmin()) {
        alert('Akses ditolak! Halaman ini hanya untuk administrator.');
        window.location.href = 'dashboard.html';
        return false;
    }
    return true;
}

// ── Auth actions ─────────────────────────────────────────────────
async function login(username, password) {
    try {
        const data = await apiLogin(username, password);
        localStorage.setItem('speedtest_token', data.token);
        return { success: true, user: data.user };
    } catch (err) { return { success: false, message: err.message }; }
}

function logout() {
    localStorage.removeItem('speedtest_token');
    window.location.href = 'login.html';
}

// ── Password management ───────────────────────────────────────────
async function changePassword(_username, oldPassword, newPassword) {
    try { return await apiChangeOwnPassword(oldPassword, newPassword); }
    catch (err) { return { success: false, message: err.message }; }
}

async function adminChangePassword(username, newPassword) {
    try { return await apiChangeUserPassword(username, newPassword); }
    catch (err) { return { success: false, message: err.message }; }
}

// ── User management (admin only) ─────────────────────────────────
async function getAllUsers() {
    try { return await apiGetUsers(); } catch { return []; }
}
async function createUser(userData) {
    try { return await apiCreateUser(userData); }
    catch (err) { return { success: false, message: err.message }; }
}
async function updateUser(username, userData) {
    try { return await apiUpdateUser(username, userData); }
    catch (err) { return { success: false, message: err.message }; }
}
async function deleteUser(username) {
    try { return await apiDeleteUser(username); }
    catch (err) { return { success: false, message: err.message }; }
}

// ── Page initialisation (runs on every page) ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Inject custom logout confirmation modal
    if (!document.getElementById('logout-confirm-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
<div id="logout-confirm-modal" style="
    display:none; position:fixed; inset:0;
    background:rgba(0,0,0,0.55); backdrop-filter:blur(6px);
    z-index:9999; align-items:center; justify-content:center; padding:20px;">
    <div id="logout-confirm-box" style="
        background:var(--surface,#1e1e2e); border:1px solid var(--border,rgba(255,255,255,.12));
        border-radius:14px; padding:28px 28px 22px; max-width:340px; width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,.5); text-align:center;
        animation:lcIn .2s cubic-bezier(.34,1.36,.64,1) forwards;">
        <div style="font-size:2.4rem; margin-bottom:10px;">👋</div>
        <h3 style="margin:0 0 6px; font-size:1rem; font-weight:700; color:var(--text,#e2e8f0);">Keluar dari akun?</h3>
        <p style="margin:0 0 20px; font-size:0.82rem; color:var(--text-2,#94a3b8); line-height:1.5;">
            Sesi Anda akan diakhiri dan Anda akan diarahkan ke halaman login.
        </p>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button id="logout-confirm-cancel" style="
                padding:7px 22px; border-radius:8px; border:1px solid var(--border,rgba(255,255,255,.15));
                background:transparent; color:var(--text-2,#94a3b8); font-size:0.8rem;
                font-weight:600; cursor:pointer; transition:all .15s;">
                Batal
            </button>
            <button id="logout-confirm-ok" style="
                padding:7px 22px; border-radius:8px; border:none;
                background:linear-gradient(135deg,#ef4444,#dc2626);
                color:#fff; font-size:0.8rem; font-weight:700;
                cursor:pointer; transition:all .15s; box-shadow:0 4px 14px rgba(239,68,68,.35);">
                Ya, Logout
            </button>
        </div>
    </div>
</div>
<style>
@keyframes lcIn { from{opacity:0;transform:scale(.92) translateY(-8px)} to{opacity:1;transform:scale(1) translateY(0)} }
@keyframes lcOut { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(.92) translateY(-8px)} }
#logout-confirm-cancel:hover { background:rgba(255,255,255,.06)!important; color:var(--text,#e2e8f0)!important; }
#logout-confirm-ok:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(239,68,68,.45)!important; }
</style>`);
    }

    function showLogoutModal() {
        const modal = document.getElementById('logout-confirm-modal');
        const box   = document.getElementById('logout-confirm-box');
        modal.style.display = 'flex';
        box.style.animation = 'lcIn .2s cubic-bezier(.34,1.36,.64,1) forwards';
    }
    function hideLogoutModal() {
        const modal = document.getElementById('logout-confirm-modal');
        const box   = document.getElementById('logout-confirm-box');
        box.style.animation = 'lcOut .16s ease forwards';
        setTimeout(() => { modal.style.display = 'none'; }, 160);
    }

    document.getElementById('logout-confirm-cancel').addEventListener('click', hideLogoutModal);
    document.getElementById('logout-confirm-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('logout-confirm-modal')) hideLogoutModal();
    });
    document.getElementById('logout-confirm-ok').addEventListener('click', () => {
        hideLogoutModal();
        setTimeout(logout, 160);
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            showLogoutModal();
        });
    }

    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        const s = getCurrentSession();
        if (s) userInfo.textContent = `👤 ${s.fullname} (${s.role})`;
    }

    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem) adminMenuItem.style.display = isAdmin() ? 'block' : 'none';
});
