// HTML escaping to prevent XSS when rendering user-supplied data into innerHTML
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
    const navToggle  = document.getElementById('nav-toggle');
    const navMenu    = document.getElementById('nav-menu');
    const navOverlay = document.getElementById('nav-overlay');

    function openMenu() {
        navMenu.classList.add('active');
        navToggle.setAttribute('aria-expanded', 'true');
        navToggle.classList.add('open');
        if (navOverlay) navOverlay.classList.add('active');
    }
    function closeMenu() {
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.classList.remove('open');
        if (navOverlay) navOverlay.classList.remove('active');
    }

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', e => {
            e.stopPropagation();
            navMenu.classList.contains('active') ? closeMenu() : openMenu();
        });
    }
    if (navOverlay) navOverlay.addEventListener('click', closeMenu);
}

// Load all users

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

