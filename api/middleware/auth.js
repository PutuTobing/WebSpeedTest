const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    console.error('FATAL: JWT_SECRET tidak diset di .env — server tidak aman!');
    process.exit(1);
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
    }
    try {
        req.user = jwt.verify(header.slice(7), SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa.' });
    }
}

function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Hanya administrator yang diizinkan.' });
        }
        next();
    });
}

module.exports = { authMiddleware, adminMiddleware, SECRET };
