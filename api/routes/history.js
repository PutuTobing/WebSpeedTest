const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { authMiddleware } = require('../middleware/auth');

// GET /api/history
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM speedtest_history WHERE username=? ORDER BY tested_at DESC LIMIT 20',
            [req.user.username]
        );
        res.json(rows.map(r => ({
            id: r.id, server: r.server_url, serverName: r.server_name,
            ping: r.ping_ms, jitter: r.jitter_ms,
            download: r.download_mbps, upload: r.upload_mbps,
            timestamp: r.tested_at
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/history
router.post('/', authMiddleware, async (req, res) => {
    const { server, serverName, ping, jitter, download, upload } = req.body;
    try {
        await db.query(
            'INSERT INTO speedtest_history (username,server_url,server_name,ping_ms,jitter_ms,download_mbps,upload_mbps) VALUES (?,?,?,?,?,?,?)',
            [req.user.username, server||'', serverName||'', ping||0, jitter||0, download||0, upload||0]
        );
        // Keep only the last 20 rows per user
        const [keep] = await db.query(
            'SELECT id FROM speedtest_history WHERE username=? ORDER BY tested_at DESC LIMIT 20',
            [req.user.username]
        );
        if (keep.length >= 20) {
            const ids = keep.map(r => r.id);
            await db.query(
                `DELETE FROM speedtest_history WHERE username=? AND id NOT IN (${ids.map(()=>'?').join(',')})`,
                [req.user.username, ...ids]
            );
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/history
router.delete('/', authMiddleware, async (req, res) => {
    try {
        await db.query('DELETE FROM speedtest_history WHERE username=?', [req.user.username]);
        res.json({ success: true, message: 'Riwayat berhasil dihapus!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
