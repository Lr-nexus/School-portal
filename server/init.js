require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROOT = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || '',
  multipleStatements: true,
};

const DB_NAME = process.env.DB_NAME || 'portal_user';
const APP_USER = process.env.DB_USER || 'portal_user';
const APP_PASS = process.env.DB_PASSWORD || 'portal_pass_123';

async function init() {
  console.log('🔧 Initializing database…\n');
  let conn;

  try {
    conn = await mysql.createConnection(ROOT);
    console.log('   ✓ Connected to MySQL as root');

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`   ✓ Database '${DB_NAME}' ready`);

    await conn.query(
      `CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`,
      [APP_USER, APP_PASS]
    );
    await conn.query(
      `ALTER USER ?@'localhost' IDENTIFIED BY ?`,
      [APP_USER, APP_PASS]
    );
    console.log(`   ✓ User '${APP_USER}' ready`);

    await conn.query(
      `GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO ?@'localhost'`,
      [APP_USER]
    );
    await conn.query('FLUSH PRIVILEGES');
    console.log('   ✓ Privileges granted');

    await conn.query(`USE \`${DB_NAME}\``);

    const [existing] = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ?`,
      [DB_NAME]
    );

    if (existing.length) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const row of existing) {
        await conn.query(`DROP TABLE IF EXISTS \`${row.table_name || row.TABLE_NAME}\``);
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`   ✓ Dropped ${existing.length} old tables`);
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error('schema.sql not found in ' + __dirname);
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(schema);
    console.log('   ✓ Schema executed');

    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ?`,
      [DB_NAME]
    );
    const count = rows[0].c;
    console.log(`   ✓ ${count} tables in database`);

    if (count < 16) {
      throw new Error(`Expected 16 tables but found ${count}. Check schema.sql.`);
    }

    console.log('\n✅ Database initialization complete.\n');
    console.log('Next step:  node seed.js');
  } catch (err) {
    console.error('\n❌ Initialization failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('   → WAMP is not running. Start it and try again.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong root password. Set MYSQL_ROOT_PASSWORD in .env');
    } else if (err.code === 'ER_PARSE_ERROR') {
      console.error('   → Problem inside schema.sql. Check that file.');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

init();