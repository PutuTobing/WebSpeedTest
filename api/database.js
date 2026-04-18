require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:             process.env.DB_HOST     || 'localhost',
    port:             parseInt(process.env.DB_PORT || '3306'),
    user:             process.env.DB_USER     || 'speedtest_user',
    password:         process.env.DB_PASS     || '',
    database:         process.env.DB_NAME     || 'speedtest_db',
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0,
    charset:          'utf8mb4'
});

module.exports = pool;
