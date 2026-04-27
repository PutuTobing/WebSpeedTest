const SITE_CFG_KEY = 'site_config';

const SITE_DEFAULTS = {
    siteTitle:       'SpeedTest - SKY TECH',
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
        document.getElementById('cfg-site-title').value         = cfg.siteTitle      || '';
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
            siteTitle:      document.getElementById('cfg-site-title').value.trim(),
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
            const filename = fnMatch ? fnMatch[1] : `speedtest_backup_${new Date().toISOString().slice(0,10)}.enc`;

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
            if (restoreMsg) showMessage(restoreMsg, '⚠️ Pilih file .enc terlebih dahulu.', 'error');
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
