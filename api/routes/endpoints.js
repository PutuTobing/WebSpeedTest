const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

function genId() {
    return 'ep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function mapRow(r) {
    return {
        id: r.id, name: r.name, baseUrl: r.base_url, location: r.location,
        isActive: !!r.is_active, linkedServerId: r.linked_server_id,
        addedBy: r.added_by, addedAt: r.added_at || r.created_at, updatedAt: r.updated_at
    };
}

// GET /api/endpoints/active  (public — for speedtest dropdown)
router.get('/active', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM endpoints WHERE is_active=1 ORDER BY name');
        res.json(rows.map(mapRow));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/endpoints  (admin)
router.get('/', adminMiddleware, async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM endpoints ORDER BY COALESCE(added_at, created_at, updated_at) DESC');
        res.json(rows.map(mapRow));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/endpoints  (admin)
router.post('/', adminMiddleware, async (req, res) => {
    const { name, baseUrl, location, isActive, linkedServerId } = req.body;
    if (!name || !baseUrl || !location) return res.status(400).json({ error: 'Field wajib tidak lengkap.' });
    const id = genId();
    try {
        await db.query(
            'INSERT INTO endpoints (id,name,base_url,location,is_active,linked_server_id,added_by) VALUES (?,?,?,?,?,?,?)',
            [id, name, baseUrl.replace(/\/$/,''), location, isActive!==false?1:0, linkedServerId||null, req.user.username]
        );
        res.json({ success: true, message: 'Endpoint berhasil ditambahkan!', id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/endpoints/:id  (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
    const { name, baseUrl, location, isActive, linkedServerId } = req.body;
    try {
        const [r] = await db.query(
            'UPDATE endpoints SET name=?,base_url=?,location=?,is_active=?,linked_server_id=? WHERE id=?',
            [name, (baseUrl||'').replace(/\/$/,''), location, isActive!==false?1:0, linkedServerId||null, req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
        res.json({ success: true, message: 'Endpoint berhasil diupdate!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/endpoints/:id/toggle  (admin)
router.put('/:id/toggle', adminMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT is_active FROM endpoints WHERE id=?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
        const newState = rows[0].is_active ? 0 : 1;
        await db.query('UPDATE endpoints SET is_active=? WHERE id=?', [newState, req.params.id]);
        res.json({ success: true, isActive: !!newState, message: newState ? 'Endpoint diaktifkan!' : 'Endpoint dinonaktifkan!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/endpoints/:id  (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM endpoints WHERE id=?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
        res.json({ success: true, message: 'Endpoint berhasil dihapus!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
