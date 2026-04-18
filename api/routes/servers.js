const express = require('express');
const router  = express.Router();
const http    = require('http');
const https   = require('https');
const db      = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

function genId() {
    return 'server_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function mapRow(r) {
    return {
        id: r.id, companyName: r.company_name, location: r.location,
        bandwidthCapacity: r.bandwidth_capacity, serverUrl: r.server_url,
        cpuCores: r.cpu_cores, ramSize: r.ram_size,
        contactName: r.contact_name, contactEmail: r.contact_email,
        companyWebsite: r.company_website || '',
        additionalNotes: r.additional_notes, status: r.status,
        downtimeCount: r.downtime_count, lastStatus: r.last_status,
        lastChecked: r.last_checked, createdBy: r.created_by,
        approvedBy: r.approved_by, approvedAt: r.approved_at,
        createdAt: r.created_at, updatedAt: r.updated_at
    };
}

// GET /api/servers
router.get('/', authMiddleware, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const [rows] = isAdmin
            ? await db.query('SELECT * FROM servers ORDER BY created_at DESC')
            : await db.query('SELECT * FROM servers WHERE created_by=? ORDER BY created_at DESC', [req.user.username]);
        res.json(rows.map(mapRow));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/servers/approved  (public)
router.get('/approved', async (_req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM servers WHERE status='approved' ORDER BY company_name");
        res.json(rows.map(mapRow));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers
router.post('/', authMiddleware, async (req, res) => {
    const { companyName, location, bandwidthCapacity, serverUrl, cpuCores, ramSize, contactName, contactEmail, companyWebsite, additionalNotes } = req.body;
    if (!companyName || !location || !bandwidthCapacity || !serverUrl) {
        return res.status(400).json({ error: 'Field wajib tidak lengkap.' });
    }
    const id = genId();
    try {
        await db.query(
            `INSERT INTO servers (id,company_name,location,bandwidth_capacity,server_url,cpu_cores,ram_size,contact_name,contact_email,company_website,additional_notes,created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, companyName, location, bandwidthCapacity, serverUrl, cpuCores||1, ramSize||1, contactName||'', contactEmail||'', companyWebsite||'', additionalNotes||'', req.user.username]
        );
        res.json({ success: true, message: 'Server berhasil ditambahkan! Menunggu approval dari administrator.', id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/servers/:id
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { companyName, location, bandwidthCapacity, serverUrl, cpuCores, ramSize, contactName, contactEmail, companyWebsite, additionalNotes, status } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM servers WHERE id=?', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Server tidak ditemukan.' });
        if (req.user.role !== 'admin' && rows[0].created_by !== req.user.username) {
            return res.status(403).json({ error: 'Tidak memiliki izin mengubah server ini.' });
        }
        const newStatus = req.user.role === 'admin' ? (status || rows[0].status) : rows[0].status;
        await db.query(
            `UPDATE servers SET company_name=?,location=?,bandwidth_capacity=?,server_url=?,cpu_cores=?,ram_size=?,contact_name=?,contact_email=?,company_website=?,additional_notes=?,status=? WHERE id=?`,
            [companyName, location, bandwidthCapacity, serverUrl, cpuCores||1, ramSize||1, contactName||'', contactEmail||'', companyWebsite||'', additionalNotes||'', newStatus, id]
        );
        res.json({ success: true, message: 'Server berhasil diupdate!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/servers/:id/status  (admin)
router.put('/:id/status', adminMiddleware, async (req, res) => {
    const valid = ['pending','checking','approved','error'];
    if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'Status tidak valid.' });
    try {
        const approvedAt = req.body.status === 'approved' ? new Date() : null;
        const approvedBy = req.body.status === 'approved' ? req.user.username : null;
        await db.query(
            `UPDATE servers SET status=?, status_changed_by=?, approved_by=COALESCE(?,approved_by), approved_at=COALESCE(?,approved_at) WHERE id=?`,
            [req.body.status, req.user.username, approvedBy, approvedAt, req.params.id]
        );
        res.json({ success: true, message: `Status diubah ke "${req.body.status}"!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/check  (admin — perform server-side ping and record result)
router.post('/:id/check', adminMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM servers WHERE id=?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Server tidak ditemukan.' });

        const serverUrl = rows[0].server_url.replace(/\/+$/, '');
        const pingUrl = `${serverUrl}/ping`;

        let isUp = false;
        let latency = null;
        let statusCode = null;

        try {
            const lib = pingUrl.startsWith('https') ? https : http;
            await new Promise((resolve) => {
                const start = Date.now();
                const httpReq = lib.get(pingUrl, { timeout: 5000 }, (resp) => {
                    latency = Date.now() - start;
                    statusCode = resp.statusCode;
                    isUp = resp.statusCode >= 200 && resp.statusCode < 400;
                    resp.resume(); // consume body
                    resolve();
                });
                httpReq.on('timeout', () => { httpReq.destroy(); resolve(); });
                httpReq.on('error', () => { resolve(); });
            });
        } catch (_) {
            isUp = false;
        }

        if (isUp) {
            await db.query("UPDATE servers SET last_status='up', last_checked=NOW() WHERE id=?", [req.params.id]);
        } else {
            await db.query("UPDATE servers SET last_status='down', last_checked=NOW(), downtime_count=downtime_count+1 WHERE id=?", [req.params.id]);
        }
        res.json({ success: true, isUp, latency, statusCode, url: pingUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM servers WHERE id=?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Server tidak ditemukan.' });
        if (req.user.role !== 'admin' && rows[0].created_by !== req.user.username) {
            return res.status(403).json({ error: 'Tidak memiliki izin menghapus server ini.' });
        }
        await db.query('DELETE FROM servers WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Server berhasil dihapus!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
