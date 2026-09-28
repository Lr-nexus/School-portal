require('dotenv').config();
const mysql = require('mysql2/promise');

const TARGETS = [
  { role: 'teacher', password: 'Teacher@123' },
  { role: 'student', password: 'Student@123' },
  { role: 'parent',  password: 'Parent@123'  },
];

async function run() {
  const dbName = process.env.DB_NAME;
  const host   = process.env.DB_HOST;
  const user   = process.env.DB_USER;

  console.log('\n🔐 Bulk password reset\n');
  console.log(`   Host: ${host}`);
  console.log(`   DB:   ${dbName}\n`);

  if (!host || !user || !dbName) {
    console.error('❌ DB_HOST, DB_USER and DB_NAME must be set in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT) || 3306,
      user,
      password: process.env.DB_PASSWORD,
      database: dbName,
      ssl: { rejectUnauthorized: false },
    });
    console.log('   ✓ Connected\n');

    const [before] = await conn.query(
      `SELECT role, password, COUNT(*) AS count
       FROM users GROUP BY role, password ORDER BY role`
    );
    console.log('─── Before ─────────────────────────────');
    before.forEach((r) =>
      console.log(`   ${r.role.padEnd(10)}  ${r.password.padEnd(16)}  ${String(r.count).padStart(4)}`)
    );

    console.log('\n─── Applying new passwords ─────────────');
    for (const t of TARGETS) {
      const [result] = await conn.query(
        `UPDATE users SET password = ? WHERE role = ?`,
        [t.password, t.role]
      );
      console.log(`   ✓ ${result.affectedRows} ${t.role}${result.affectedRows === 1 ? '' : 's'}  →  ${t.password}`);
    }

    const [after] = await conn.query(
      `SELECT role, password, COUNT(*) AS count
       FROM users GROUP BY role, password ORDER BY role`
    );

    console.log('\n─── After ──────────────────────────────');
    after.forEach((r) =>
      console.log(`   ${r.role.padEnd(10)}  ${r.password.padEnd(16)}  ${String(r.count).padStart(4)}`)
    );

    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong DB credentials in .env');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('   → Cannot reach host. Check DB_HOST and firewall.');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();