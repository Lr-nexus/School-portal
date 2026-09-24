require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Tuned for a DB with max_user_connections = 5
  waitForConnections: true,
  connectionLimit: 3,
  maxIdle: 2,
  idleTimeout: 30000,
  queueLimit: 0,

  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Clever Cloud requires SSL
  ssl: { rejectUnauthorized: false },
});

/* Non-blocking startup ping. If the DB is down we log a warning but
   DO NOT crash — Render will still serve /health and return a proper
   503 on DB routes instead of killing the whole service. */
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ MySQL pool ready');
  } catch (err) {
    console.error('⚠️  MySQL connection FAILED:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('   → Database server not reachable from Render.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('   → Database does not exist.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong DB credentials.');
    } else if (err.code === 'ER_USER_LIMIT_REACHED') {
      console.error('   → Hit max_user_connections.');
    }
  }
})();

module.exports = pool;