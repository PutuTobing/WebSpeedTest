const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/users  (admin only)
router.get('/', adminMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, username, role, fullname, email, status, created_at, updated_at FROM users ORDER BY created_at'
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users  (admin only)
router.post('/', adminMiddleware, async (req, res) => {
    const { username, password, role, fullname, email } = req.body;
    if (!username || !password || !role || !fullname) {
        return res.status(400).json({ error: 'Field wajib tidak lengkap.' });
    }
    try {
        const hash = await bcrypt.hash(password, 12);
        await db.query(
            'INSERT INTO users (username, password_hash, role, fullname, email) VALUES (?,?,?,?,?)',
            [username, hash, role, fullname, email || null]
        );
        res.json({ success: true, message: 'User berhasil dibuat!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username sudah digunakan!' });
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:username  (admin only)
router.put('/:username', adminMiddleware, async (req, res) => {
    const { role, fullname, email, status } = req.body;
    try {
        const [r] = await db.query(
            'UPDATE users SET role=?, fullname=?, email=?, status=? WHERE username=?',
            [role, fullname, email || null, status || 'active', req.params.username]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'User tidak ditemukan.' });
        res.json({ success: true, message: 'User berhasil diupdate!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:username/password  (admin)
router.put('/:username/password', adminMiddleware, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    try {
        const hash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash=? WHERE username=?', [hash, req.params.username]);
        res.json({ success: true, message: 'Password berhasil diubah!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/me/password  (self — must come before /:username)
router.put('/me/password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    try {
        const [rows] = await db.query('SELECT password_hash FROM users WHERE username=?', [req.user.username]);
        if (!rows[0]) return res.status(404).json({ error: 'User tidak ditemukan.' });
        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Password saat ini salah!' });
        const hash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash=? WHERE username=?', [hash, req.user.username]);
        res.json({ success: true, message: 'Password berhasil diubah!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:username  (admin only)
router.delete('/:username', adminMiddleware, async (req, res) => {
    if (req.user.username === req.params.username) {
        return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri!' });
    }
    try {
        const [r] = await db.query('DELETE FROM users WHERE username=?', [req.params.username]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'User tidak ditemukan.' });
        res.json({ success: true, message: 'User berhasil dihapus!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
