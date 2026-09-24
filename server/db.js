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

/* A one-time informational ping. It runs AFTER the caller has had a
   chance to register its own work, and it never crashes the process. */
setTimeout(() => {
  pool.getConnection()
    .then((conn) => {
      conn.ping()
        .then(() => console.log('✅ MySQL pool ready'))
        .catch(() => {})
        .finally(() => conn.release());
    })
    .catch((err) => {
      console.error('⚠️  MySQL connection FAILED:', err.message);
      if (err.code === 'ECONNREFUSED')       console.error('   → DB server not reachable.');
      else if (err.code === 'ER_BAD_DB_ERROR') console.error('   → Database does not exist.');
      else if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('   → Wrong DB credentials.');
    });
}, 500);

module.exports = pool;