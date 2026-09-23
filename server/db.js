require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // ⭐ Tuned for a DB with max_user_connections = 5
  waitForConnections: true,
  connectionLimit: 3,        // hard ceiling — never more than 3 at once
  maxIdle: 2,                // only keep 2 warm idle connections
  idleTimeout: 30000,        // close idle connections after 30s
  queueLimit: 0,             // queue extra requests instead of erroring

  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Clever Cloud requires SSL
  ssl: { rejectUnauthorized: false }
});

// Startup ping — logs connection state on boot
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ?`,
      [process.env.DB_NAME]
    );
    conn.release();
    if (rows[0].c === 0) {
      console.warn('⚠️  Database is empty. Run `npm run setup` first.');
    } else {
      console.log(`✅ MySQL connected → ${process.env.DB_NAME} (${rows[0].c} tables)`);
    }
  } catch (err) {
    console.error('❌ MySQL connection FAILED:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('   → Database server not reachable.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('   → Database does not exist.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong DB credentials.');
    } else if (err.code === 'ER_USER_LIMIT_REACHED') {
      console.error('   → Hit max_user_connections. Check nothing else is connected.');
    }
  }
})();

module.exports = pool;