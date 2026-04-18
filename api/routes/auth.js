const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');
const { SECRET, authMiddleware } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];
        if (!user)                   return res.status(401).json({ error: 'Username atau password salah.' });
        if (user.status !== 'active') return res.status(403).json({ error: 'Akun tidak aktif. Hubungi administrator.' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Username atau password salah.' });

        const token = jwt.sign(
            { username: user.username, role: user.role, fullname: user.fullname, email: user.email },
            SECRET,
            { expiresIn: '24h' }
        );
        res.json({ success: true, token, user: { username: user.username, role: user.role, fullname: user.fullname, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
