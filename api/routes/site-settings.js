const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { adminMiddleware } = require('../middleware/auth');

// Ensure table exists (runs once on first import)
async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
            id           INT NOT NULL DEFAULT 1,
            settings_json TEXT NOT NULL,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Insert default row if not present
    await db.query(`
        INSERT IGNORE INTO site_settings (id, settings_json) VALUES (1, '{}')
    `);
}
ensureTable().catch(err => console.error('site_settings table init error:', err.message));

// GET /api/site-settings  — public
router.get('/', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT settings_json FROM site_settings WHERE id = 1');
        const cfg = rows.length ? JSON.parse(rows[0].settings_json || '{}') : {};
        res.json(cfg);
    } catch (err) {
        console.error('GET site-settings error:', err.message);
        res.status(500).json({ error: 'Gagal mengambil pengaturan situs.' });
    }
});

// PUT /api/site-settings  — admin only
router.put('/', adminMiddleware, async (req, res) => {
    try {
        const allowed = [
            'siteTitle',
            'logoUrl','brandMain','brandSub',
            'linkRegister','linkCustLogin',
            'email','phone','address','maps',
            'socialTiktok','socialFacebook','socialWhatsapp','socialTelegram',
            'emailSubject','emailBody',
            'waMessage','tgMessage'
        ];
        // Only store known keys to prevent arbitrary data injection
        const cfg = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) cfg[k] = String(req.body[k]).slice(0, 2048);
        }
        await db.query(
            'INSERT INTO site_settings (id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json = ?, updated_at = NOW()',
            [JSON.stringify(cfg), JSON.stringify(cfg)]
        );
        res.json({ ok: true, settings: cfg });
    } catch (err) {
        console.error('PUT site-settings error:', err.message);
        res.status(500).json({ error: 'Gagal menyimpan pengaturan situs.' });
    }
});

module.exports = router;
