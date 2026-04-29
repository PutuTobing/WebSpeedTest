require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const db      = require('./database');

const app = express();

// Trust reverse proxy (nginx) — needed for correct req.ip / x-forwarded-for parsing
app.set('trust proxy', true);

app.use(cors({
    origin: '*',
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/servers',       require('./routes/servers'));
app.use('/api/endpoints',     require('./routes/endpoints'));
app.use('/api/history',       require('./routes/history'));
app.use('/api/site-settings', require('./routes/site-settings'));
app.use('/api/backup',       require('./routes/backup'));
app.use('/api/proxy-image',  require('./routes/proxy-image'));
app.use('/api/geolocate',    require('./routes/geolocate'));
app.use('/api/ping-server',  require('./routes/ping-server'));

// Root + health check
app.get('/', (_req, res) => res.json({ name: 'SpeedTest API', version: '1.0.0', status: 'running', docs: '/api/health' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Global error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Create default admin on first boot if no admin exists
async function initDefaultAdmin() {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='admin'");
        if (rows[0].cnt === 0) {
            const defaultPass = process.env.DEFAULT_ADMIN_PASS;
            if (!defaultPass) {
                console.error('ERROR: DEFAULT_ADMIN_PASS tidak diset di .env — default admin tidak dibuat.');
                return;
            }
            const hash = await bcrypt.hash(defaultPass, 12);
            await db.query(
                "INSERT INTO users (username, password_hash, role, fullname, email) VALUES ('admin', ?, 'admin', 'Administrator', 'admin@btd.co.id')",
                [hash]
            );
            console.log('================================================');
            console.log('Default admin created:');
            console.log('  Username : admin');
            console.log('  Password : (lihat DEFAULT_ADMIN_PASS di .env)');
            console.log('PENTING: Ganti password setelah login pertama!');
            console.log('================================================');
        }
    } catch (err) {
        console.error('Failed to initialise default admin:', err.message);
    }
}

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`SpeedTest API berjalan di port ${PORT}`);
    await initDefaultAdmin();
});
