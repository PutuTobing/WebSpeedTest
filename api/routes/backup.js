const express = require('express');
const router  = express.Router();
const { exec } = require('child_process');
const crypto  = require('crypto');
const { adminMiddleware } = require('../middleware/auth');

// AES-256-CBC key: 32-byte hex from BACKUP_KEY env var
function getKey() {
    const hex = process.env.BACKUP_KEY;
    if (!hex || hex.length < 64) throw new Error('BACKUP_KEY tidak ditemukan atau tidak valid di .env');
    return Buffer.from(hex.slice(0, 64), 'hex');
}

// Encrypt Buffer → Buffer  (format: [16-byte IV][encrypted data])
function aesEncrypt(plainBuf) {
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
    const enc    = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
    return Buffer.concat([iv, enc]);
}

// Decrypt Buffer → Buffer
function aesDecrypt(encBuf) {
    if (encBuf.length < 17) throw new Error('File backup tidak valid atau rusak.');
    const iv      = encBuf.slice(0, 16);
    const data    = encBuf.slice(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ── GET /api/backup  — admin only, returns AES-256 encrypted backup ──────────
router.get('/', adminMiddleware, (req, res) => {
    const host   = process.env.DB_HOST || 'localhost';
    const port   = process.env.DB_PORT || '3306';
    const user   = process.env.DB_USER || 'speedtest_user';
    const pass   = process.env.DB_PASS || '';
    const dbName = process.env.DB_NAME || 'speedtest_db';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename  = `speedtest_backup_${timestamp}.enc`;

    const cmd = `mysqldump --host="${host}" --port="${port}" --user="${user}" --single-transaction --routines --triggers --add-drop-table "${dbName}"`;
    const env = { ...process.env, MYSQL_PWD: pass };

    const child = exec(cmd, { env, maxBuffer: 200 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
            console.error('mysqldump error:', err.message, stderr);
            if (!res.headersSent) res.status(500).json({ error: 'Backup gagal: ' + err.message });
            return;
        }
        let encBuf;
        try {
            encBuf = aesEncrypt(Buffer.from(stdout, 'utf8'));
        } catch (e) {
            console.error('Encrypt error:', e.message);
            if (!res.headersSent) res.status(500).json({ error: 'Enkripsi gagal: ' + e.message });
            return;
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', encBuf.length);
        res.end(encBuf);
    });

    child.on('error', err => {
        console.error('mysqldump spawn error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Backup gagal: ' + err.message });
    });
});

// ── POST /api/backup  — admin only, accepts encrypted .enc file body ──────────
router.post('/', adminMiddleware, express.raw({ limit: '200mb', type: 'application/octet-stream' }), (req, res) => {
    const encBuf = req.body;
    if (!Buffer.isBuffer(encBuf) || encBuf.length < 17) {
        return res.status(400).json({ error: 'File backup tidak valid. Upload file .enc hasil backup dari sistem ini.' });
    }

    let sql;
    try {
        sql = aesDecrypt(encBuf).toString('utf8');
    } catch (e) {
        console.error('Decrypt error:', e.message);
        return res.status(400).json({ error: 'Dekripsi gagal. File tidak valid atau bukan backup dari sistem ini.' });
    }

    if (!sql || sql.trim().length < 10 || !sql.includes('MySQL')) {
        return res.status(400).json({ error: 'Konten backup tidak valid setelah dekripsi.' });
    }

    const host   = process.env.DB_HOST || 'localhost';
    const port   = process.env.DB_PORT || '3306';
    const user   = process.env.DB_USER || 'speedtest_user';
    const pass   = process.env.DB_PASS || '';
    const dbName = process.env.DB_NAME || 'speedtest_db';

    const cmd = `mysql --host="${host}" --port="${port}" --user="${user}" "${dbName}"`;
    const env = { ...process.env, MYSQL_PWD: pass };

    const child = exec(cmd, { env, maxBuffer: 200 * 1024 * 1024 });
    child.stdin.write(sql);
    child.stdin.end();

    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => {
        if (code !== 0) {
            console.error('mysql restore stderr:', stderr);
            return res.status(500).json({ error: 'Restore gagal: ' + stderr.slice(0, 300) });
        }
        res.json({ ok: true, message: 'Restore berhasil! Data telah dipulihkan dari backup.' });
    });
    child.on('error', err => {
        console.error('mysql restore error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Restore gagal: ' + err.message });
    });
});

module.exports = router;
