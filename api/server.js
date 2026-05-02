require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const db      = require('./database');

// Auto-create all required tables on startup
async function initDB() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            username      VARCHAR(50)  UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role          ENUM('user','admin') DEFAULT 'user',
            fullname      VARCHAR(100) NOT NULL,
            email         VARCHAR(100),
            status        ENUM('active','inactive') DEFAULT 'active',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS servers (
            id                 VARCHAR(100) PRIMARY KEY,
            company_name       VARCHAR(100) NOT NULL,
            location           VARCHAR(100) NOT NULL,
            bandwidth_capacity VARCHAR(20)  NOT NULL,
            server_url         VARCHAR(255) NOT NULL,
            cpu_cores          INT  DEFAULT 1,
            ram_size           INT  DEFAULT 1,
            contact_name       VARCHAR(100),
            contact_email      VARCHAR(100),
            company_website    VARCHAR(255),
            additional_notes   TEXT,
            status             ENUM('pending','checking','approved','error') DEFAULT 'pending',
            downtime_count     INT DEFAULT 0,
            last_status        VARCHAR(10),
            last_checked       TIMESTAMP NULL,
            created_by         VARCHAR(50),
            approved_by        VARCHAR(50),
            approved_at        TIMESTAMP NULL,
            status_changed_by  VARCHAR(50),
            created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS endpoints (
            id               VARCHAR(100) PRIMARY KEY,
            name             VARCHAR(100) NOT NULL,
            base_url         VARCHAR(255) NOT NULL,
            location         VARCHAR(100) NOT NULL,
            is_active        BOOLEAN DEFAULT TRUE,
            linked_server_id VARCHAR(100),
            added_by         VARCHAR(50),
            added_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (linked_server_id) REFERENCES servers(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Migration: add added_at column for older installations that only have created_at
    try {
        await db.query(`ALTER TABLE endpoints ADD COLUMN added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await db.query(`UPDATE endpoints SET added_at = COALESCE(created_at, NOW()) WHERE added_at IS NULL`);
    } catch (_) { /* column already exists, skip */ }
    await db.query(`
        CREATE TABLE IF NOT EXISTS speedtest_history (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            username      VARCHAR(50),
            server_url    VARCHAR(255),
            server_name   VARCHAR(100),
            ping_ms       FLOAT,
            jitter_ms     FLOAT,
            download_mbps FLOAT,
            upload_mbps   FLOAT,
            tested_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_username  (username),
            INDEX idx_tested_at (tested_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
            id           INT NOT NULL DEFAULT 1,
            settings_json TEXT NOT NULL,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`INSERT IGNORE INTO site_settings (id, settings_json) VALUES (1, '{}')`);
}

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
app.use('/api/proxy-image',      require('./routes/proxy-image'));
app.use('/api/geolocate',        require('./routes/geolocate'));
app.use('/api/ping-server',      require('./routes/ping-server'));
app.use('/api/speedtest-proxy',  require('./routes/speedtest-proxy'));

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
    try {
        await initDB();
        console.log('Database tables verified/created.');
    } catch (err) {
        console.error('initDB error:', err.message);
    }
    await initDefaultAdmin();
});
