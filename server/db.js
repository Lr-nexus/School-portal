require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Aiven requires SSL
  ssl: { rejectUnauthorized: false }
});

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
  }
})();

module.exports = pool;